import { authenticator, totp } from 'otplib';
import crypto from 'crypto';
import {
  ConflictException,
  ForbiddenException,
  HttpException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { LoginDto, RegisterDto } from './auth.dto';
import { hashPassword, verifyPassword } from '../../lib/password';
import {
  generateAccessToken,
  generateRefreshToken,
  hashToken,
  verifyRefreshToken,
} from '../../lib/tokens';
import { sanitizeUser } from '../../lib/sanitize';
import { normalizeRoleName, normalizeRoleNames, type SecurityRole } from '../../config/roles';

const REFRESH_TOKEN_WINDOW_MS = 7 * 24 * 60 * 60 * 1000;
const LOCK_WINDOW_MS = 15 * 60 * 1000;
const MAX_FAILED_ATTEMPTS = 5;

@Injectable()
export class AuthService {
  constructor(private prisma: PrismaService) {}

  async register(dto: RegisterDto, ipAddress: string) {
    const userCount = await this.prisma.user.count();
    if (userCount > 0) {
      throw new ForbiddenException('Self-registration is disabled. Contact your administrator.');
    }

    const existing = await this.prisma.user.findUnique({ where: { email: dto.email.toLowerCase() } });
    if (existing) {
      throw new ConflictException('Email already registered');
    }

    const passwordHash = await hashPassword(dto.password);
    const roleName = dto.role ?? 'Administrator';

    const user = await this.prisma.user.create({
      data: {
        email: dto.email.toLowerCase(),
        passwordHash,
        firstName: dto.firstName,
        lastName: dto.lastName,
        roles: {
          create: {
            role: {
              connectOrCreate: {
                where: { name: roleName },
                create: { name: roleName, description: 'Bootstrap role created during secure registration.' },
              },
            },
          },
        },
      },
      include: {
        roles: { include: { role: true } },
      },
    });

    const auth = await this.issueAuthTokens(user.id, user.email, user.roles.map((entry) => entry.role.name));
    await this.clearLoginAttempts(user.id, ipAddress);

    return {
      user: sanitizeUser(user),
      ...auth,
    };
  }

  async login(dto: LoginDto, ipAddress: string) {
    const user = await this.prisma.user.findUnique({
      where: { email: dto.email.toLowerCase() },
      include: {
        roles: {
          include: {
            role: true,
          },
        },
      },
    });

    await this.ensureAccountNotLocked(user?.id, ipAddress);

    if (!user) {
      await this.recordFailedLoginAttempt(undefined, ipAddress);
      throw new UnauthorizedException('Invalid credentials');
    }

    const ok = await verifyPassword(dto.password, user.passwordHash);
    if (!ok) {
      await this.recordFailedLoginAttempt(user.id, ipAddress);
      await this.ensureAccountNotLocked(user.id, ipAddress);
      throw new UnauthorizedException('Invalid credentials');
    }

    if (!user.isActive) {
      throw new UnauthorizedException('This login has been disabled. Contact your administrator.');
    }

    const roleNames = user.roles.map((entry) => entry.role.name);
    if (!roleNames.length) {
      throw new UnauthorizedException('Your login is not assigned to any role yet. Contact your administrator.');
    }

    await this.clearLoginAttempts(user.id, ipAddress);
    if (user.isLocked) {
      await this.prisma.user.update({ where: { id: user.id }, data: { isLocked: false } });
    }

    // If MFA is enabled, return mfaRequired flag with a pre-auth token
    if (user.mfaEnabled && user.mfaSecret) {
      const normalizedRoles2 = normalizeRoleNames(roleNames);
      const primaryRole2 = normalizedRoles2[0] ?? 'VIEWER';
      const preAuthToken = generateAccessToken({ userId: String(user.id), role: primaryRole2, email: user.email });
      return {
        user: sanitizeUser(user),
        mfaRequired: true as const,
        preAuthToken,
        token: '',
        refreshToken: '',
        roles: roleNames,
        securityRole: primaryRole2,
        workspaceRole: this.resolveWorkspaceRole(roleNames),
      };
    }

    const auth = await this.issueAuthTokens(user.id, user.email, roleNames);

    return {
      user: sanitizeUser(user),
      ...auth,
    };
  }

  async refresh(refreshToken: string) {
    const payload = verifyRefreshToken(refreshToken);
    const tokenHash = hashToken(refreshToken);

    const stored = await this.prisma.refreshToken.findUnique({
      where: { tokenHash },
      include: { user: { include: { roles: { include: { role: true } } } } },
    });

    // ── Reuse detection ────────────────────────────────────────────────────────
    // If the token hash is NOT found but there are other tokens in the same
    // family, it means this token was already rotated — possible theft/replay.
    if (!stored) {
      // Check if this looks like a replayed token by verifying the JWT is valid
      // (payload decoded successfully above means signature is valid but token
      // was already consumed — this is a reuse attack signal)
      const familyTokens = await this.prisma.refreshToken.findMany({
        where: { userId: Number(payload.userId) },
        select: { familyId: true, userId: true },
        take: 1,
      });

      if (familyTokens.length > 0) {
        // Revoke all tokens for this user as a precaution
        await this.prisma.refreshToken.deleteMany({
          where: { userId: Number(payload.userId) },
        });
        await this.prisma.user.update({
          where: { id: Number(payload.userId) },
          data: { isLocked: true },
        });
      }

      throw new UnauthorizedException('Session invalidated. Please log in again.');
    }

    // ── Expired token ──────────────────────────────────────────────────────────
    if (stored.expiresAt <= new Date()) {
      await this.prisma.refreshToken.delete({ where: { id: stored.id } });
      throw new UnauthorizedException('Session expired. Please log in again.');
    }

    // ── User ID mismatch (tampered token) ─────────────────────────────────────
    if (String(stored.userId) !== String(payload.userId)) {
      // Revoke entire family — something suspicious is happening
      await this.revokeTokenFamily(stored.familyId, stored.userId);
      throw new UnauthorizedException('Session invalidated. Please log in again.');
    }

    // ── Valid — rotate token ───────────────────────────────────────────────────
    const roleNames = stored.user.roles.map((entry) => entry.role.name);

    // Delete the used token (rotation — old token is now invalid)
    await this.prisma.refreshToken.delete({ where: { id: stored.id } });

    // Issue new tokens, preserving the familyId so reuse can be detected
    const auth = await this.issueAuthTokens(
      stored.user.id,
      stored.user.email,
      roleNames,
      stored.familyId, // preserve family for reuse detection
    );

    return {
      user: sanitizeUser(stored.user),
      ...auth,
    };
  }

  async logout(refreshToken?: string) {
    if (!refreshToken) {
      return { success: true };
    }

    const tokenHash = hashToken(refreshToken);
    await this.prisma.refreshToken.deleteMany({ where: { tokenHash } });
    return { success: true };
  }

  private async issueAuthTokens(
    userId: number,
    email: string,
    roleNames: string[],
    familyId?: string,
  ) {
    const normalizedRoles = normalizeRoleNames(roleNames);
    const primaryRole = normalizedRoles[0] ?? 'VIEWER';
    const accessToken = generateAccessToken({ userId: String(userId), role: primaryRole, email });
    const refreshToken = generateRefreshToken(String(userId));

    // familyId groups all tokens from the same login session.
    // On first login a new familyId is created; on rotation the same familyId is reused.
    const tokenFamilyId = familyId ?? crypto.randomUUID();

    await this.prisma.refreshToken.create({
      data: {
        tokenHash: hashToken(refreshToken),
        familyId: tokenFamilyId,
        userId,
        expiresAt: new Date(Date.now() + REFRESH_TOKEN_WINDOW_MS),
      },
    });

    // Prune expired tokens for this user (keep DB clean)
    await this.pruneExpiredTokens(userId);

    return {
      token: accessToken,
      refreshToken,
      roles: roleNames,
      securityRole: primaryRole,
      workspaceRole: this.resolveWorkspaceRole(roleNames),
    };
  }

  // Deletes expired refresh tokens for a user to keep the DB clean
  private async pruneExpiredTokens(userId: number): Promise<void> {
    await this.prisma.refreshToken.deleteMany({
      where: {
        userId,
        expiresAt: { lt: new Date() },
      },
    });
  }

  // Revokes ALL refresh tokens in a token family (called on theft detection)
  private async revokeTokenFamily(familyId: string, userId: number): Promise<void> {
    await this.prisma.refreshToken.deleteMany({
      where: { familyId },
    });
    // Lock the user account to force re-authentication
    await this.prisma.user.update({
      where: { id: userId },
      data: { isLocked: true },
    });
  }

  private async ensureAccountNotLocked(userId: number | undefined, ipAddress: string) {
    const windowStart = new Date(Date.now() - LOCK_WINDOW_MS);
    const attempts = await this.prisma.loginAttempt.count({
      where: {
        attemptedAt: { gte: windowStart },
        OR: [
          userId ? { userId } : undefined,
          { ipAddress },
        ].filter(Boolean) as Array<{ userId?: number; ipAddress?: string }>,
      },
    });

    if (attempts >= MAX_FAILED_ATTEMPTS) {
      if (userId) {
        await this.prisma.user.updateMany({ where: { id: userId }, data: { isLocked: true } });
      }
      throw new HttpException('Account temporarily locked. Try again in 15 minutes.', 423);
    }
  }

  private async recordFailedLoginAttempt(userId: number | undefined, ipAddress: string) {
    await this.prisma.loginAttempt.create({
      data: {
        userId,
        ipAddress,
      },
    });
  }

  private async clearLoginAttempts(userId: number, ipAddress: string) {
    await this.prisma.loginAttempt.deleteMany({
      where: {
        OR: [{ userId }, { ipAddress }],
      },
    });
  }

  private resolveWorkspaceRole(roleNames: string[]) {
    const normalized = roleNames.map((role) => role.trim().toLowerCase());

    if (normalized.some((role) => normalizeRoleName(role) === 'ADMIN')) {
      return 'admin';
    }
    if (normalized.some((role) => role.includes('cfo') || role.includes('finance director'))) {
      return 'cfo';
    }
    if (normalized.some((role) => normalizeRoleName(role) === 'FINANCE')) {
      return 'accountant';
    }
    if (normalized.some((role) => role.includes('procurement'))) {
      return 'procurement';
    }
    if (normalized.some((role) => role.includes('inventory') || role.includes('warehouse') || role.includes('store officer'))) {
      return 'inventory';
    }
    if (normalized.some((role) => normalizeRoleName(role) === 'HR')) {
      return 'hr';
    }
    if (normalized.some((role) => role.includes('ceo') || role.includes('executive'))) {
      return 'ceo';
    }

    return 'admin';
  }


  // ─── MFA: Generate setup (returns secret + otpauth URI for QR code) ──────────
  async mfaSetup(userId: number): Promise<{ secret: string; otpauthUrl: string; issuer: string }> {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user) throw new UnauthorizedException('User not found');
    if (user.mfaEnabled) throw new Error('MFA is already enabled. Disable it first before setting up again.');

    // Generate a new TOTP secret
    authenticator.options = { encoding: 'base32' };
    const secret = authenticator.generateSecret();

    // Store the secret temporarily (not yet enabled — enabled only after first verify)
    await this.prisma.user.update({
      where: { id: userId },
      data: { mfaSecret: secret, mfaEnabled: false },
    });

    const issuer = 'Haqly ERP';
    const otpauthUrl = authenticator.keyuri(user.email, issuer, secret);

    return { secret, otpauthUrl, issuer };
  }

  // ─── MFA: Verify and activate ────────────────────────────────────────────────
  async mfaActivate(userId: number, token: string): Promise<{ success: boolean }> {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user?.mfaSecret) throw new UnauthorizedException('MFA setup not initiated. Call /auth/mfa/setup first.');

    const isValid = (() => { try { return authenticator.verify({ token: token, secret: user.mfaSecret!, encoding: "base32" } as any); } catch { try { return totp.verify({ token: token, secret: user.mfaSecret!, encoding: "base32" } as any); } catch { return false; } } })();
    if (!isValid) throw new UnauthorizedException('Invalid verification code. Please try again.');

    await this.prisma.user.update({
      where: { id: userId },
      data: { mfaEnabled: true },
    });

    return { success: true };
  }

  // ─── MFA: Verify TOTP on login ───────────────────────────────────────────────
  async mfaVerifyLogin(userId: number, token: string): Promise<boolean> {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user?.mfaSecret || !user.mfaEnabled) return true; // MFA not enabled = pass through

    return (() => { try { return authenticator.verify({ token: token, secret: user.mfaSecret!, encoding: "base32" } as any); } catch { try { return totp.verify({ token: token, secret: user.mfaSecret!, encoding: "base32" } as any); } catch { return false; } } })();
  }

  // ─── MFA: Disable ────────────────────────────────────────────────────────────
  async mfaDisable(userId: number, token: string, password: string): Promise<{ success: boolean }> {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user) throw new UnauthorizedException('User not found');
    if (!user.mfaEnabled) throw new Error('MFA is not currently enabled.');

    // Verify password
    const passwordOk = await verifyPassword(password, user.passwordHash);
    if (!passwordOk) throw new UnauthorizedException('Incorrect password');

    // Verify current TOTP
    const totpOk = user.mfaSecret ? (() => { try { return authenticator.verify({ token: token, secret: user.mfaSecret!, encoding: "base32" } as any); } catch { try { return totp.verify({ token: token, secret: user.mfaSecret!, encoding: "base32" } as any); } catch { return false; } } })() : false;
    if (!totpOk) throw new UnauthorizedException('Invalid authenticator code');

    await this.prisma.user.update({
      where: { id: userId },
      data: { mfaEnabled: false, mfaSecret: null },
    });

    return { success: true };
  }

  // ─── MFA: Check if user has MFA enabled (used on login) ──────────────────────
  async mfaStatus(userId: number): Promise<{ enabled: boolean }> {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { mfaEnabled: true },
    });
    return { enabled: user?.mfaEnabled ?? false };
  }

  // ─── MFA: Verify by email — used on login before full token is issued ────────
  async mfaVerifyLoginByEmail(email: string, token: string): Promise<boolean> {
    const user = await this.prisma.user.findUnique({ where: { email: email.toLowerCase() } });
    if (!user?.mfaSecret || !user.mfaEnabled) return true;
    try {
      return authenticator.verify({ token: token, secret: user.mfaSecret!, encoding: "base32" } as any);
    } catch {
      try { return totp.verify({ token: token, secret: user.mfaSecret!, encoding: "base32" } as any); } catch { return false; }
    }
  }
}
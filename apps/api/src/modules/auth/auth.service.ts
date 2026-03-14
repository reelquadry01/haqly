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

    if (!stored || stored.expiresAt <= new Date()) {
      if (stored) {
        await this.prisma.refreshToken.delete({ where: { id: stored.id } });
      }
      throw new UnauthorizedException('Invalid refresh token');
    }

    if (String(stored.userId) !== String(payload.userId)) {
      throw new UnauthorizedException('Invalid refresh token');
    }

    const roleNames = stored.user.roles.map((entry) => entry.role.name);
    await this.prisma.refreshToken.delete({ where: { id: stored.id } });

    const auth = await this.issueAuthTokens(stored.user.id, stored.user.email, roleNames);
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

  private async issueAuthTokens(userId: number, email: string, roleNames: string[]) {
    const normalizedRoles = normalizeRoleNames(roleNames);
    const primaryRole = normalizedRoles[0] ?? 'VIEWER';
    const accessToken = generateAccessToken({ userId: String(userId), role: primaryRole, email });
    const refreshToken = generateRefreshToken(String(userId));

    await this.prisma.refreshToken.create({
      data: {
        tokenHash: hashToken(refreshToken),
        userId,
        expiresAt: new Date(Date.now() + REFRESH_TOKEN_WINDOW_MS),
      },
    });

    return {
      token: accessToken,
      refreshToken,
      roles: roleNames,
      securityRole: primaryRole,
      workspaceRole: this.resolveWorkspaceRole(roleNames),
    };
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
}

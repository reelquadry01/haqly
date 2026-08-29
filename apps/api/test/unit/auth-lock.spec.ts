import { HttpException, UnauthorizedException } from '@nestjs/common';
import { AuthService } from '../../src/modules/auth/auth.service';

/**
 * user.isLocked marks an account the system has stopped trusting — it is set
 * when refresh-token reuse is detected, which signals a stolen session. It used
 * to be cleared by any successful login, so whoever held the password could
 * erase the alarm. These tests pin the flag's meaning: only an administrator
 * clears it, and every path that mints tokens honours it.
 */
describe('AuthService account locking', () => {
  const activeUser = {
    id: 1,
    email: 'user@example.com',
    isActive: true,
    isLocked: false,
    roles: [{ role: { name: 'SuperAdmin' } }],
  };

  let prisma: any;
  let svc: AuthService;

  beforeEach(() => {
    prisma = {
      user: { findUnique: jest.fn(), update: jest.fn(), updateMany: jest.fn() },
      loginAttempt: { count: jest.fn().mockResolvedValue(0), create: jest.fn(), deleteMany: jest.fn() },
      refreshToken: { findUnique: jest.fn(), create: jest.fn(), delete: jest.fn(), deleteMany: jest.fn(), findMany: jest.fn() },
    };
    svc = new AuthService(prisma);
  });

  const gate = (user: Partial<typeof activeUser>) =>
    // assertUserMayAuthenticate is private but is the single gate all three
    // token-minting paths share, so it is worth testing directly.
    (svc as any).assertUserMayAuthenticate({ ...activeUser, ...user });

  it('allows an active, unlocked account', () => {
    expect(() => gate({})).not.toThrow();
  });

  it('refuses a locked account with 423 rather than letting it through', () => {
    expect(() => gate({ isLocked: true })).toThrow(HttpException);
    try {
      gate({ isLocked: true });
    } catch (error) {
      expect((error as HttpException).getStatus()).toBe(423);
    }
  });

  it('refuses a deactivated account', () => {
    expect(() => gate({ isActive: false })).toThrow(UnauthorizedException);
  });

  it('does not set the persistent lock for ordinary failed attempts', async () => {
    // Brute force is throttled by a time window that expires on its own. Writing
    // isLocked here would conflate it with a security lock and demand an admin
    // to clear what should clear itself.
    prisma.loginAttempt.count.mockResolvedValue(99);

    await expect((svc as any).ensureAccountNotLocked(1, '10.0.0.1')).rejects.toThrow(HttpException);
    expect(prisma.user.updateMany).not.toHaveBeenCalled();
    expect(prisma.user.update).not.toHaveBeenCalled();
  });

  it('lets a login through while the attempt window is clear', async () => {
    prisma.loginAttempt.count.mockResolvedValue(0);
    await expect((svc as any).ensureAccountNotLocked(1, '10.0.0.1')).resolves.toBeUndefined();
  });
});

import type { User } from '@prisma/client';

export function sanitizeUser<T extends Partial<User> & Record<string, unknown>>(user: T | null | undefined) {
  if (!user) {
    return user;
  }

  const rawSafeUser = {
    ...user,
  } as Record<string, unknown> & { roles?: unknown[] };

  const {
    passwordHash: _passwordHash,
    // The TOTP shared secret is a credential, not profile data. Anyone who reads
    // it can mint valid codes indefinitely, so it must never leave the server —
    // /auth/mfa/setup returns a freshly generated secret on its own dedicated
    // response, which is the only time the client is meant to see one.
    mfaSecret: _mfaSecret,
    mfaBackupCodes: _mfaBackupCodes,
    passwordResetToken: _passwordResetToken,
    sessions: _sessions,
    refreshTokens: _refreshTokens,
    loginAttempts: _loginAttempts,
    ...safeUser
  } = rawSafeUser;

  if (Array.isArray(safeUser.roles)) {
    safeUser.roles = safeUser.roles.map((entry) => {
      if (entry && typeof entry === 'object' && 'role' in entry) {
        const role = (entry as { role?: { id?: number; name?: string; description?: string } }).role;
        return role
          ? {
              id: role.id,
              name: role.name,
              description: role.description,
            }
          : entry;
      }
      return entry;
    });
  }

  return safeUser;
}

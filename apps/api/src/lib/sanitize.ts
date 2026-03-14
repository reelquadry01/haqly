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

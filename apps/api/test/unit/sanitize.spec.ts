import { sanitizeUser } from '../../src/lib/sanitize';

describe('sanitizeUser', () => {
  const rawUser = {
    id: 1,
    email: 'admin@example.com',
    firstName: 'System',
    lastName: 'Administrator',
    isActive: true,
    isLocked: false,
    mfaEnabled: true,
    passwordHash: '$2b$10$notarealhash',
    mfaSecret: 'JBSWY3DPEHPK3PXP',
    createdAt: new Date(),
    updatedAt: new Date(),
  } as never;

  it('strips every credential field from the user payload', () => {
    const safe = sanitizeUser(rawUser) as Record<string, unknown>;

    // mfaSecret is the TOTP shared secret: anyone who reads it can mint valid
    // codes forever, which would make the second factor worthless.
    expect(safe).not.toHaveProperty('mfaSecret');
    expect(safe).not.toHaveProperty('passwordHash');
    expect(JSON.stringify(safe)).not.toContain('JBSWY3DPEHPK3PXP');
    expect(JSON.stringify(safe)).not.toContain('notarealhash');
  });

  it('keeps the non-sensitive profile fields the client needs', () => {
    const safe = sanitizeUser(rawUser) as Record<string, unknown>;

    expect(safe.id).toBe(1);
    expect(safe.email).toBe('admin@example.com');
    // Whether MFA is on is not a secret — the UI needs it to render the prompt.
    expect(safe.mfaEnabled).toBe(true);
  });

  it('flattens role relations without leaking the join rows', () => {
    const safe = sanitizeUser({
      ...(rawUser as object),
      roles: [{ userId: 1, roleId: 2, role: { id: 2, name: 'SuperAdmin', description: 'Full access' } }],
    } as never) as Record<string, unknown>;

    expect(safe.roles).toEqual([{ id: 2, name: 'SuperAdmin', description: 'Full access' }]);
  });

  it('passes null and undefined through untouched', () => {
    expect(sanitizeUser(null)).toBeNull();
    expect(sanitizeUser(undefined)).toBeUndefined();
  });
});

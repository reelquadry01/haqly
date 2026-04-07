jest.mock('../../src/lib/tokens', () => ({
  generateAccessToken: jest.fn(() => 'access-token'),
  generateRefreshToken: jest.fn(() => 'rotated-refresh-token'),
  hashToken: jest.fn((token: string) => `hash:${token}`),
  verifyRefreshToken: jest.fn(() => ({ userId: '7', type: 'refresh' })),
}));

import { AuthService } from '../../src/modules/auth/auth.service';

describe('AuthService', () => {
  it('refreshes a session even when the stored token family is null', async () => {
    const prismaMock: any = {
      refreshToken: {
        findUnique: jest.fn().mockResolvedValue({
          id: 99,
          tokenHash: 'hash:refresh-token',
          userId: 7,
          familyId: null,
          expiresAt: new Date(Date.now() + 60_000),
          user: {
            id: 7,
            email: 'admin@example.com',
            firstName: 'Admin',
            lastName: 'User',
            isActive: true,
            roles: [{ role: { name: 'Administrator' } }],
          },
        }),
        delete: jest.fn().mockResolvedValue(undefined),
        create: jest.fn().mockResolvedValue({ id: 100 }),
        deleteMany: jest.fn().mockResolvedValue({ count: 0 }),
        findMany: jest.fn().mockResolvedValue([]),
      },
      loginAttempt: {
        deleteMany: jest.fn().mockResolvedValue({ count: 0 }),
        count: jest.fn().mockResolvedValue(0),
        create: jest.fn().mockResolvedValue(undefined),
      },
      user: {
        update: jest.fn().mockResolvedValue(undefined),
      },
    };

    const service = new AuthService(prismaMock);

    const result = await service.refresh('refresh-token');

    expect(prismaMock.refreshToken.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          userId: 7,
          familyId: expect.any(String),
        }),
      }),
    );
    expect(result.refreshToken).toBe('rotated-refresh-token');
    expect(result.workspaceRole).toBe('admin');
  });
});

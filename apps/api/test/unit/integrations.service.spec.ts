import { IntegrationsService } from '../../src/modules/integrations/integrations.service';

describe('IntegrationsService', () => {
  it('passes JSON-like config objects through create and update', async () => {
    const prismaMock: any = {
      company: {
        findUnique: jest.fn().mockResolvedValue({ id: 5 }),
      },
      integration: {
        create: jest.fn().mockImplementation(async ({ data }: any) => ({ id: 1, ...data })),
        findUnique: jest.fn().mockResolvedValue({ id: 1 }),
        update: jest.fn().mockImplementation(async ({ data }: any) => ({ id: 1, ...data })),
      },
    };
    const service = new IntegrationsService(prismaMock);

    const created = await service.create({
      companyId: 5,
      provider: 'firs',
      label: 'FIRS Connector',
      config: { baseUrl: 'https://example.com', retries: 2 },
    });
    const updated = await service.update(1, {
      config: { mode: 'sandbox' },
      isActive: true,
    });

    expect(prismaMock.integration.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          config: { baseUrl: 'https://example.com', retries: 2 },
        }),
      }),
    );
    expect(prismaMock.integration.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          config: { mode: 'sandbox' },
          isActive: true,
        }),
      }),
    );
    expect(created.provider).toBe('FIRS');
    expect(updated.isActive).toBe(true);
  });
});

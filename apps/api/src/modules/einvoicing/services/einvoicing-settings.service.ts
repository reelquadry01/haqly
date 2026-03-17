import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../../prisma/prisma.service';
import { UpsertEInvoiceProfileDto } from '../dto/upsert-einvoice-profile.dto';
import { SaveEInvoiceCredentialsDto } from '../dto/save-einvoice-credentials.dto';

@Injectable()
export class EInvoicingSettingsService {
  constructor(private readonly prisma: PrismaService) {}

  async getProfile(companyId: number) {
    return this.prisma.eInvoiceProfile.findUnique({
      where: { companyId },
      include: {
        credentials: true,
      },
    });
  }

  async upsertProfile(dto: UpsertEInvoiceProfileDto) {
    return this.prisma.eInvoiceProfile.upsert({
      where: { companyId: dto.companyId },
      update: {
        tin: dto.tin,
        legalName: dto.legalName,
        tradeName: dto.tradeName,
        businessEmail: dto.businessEmail,
        businessPhone: dto.businessPhone,
        countryCode: dto.countryCode ?? 'NG',
        state: dto.state,
        city: dto.city,
        addressLine1: dto.addressLine1,
        addressLine2: dto.addressLine2,
        postalCode: dto.postalCode,
        peppolEnabled: dto.peppolEnabled ?? false,
        defaultCurrencyCode: dto.defaultCurrencyCode ?? 'NGN',
        accessPointProviderName: dto.accessPointProviderName,
        accessPointProviderCode: dto.accessPointProviderCode,
        isEnabled: dto.isEnabled ?? false,
        environment: dto.environment ?? 'SANDBOX',
      },
      create: {
        companyId: dto.companyId,
        tin: dto.tin,
        legalName: dto.legalName,
        tradeName: dto.tradeName,
        businessEmail: dto.businessEmail,
        businessPhone: dto.businessPhone,
        countryCode: dto.countryCode ?? 'NG',
        state: dto.state,
        city: dto.city,
        addressLine1: dto.addressLine1,
        addressLine2: dto.addressLine2,
        postalCode: dto.postalCode,
        peppolEnabled: dto.peppolEnabled ?? false,
        defaultCurrencyCode: dto.defaultCurrencyCode ?? 'NGN',
        accessPointProviderName: dto.accessPointProviderName,
        accessPointProviderCode: dto.accessPointProviderCode,
        isEnabled: dto.isEnabled ?? false,
        environment: dto.environment ?? 'SANDBOX',
      },
    });
  }

  async saveCredentials(dto: SaveEInvoiceCredentialsDto) {
    return this.prisma.eInvoiceCredential.create({
      data: {
        companyId: dto.companyId,
        profileId: dto.profileId,
        apiKeyEncrypted: dto.apiKeyEncrypted,
        apiKeyLast4: dto.apiKeyLast4,
        cryptoPrivateKeyEncrypted: dto.cryptoPrivateKeyEncrypted,
        cryptoPublicKey: dto.cryptoPublicKey,
        keyName: dto.keyName,
        keyFingerprint: dto.keyFingerprint,
        keyCreatedAt: dto.keyCreatedAt ? new Date(dto.keyCreatedAt) : undefined,
        keyExpiresAt: dto.keyExpiresAt ? new Date(dto.keyExpiresAt) : undefined,
        createdBy: dto.createdBy,
        updatedBy: dto.updatedBy,
      },
    });
  }

  async getCredentialStatus(companyId: number) {
    const profile = await this.prisma.eInvoiceProfile.findUnique({
      where: { companyId },
      include: {
        credentials: {
          orderBy: { createdAt: 'desc' },
          take: 1,
        },
      },
    });

    if (!profile) {
      return {
        profileExists: false,
        apiKeyPresent: false,
        cryptoKeyPresent: false,
      };
    }

    const latest = profile.credentials[0];

    return {
      profileExists: true,
      apiKeyPresent: !!latest?.apiKeyEncrypted,
      cryptoKeyPresent: !!latest?.cryptoPrivateKeyEncrypted,
      latestCredentialId: latest?.id ?? null,
      environment: profile.environment,
      isEnabled: profile.isEnabled,
    };
  }

  async getReadiness(companyId: number) {
    const profile = await this.prisma.eInvoiceProfile.findUnique({
      where: { companyId },
      include: {
        credentials: {
          orderBy: { createdAt: 'desc' },
          take: 1,
        },
      },
    });

    const latest = profile?.credentials?.[0];

    const checks = {
      profileComplete: !!(profile?.tin && profile?.legalName),
      accessPointSelected: !!(profile?.accessPointProviderName || profile?.accessPointProviderCode),
      apiKeyPresent: !!latest?.apiKeyEncrypted,
      cryptoKeyPresent: !!latest?.cryptoPrivateKeyEncrypted,
      invoiceSequenceConfigured: true,
    };

    return {
      ready: Object.values(checks).every(Boolean),
      checks,
      missing: Object.entries(checks)
        .filter(([_, value]) => !value)
        .map(([key]) => key),
    };
  }
}

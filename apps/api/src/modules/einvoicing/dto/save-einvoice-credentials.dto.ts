export class SaveEInvoiceCredentialsDto {
  companyId!: number;
  profileId!: number;
  apiKeyEncrypted?: string;
  apiKeyLast4?: string;
  cryptoPrivateKeyEncrypted?: string;
  cryptoPublicKey?: string;
  keyName?: string;
  keyFingerprint?: string;
  keyCreatedAt?: string;
  keyExpiresAt?: string;
  createdBy?: number;
  updatedBy?: number;
}

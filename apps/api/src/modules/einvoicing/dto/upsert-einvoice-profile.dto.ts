export class UpsertEInvoiceProfileDto {
  companyId!: number;
  tin!: string;
  legalName!: string;
  tradeName?: string;
  businessEmail?: string;
  businessPhone?: string;
  countryCode?: string;
  state?: string;
  city?: string;
  addressLine1?: string;
  addressLine2?: string;
  postalCode?: string;
  peppolEnabled?: boolean;
  defaultCurrencyCode?: string;
  accessPointProviderName?: string;
  accessPointProviderCode?: string;
  isEnabled?: boolean;
  environment?: 'SANDBOX' | 'PRODUCTION';
}

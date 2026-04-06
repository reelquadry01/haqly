import { Injectable } from '@nestjs/common';

export type GatewayResult = {
  providerName: string;
  providerReference: string;
  providerStatus: 'PROCESSING' | 'PAID' | 'FAILED' | 'REVERSED';
  providerMessage: string;
  rawResponseJson?: Record<string, unknown>;
};

export type GatewayPayload = {
  providerName?: string;
  paymentChannel?: string;
  voucherNumber: string;
  beneficiaryName: string;
  amount: number;
  currencyCode: string;
  bankAccountNumber?: string | null;
  bankName?: string | null;
};

@Injectable()
export class PaymentGatewayService {
  async validateBeneficiary(payload: GatewayPayload) {
    if (!payload.bankAccountNumber) {
      return {
        valid: false,
        message: 'Beneficiary bank details are incomplete.',
      };
    }

    return {
      valid: true,
      message: 'Beneficiary details validated.',
    };
  }

  async initiatePayment(payload: GatewayPayload): Promise<GatewayResult> {
    const providerName = (payload.providerName || payload.paymentChannel || 'MANUAL').toUpperCase();
    const providerReference = `${providerName}-${Date.now()}`;

    if (providerName === 'MANUAL_TRANSFER' || providerName === 'MANUAL') {
      return {
        providerName,
        providerReference,
        providerStatus: 'PROCESSING',
        providerMessage: 'Manual transfer initiated. Awaiting treasury confirmation.',
        rawResponseJson: {
          mode: 'manual',
          voucherNumber: payload.voucherNumber,
        },
      };
    }

    if (providerName === 'PAYSTACK' || providerName === 'FLUTTERWAVE' || providerName === 'BANK_API') {
      return {
        providerName,
        providerReference,
        providerStatus: 'PROCESSING',
        providerMessage: `${providerName} accepted the payment instruction for processing.`,
        rawResponseJson: {
          mode: 'stubbed-gateway',
          providerName,
          voucherNumber: payload.voucherNumber,
          amount: payload.amount,
          currencyCode: payload.currencyCode,
        },
      };
    }

    return {
      providerName,
      providerReference,
      providerStatus: 'FAILED',
      providerMessage: `Payment provider ${providerName} is not configured.`,
      rawResponseJson: {
        mode: 'unsupported-provider',
        providerName,
      },
    };
  }

  async checkPaymentStatus(reference: string) {
    const providerName = reference.split('-')[0] ?? 'UNKNOWN';
    return {
      providerName,
      providerReference: reference,
      providerStatus: 'PROCESSING' as const,
      providerMessage: `Status check for ${providerName} is not yet connected to a live provider. Current status remains PROCESSING.`,
      rawResponseJson: { mode: 'status-stub', providerReference: reference },
    };
  }

  async retryPayment(payload: GatewayPayload) {
    return this.initiatePayment(payload);
  }

  async reversePayment(reference: string) {
    const providerName = reference.split('-')[0] ?? 'UNKNOWN';
    return {
      providerName,
      providerReference: reference,
      providerStatus: 'REVERSED' as const,
      providerMessage: `Reversal recorded for ${providerName}. Connect a live provider to execute the actual reversal with the bank.`,
      rawResponseJson: { mode: 'reversal-stub', providerReference: reference },
    };
  }
}

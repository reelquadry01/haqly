import { z } from 'zod';

export const transactionSchema = z.object({
  amount: z.number().positive(),
  description: z.string().trim().min(1).max(255),
  category: z.enum(['REVENUE', 'EXPENSE', 'ASSET', 'LIABILITY', 'EQUITY', 'PAYROLL', 'INVENTORY', 'TAX']),
});

export type TransactionInput = z.infer<typeof transactionSchema>;

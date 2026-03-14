import { z } from 'zod';

export const userCreationSchema = z.object({
  email: z.string().email(),
  password: z
    .string()
    .min(8)
    .regex(/[A-Z]/, 'Password must contain at least one uppercase letter.')
    .regex(/[0-9]/, 'Password must contain at least one number.')
    .regex(/[^A-Za-z0-9]/, 'Password must contain at least one special character.'),
  role: z.enum(['ADMIN', 'FINANCE', 'HR', 'WAREHOUSE', 'VIEWER']),
  firstName: z.string().trim().min(1).max(100).optional(),
  lastName: z.string().trim().min(1).max(100).optional(),
});

export type UserCreationInput = z.infer<typeof userCreationSchema>;

import { z } from 'zod';

const envSchema = z.object({
  DATABASE_URL: z
    .string()
    .min(1, 'DATABASE_URL is required')
    .refine(
      (value) => process.env.NODE_ENV === 'production' ? value.includes('sslmode=require') : true,
      'DATABASE_URL must include sslmode=require in production.',
    ),
  ACCESS_TOKEN_SECRET: z.string().min(32, 'ACCESS_TOKEN_SECRET must be at least 32 characters long.'),
  REFRESH_TOKEN_SECRET: z.string().min(32, 'REFRESH_TOKEN_SECRET must be at least 32 characters long.'),
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  PORT: z.coerce.number().int().min(1).max(65535).default(3000),
  ALLOWED_ORIGINS: z.string().min(1, 'ALLOWED_ORIGINS is required.'),
});

export type AppEnv = z.infer<typeof envSchema> & {
  ALLOWED_ORIGIN_LIST: string[];
};

export function validateEnv(input: NodeJS.ProcessEnv): AppEnv {
  const parsed = envSchema.safeParse(input);

  if (!parsed.success) {
    const details = parsed.error.issues.map((issue) => `${issue.path.join('.')}: ${issue.message}`).join('\n');
    throw new Error(`Environment validation failed:\n${details}`);
  }

  const origins = parsed.data.ALLOWED_ORIGINS.split(',')
    .map((value) => value.trim())
    .filter(Boolean);

  if (!origins.length) {
    throw new Error('Environment validation failed:\nALLOWED_ORIGINS must contain at least one origin.');
  }

  return {
    ...parsed.data,
    ALLOWED_ORIGIN_LIST: origins,
  };
}

export const env = validateEnv(process.env);

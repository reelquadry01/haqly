import { validateEnv } from './env';

export const validationSchema = {
  validate: (config: Record<string, unknown>) => validateEnv(config as NodeJS.ProcessEnv),
};

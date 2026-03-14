import { env } from './env';

export default () => ({
  port: env.PORT,
  databaseUrl: env.DATABASE_URL,
  accessToken: {
    secret: env.ACCESS_TOKEN_SECRET,
    expiresIn: '15m',
  },
  refreshToken: {
    secret: env.REFRESH_TOKEN_SECRET,
    expiresIn: '7d',
  },
  allowedOrigins: env.ALLOWED_ORIGIN_LIST,
});

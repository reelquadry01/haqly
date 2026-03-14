import pino from 'pino';

export const logger = pino({
  level: process.env.NODE_ENV === 'development' ? 'debug' : 'info',
  base: undefined,
  redact: {
    paths: [
      'req.headers.authorization',
      'req.headers.cookie',
      'req.body',
      'password',
      'passwordHash',
      'refreshToken',
      'token',
    ],
    censor: '[Redacted]',
  },
  transport:
    process.env.NODE_ENV === 'development'
      ? {
          target: 'pino-pretty',
          options: {
            colorize: true,
            translateTime: 'SYS:standard',
          },
        }
      : undefined,
});

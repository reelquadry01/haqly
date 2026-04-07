// Load .env before any other modules (env.ts validates at import time)
// eslint-disable-next-line @typescript-eslint/no-require-imports
require('dotenv').config();
import { ValidationPipe, VersioningType } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import cookieParser from 'cookie-parser';
import cors from 'cors';
import rateLimit from 'express-rate-limit';
import helmet from 'helmet';
import pinoHttp from 'pino-http';
import type { Request, Response, NextFunction } from 'express';
import express from 'express';
import path from 'path';
import { AppModule } from './app.module';
import { env } from './config/env';
import { logger } from './lib/logger';

async function bootstrap() {
  const app = await NestFactory.create(AppModule, {
    bufferLogs: true,
  });

  app.use(
    pinoHttp({
      logger,
      customProps: (req) => ({
        userId: (req as Request & { user?: { userId?: number } }).user?.userId,
        ip: (req as Request).ip,
      }),
      serializers: {
        req(req) {
          const request = req as Request;
          return {
            method: req.method,
            url: req.url,
            ip: request.ip,
          };
        },
        res(res) {
          return {
            statusCode: res.statusCode,
          };
        },
      },
    }),
  );

  app.use(
    helmet({
      contentSecurityPolicy: {
        directives: {
          defaultSrc: ["'self'"],
          frameAncestors: ["'none'"],
          objectSrc: ["'none'"],
          upgradeInsecureRequests: env.NODE_ENV === 'production' ? [] : null,
        },
      },
      frameguard: { action: 'deny' },
      noSniff: true,
      hsts:
        env.NODE_ENV === 'production'
          ? {
              maxAge: 31536000,
              includeSubDomains: true,
              preload: true,
            }
          : false,
    }),
  );

  app.use((req: Request, res: Response, next: NextFunction) => {
    if (env.NODE_ENV === 'production' && req.headers['x-forwarded-proto'] !== 'https') {
      return res.redirect(`https://${req.headers.host}${req.originalUrl}`);
    }
    next();
  });

  app.use(cookieParser());
  app.use('/uploads', express.static(path.join(process.cwd(), 'uploads')));
  const corsDelegate = (origin: string | undefined, callback: (err: Error | null, allow?: boolean) => void) => {
    if (!origin || env.ALLOWED_ORIGIN_LIST.includes(origin)) {
      callback(null, true);
      return;
    }
    callback(new Error('Origin not allowed by CORS policy.'));
  };

  app.use(
    cors({
      origin: corsDelegate,
      credentials: true,
    }),
  );

  const globalLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 100,
    standardHeaders: true,
    legacyHeaders: false,
    handler: (_req, res) => {
      res.status(429).json({ error: 'Too many requests. Slow down.' });
    },
  });

  const authLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 10,
    standardHeaders: true,
    legacyHeaders: false,
    handler: (_req, res) => {
      res.status(429).json({ error: 'Too many requests. Slow down.' });
    },
  });

  app.use(globalLimiter);
  app.use('/api/v1/auth/login', authLimiter);
  app.use('/api/v1/auth/register', authLimiter);
  app.use('/api/v1/auth/refresh', authLimiter);

  app.setGlobalPrefix('api');
  app.enableVersioning({ type: VersioningType.URI, defaultVersion: '1' });
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
      forbidUnknownValues: true,
    }),
  );

  await app.listen(env.PORT);
  logger.info({ port: env.PORT }, 'API listening');
}

bootstrap();

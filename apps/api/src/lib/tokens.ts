import crypto from 'crypto';
import jwt, { type JwtPayload } from 'jsonwebtoken';
import { env } from '../config/env';
import type { SecurityRole } from '../config/roles';

export type AccessTokenPayload = JwtPayload & {
  userId: string;
  role: SecurityRole;
  email?: string;
};

export type RefreshTokenPayload = JwtPayload & {
  userId: string;
  type: 'refresh';
};

export function generateAccessToken(payload: { userId: string; role: SecurityRole; email?: string }): string {
  return jwt.sign(payload, env.ACCESS_TOKEN_SECRET, { expiresIn: '15m' });
}

export function generateRefreshToken(userId: string): string {
  return jwt.sign({ userId, type: 'refresh' }, env.REFRESH_TOKEN_SECRET, { expiresIn: '7d' });
}

export function verifyAccessToken(token: string): AccessTokenPayload {
  return jwt.verify(token, env.ACCESS_TOKEN_SECRET) as AccessTokenPayload;
}

export function verifyRefreshToken(token: string): RefreshTokenPayload {
  return jwt.verify(token, env.REFRESH_TOKEN_SECRET) as RefreshTokenPayload;
}

export function hashToken(token: string): string {
  return crypto.createHash('sha256').update(token).digest('hex');
}

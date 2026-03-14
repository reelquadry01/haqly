import { CanActivate, ExecutionContext, Injectable, UnauthorizedException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { AuthGuard } from '@nestjs/passport';
import type { Request } from 'express';
import { IS_PUBLIC_KEY } from './public';

export type AuthenticatedUser = {
  userId: number;
  email: string;
  role: string;
  roles: string[];
};

@Injectable()
export class JwtAuthGuard extends AuthGuard('jwt') implements CanActivate {
  constructor(private readonly reflector: Reflector) {
    super();
  }

  canActivate(context: ExecutionContext) {
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [context.getHandler(), context.getClass()]);
    if (isPublic) {
      return true;
    }
    return super.canActivate(context);
  }

  handleRequest<TUser = AuthenticatedUser>(err: unknown, user: AuthenticatedUser | false): TUser {
    if (err || !user) {
      throw new UnauthorizedException({ error: 'Unauthorized' });
    }
    return user as TUser;
  }
}

export function getRequestIp(request: Request) {
  return request.ip || request.socket.remoteAddress || 'unknown';
}

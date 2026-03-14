import { CanActivate, ExecutionContext, ForbiddenException, Injectable, SetMetadata } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import type { SecurityRole } from '../config/roles';

export const ROLES_KEY = 'requiredRoles';
export const RequireRole = (...roles: SecurityRole[]) => SetMetadata(ROLES_KEY, roles);

@Injectable()
export class RolesGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const requiredRoles = this.reflector.getAllAndOverride<SecurityRole[]>(ROLES_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);

    if (!requiredRoles?.length) {
      return true;
    }

    const request = context.switchToHttp().getRequest();
    const user = request.user as { role?: SecurityRole } | undefined;
    if (!user?.role || !requiredRoles.includes(user.role)) {
      throw new ForbiddenException({ error: 'Access denied. Insufficient permissions.' });
    }

    return true;
  }
}

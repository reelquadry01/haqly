import { CanActivate, ExecutionContext, ForbiddenException, Injectable } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { PERMISSIONS_KEY } from './permissions.decorator';
import { PermissionsService } from './permissions.service';

@Injectable()
export class PermissionsGuard implements CanActivate {
  constructor(private reflector: Reflector, private perms: PermissionsService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const required = this.reflector.getAllAndOverride<string[]>(PERMISSIONS_KEY, [context.getHandler(), context.getClass()]);
    if (!required?.length) {
      return true;
    }

    const request = context.switchToHttp().getRequest();
    const user = request.user as { userId: number } | undefined;
    if (!user?.userId) {
      return false;
    }

    const codes = await this.perms.listUserPermissionCodes(user.userId);
    const allowed = required.some((code) => codes.includes(code));
    if (!allowed) {
      throw new ForbiddenException('Insufficient permissions');
    }
    return true;
  }
}

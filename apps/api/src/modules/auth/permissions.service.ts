import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';

@Injectable()
export class PermissionsService {
  constructor(private prisma: PrismaService) {}

  async listUserPermissionCodes(userId: number): Promise<string[]> {
    const roles = await this.prisma.userRole.findMany({
      where: { userId },
      include: { role: { include: { permissions: { include: { permission: true } } } } },
    });
    const codes = new Set<string>();
    roles.forEach((r) => {
      r.role.permissions.forEach((rp) => codes.add(rp.permission.code));
    });
    return Array.from(codes);
  }
}


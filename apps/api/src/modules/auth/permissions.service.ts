import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';

@Injectable()
export class PermissionsService {
  constructor(private prisma: PrismaService) {}

  async listUserPermissionCodes(userId: number | string): Promise<string[]> {
    const numericUserId = Number(userId);

    const roles = await this.prisma.userRole.findMany({
      where: { userId: numericUserId },
      include: {
        role: {
          include: {
            permissions: {
              include: {
                permission: true,
              },
            },
          },
        },
      },
    });

    return roles.flatMap((userRole) =>
      userRole.role.permissions.map((rp) => rp.permission.code),
    );
  }
}

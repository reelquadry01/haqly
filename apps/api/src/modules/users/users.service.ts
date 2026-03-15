import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { CreateUserDto, UpdateUserDto, ResetPasswordDto } from './users.dto';
import { hashPassword } from '../../lib/password';
import { sanitizeUser } from '../../lib/sanitize';

@Injectable()
export class UsersService {
  constructor(private prisma: PrismaService) {}

  async list() {
    const users = await this.prisma.user.findMany({
      orderBy: { id: 'desc' },
      include: { roles: { include: { role: true } } },
    });
    return users.map((user) => ({
      ...sanitizeUser(user),
      roles: user.roles.map((r) => r.role.name),
    }));
  }

  async get(id: number) {
    const user = await this.prisma.user.findUnique({
      where: { id },
      include: { roles: { include: { role: true } } },
    });
    if (!user) throw new NotFoundException('User not found');
    return {
      ...sanitizeUser(user),
      roles: user.roles.map((r) => r.role.name),
    };
  }

  async create(dto: CreateUserDto) {
    const existing = await this.prisma.user.findUnique({ where: { email: dto.email.toLowerCase() } });
    if (existing) throw new BadRequestException('A user with this email already exists.');

    const passwordHash = await hashPassword(dto.password);
    const user = await this.prisma.user.create({
      data: {
        email: dto.email.toLowerCase(),
        passwordHash,
        firstName: dto.firstName,
        lastName: dto.lastName,
        isActive: dto.isActive ?? true,
        roles: {
          create: {
            role: {
              connectOrCreate: {
                where: { name: dto.role ?? 'Viewer' },
                create: {
                  name: dto.role ?? 'Viewer',
                  description: 'Role provisioned during user creation.',
                },
              },
            },
          },
        },
      },
      include: { roles: { include: { role: true } } },
    });

    return {
      ...sanitizeUser(user),
      roles: user.roles.map((r) => r.role.name),
    };
  }

  async update(id: number, dto: UpdateUserDto) {
    await this.get(id);

    // Check email uniqueness if email is being changed
    if (dto.email) {
      const existing = await this.prisma.user.findUnique({ where: { email: dto.email.toLowerCase() } });
      if (existing && existing.id !== id) {
        throw new BadRequestException('This email is already in use by another account.');
      }
    }

    const data: Record<string, unknown> = {};
    if (dto.firstName !== undefined) data.firstName = dto.firstName;
    if (dto.lastName !== undefined) data.lastName = dto.lastName;
    if (dto.isActive !== undefined) data.isActive = dto.isActive;
    if (dto.email !== undefined) data.email = dto.email.toLowerCase();

    const user = await this.prisma.user.update({
      where: { id },
      data,
      include: { roles: { include: { role: true } } },
    });

    return {
      ...sanitizeUser(user),
      roles: user.roles.map((r) => r.role.name),
    };
  }

  async resetPassword(id: number, dto: ResetPasswordDto) {
    await this.get(id);
    const passwordHash = await hashPassword(dto.password);

    // Revoke all existing refresh tokens so user must log in again
    await this.prisma.refreshToken.deleteMany({ where: { userId: id } });

    const user = await this.prisma.user.update({
      where: { id },
      data: { passwordHash },
      include: { roles: { include: { role: true } } },
    });

    return {
      ...sanitizeUser(user),
      roles: user.roles.map((r) => r.role.name),
      message: 'Password reset successfully. All existing sessions for this user have been revoked.',
    };
  }

  async remove(id: number) {
    await this.get(id);

    // Revoke all sessions first
    await this.prisma.refreshToken.deleteMany({ where: { userId: id } });

    // Soft delete — deactivate and anonymise rather than hard delete
    // to preserve audit trail integrity
    const user = await this.prisma.user.update({
      where: { id },
      data: {
        isActive: false,
        isLocked: true,
        email: `deleted_${id}_${Date.now()}@removed.invalid`,
      },
    });

    return {
      id: user.id,
      message: 'User deactivated and removed from the active directory.',
    };
  }
}
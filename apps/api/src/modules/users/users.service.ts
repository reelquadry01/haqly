import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { CreateUserDto, UpdateUserDto } from './users.dto';
import { hashPassword } from '../../lib/password';
import { sanitizeUser } from '../../lib/sanitize';

@Injectable()
export class UsersService {
  constructor(private prisma: PrismaService) {}

  async list() {
    const users = await this.prisma.user.findMany({ orderBy: { id: 'desc' } });
    return users.map((user) => sanitizeUser(user));
  }

  async get(id: number) {
    const user = await this.prisma.user.findUnique({ where: { id } });
    if (!user) throw new NotFoundException('User not found');
    return sanitizeUser(user);
  }

  async create(dto: CreateUserDto) {
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
    });

    return sanitizeUser(user);
  }

  async update(id: number, dto: UpdateUserDto) {
    await this.get(id);
    const user = await this.prisma.user.update({ where: { id }, data: dto });
    return sanitizeUser(user);
  }
}

import { Body, Controller, Get, Param, ParseIntPipe, Patch, Post, UseGuards } from '@nestjs/common';
import { UsersService } from './users.service';
import { CreateUserDto, UpdateUserDto } from './users.dto';
import { JwtAuthGuard } from '../auth/jwt.guard';
import { PermissionsGuard } from '../auth/permissions.guard';
import { RequirePermissions } from '../auth/permissions.decorator';
import { RequireRole, RolesGuard } from '../../middleware/rbac';

@UseGuards(JwtAuthGuard, RolesGuard, PermissionsGuard)
@RequireRole('ADMIN')
@Controller({ path: 'users', version: '1' })
export class UsersController {
  constructor(private readonly users: UsersService) {}

  @Get()
  @RequirePermissions('users:view')
  list() {
    return this.users.list();
  }

  @Get(':id')
  @RequirePermissions('users:view')
  get(@Param('id', ParseIntPipe) id: number) {
    return this.users.get(id);
  }

  @Post()
  @RequirePermissions('users:create')
  create(@Body() dto: CreateUserDto) {
    return this.users.create(dto);
  }

  @Patch(':id')
  @RequirePermissions('users:update')
  update(@Param('id', ParseIntPipe) id: number, @Body() dto: UpdateUserDto) {
    return this.users.update(id, dto);
  }
}



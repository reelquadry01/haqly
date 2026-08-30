import { Controller, Get, Param, ParseIntPipe, Post, Query, Req, UseGuards } from '@nestjs/common';
import type { Request } from 'express';
import { JwtAuthGuard, type AuthenticatedUser } from '../../middleware/auth';
import { NotificationsService } from './notifications.service';

@UseGuards(JwtAuthGuard)
@Controller({ path: 'notifications', version: '1' })
export class NotificationsController {
  constructor(private readonly notifications: NotificationsService) {}

  @Get()
  list(@Req() req: Request, @Query('limit') limit?: string) {
    return this.notifications.listForUser(this.userId(req), limit ? Number(limit) : undefined);
  }

  @Get('unread-count')
  unreadCount(@Req() req: Request) {
    return this.notifications.unreadCount(this.userId(req));
  }

  @Post(':id/read')
  markRead(@Req() req: Request, @Param('id', ParseIntPipe) id: number) {
    return this.notifications.markRead(this.userId(req), id);
  }

  @Post('read-all')
  markAllRead(@Req() req: Request) {
    return this.notifications.markAllRead(this.userId(req));
  }

  /** A notification tray is always the caller's own, never addressable by id. */
  private userId(req: Request): number {
    return Number((req.user as AuthenticatedUser).userId);
  }
}

import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';

/** Shape the workspace notification tray renders. */
export type NotificationRecord = {
  id: number;
  title: string;
  detail: string;
  channel: string;
  status: string;
  createdAt: string;
  sentAt: string | null;
};

@Injectable()
export class NotificationsService {
  constructor(private readonly prisma: PrismaService) {}

  async listForUser(userId: number, limit = 25): Promise<NotificationRecord[]> {
    const notifications = await this.prisma.notification.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
      take: Math.min(Math.max(limit, 1), 100),
      include: { template: true },
    });

    return notifications.map((notification) => {
      // payload overrides the template so a caller can send a one-off message
      // without having to register a template for it first.
      const payload = this.asRecord(notification.payload);
      const title =
        this.text(payload.title) ?? notification.template?.subject ?? 'Notification';
      const detail = this.text(payload.detail) ?? this.text(payload.body) ?? notification.template?.body ?? '';

      return {
        id: notification.id,
        title,
        detail,
        channel: notification.channel,
        status: notification.status,
        createdAt: notification.createdAt.toISOString(),
        sentAt: notification.sentAt?.toISOString() ?? null,
      };
    });
  }

  async unreadCount(userId: number): Promise<{ count: number }> {
    const count = await this.prisma.notification.count({
      where: { userId, status: { not: 'READ' } },
    });
    return { count };
  }

  async markRead(userId: number, id: number): Promise<{ success: true }> {
    // Scope the update to the caller so one user cannot read another's tray.
    const result = await this.prisma.notification.updateMany({
      where: { id, userId },
      data: { status: 'READ' },
    });

    if (result.count === 0) {
      throw new NotFoundException('Notification not found.');
    }

    return { success: true };
  }

  async markAllRead(userId: number): Promise<{ updated: number }> {
    const result = await this.prisma.notification.updateMany({
      where: { userId, status: { not: 'READ' } },
      data: { status: 'READ' },
    });
    return { updated: result.count };
  }

  private asRecord(value: unknown): Record<string, unknown> {
    return value && typeof value === 'object' && !Array.isArray(value)
      ? (value as Record<string, unknown>)
      : {};
  }

  private text(value: unknown): string | undefined {
    if (typeof value !== 'string') return undefined;
    const trimmed = value.trim();
    return trimmed ? trimmed : undefined;
  }
}

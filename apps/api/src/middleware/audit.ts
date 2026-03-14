import {
  CallHandler,
  ExecutionContext,
  Injectable,
  NestInterceptor,
} from '@nestjs/common';
import { Observable, from, of } from 'rxjs';
import { catchError, map, mergeMap } from 'rxjs/operators';
import { PrismaService } from '../prisma/prisma.service';
import { getRequestIp } from './auth';
import { logger } from '../lib/logger';

@Injectable()
export class AuditInterceptor implements NestInterceptor {
  constructor(private readonly prisma: PrismaService) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    if (context.getType() !== 'http') {
      return next.handle();
    }

    const request = context.switchToHttp().getRequest();
    const response = context.switchToHttp().getResponse();
    const method = String(request.method || 'GET').toUpperCase();
    const shouldAudit = ['POST', 'PUT', 'PATCH', 'DELETE'].includes(method);

    return next.handle().pipe(
      mergeMap((data) => {
        if (!shouldAudit || response.statusCode >= 400) {
          return of(data);
        }

        const user = request.user as { userId?: number; role?: string } | undefined;
        return from(
          this.prisma.auditLog.create({
            data: {
              userId: user?.userId,
              role: user?.role,
              action: `${method} ${request.route?.path ?? request.path}`,
              resourceId: request.params?.id ? String(request.params.id) : undefined,
              entity: request.route?.path ?? request.path,
              entityId: request.params?.id ? String(request.params.id) : undefined,
              ipAddress: getRequestIp(request),
              meta: {
                statusCode: response.statusCode,
                originalUrl: request.originalUrl,
              },
            },
          }),
        ).pipe(
          map(() => data),
          catchError((error) => {
            logger.error({ err: error, action: `${method} ${request.originalUrl}` }, 'Audit write failed');
            return of(data);
          }),
        );
      }),
    );
  }
}

import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
  HttpStatus,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import type { Response, Request } from 'express';
import { logger } from '../lib/logger';

@Catch()
export class GlobalErrorFilter implements ExceptionFilter {
  catch(exception: unknown, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest<Request>();

    const isProduction = process.env.NODE_ENV === 'production';

    let status = HttpStatus.INTERNAL_SERVER_ERROR;
    let payload: Record<string, unknown> = { error: 'Something went wrong.' };

    if (exception instanceof HttpException) {
      status = exception.getStatus();
      const exceptionResponse = exception.getResponse();
      payload = typeof exceptionResponse === 'string' ? { error: exceptionResponse } : (exceptionResponse as Record<string, unknown>);
    } else if (exception instanceof Prisma.PrismaClientKnownRequestError || exception instanceof Prisma.PrismaClientValidationError) {
      status = HttpStatus.BAD_REQUEST;
      payload = { error: isProduction ? 'Something went wrong.' : 'Database request failed.' };
    }

    logger.error(
      {
        err: exception,
        method: request.method,
        url: request.url,
        status,
      },
      'Request failed',
    );

    if (!isProduction && !(exception instanceof HttpException)) {
      payload = {
        error: exception instanceof Error ? exception.message : 'Something went wrong.',
        stack: exception instanceof Error ? exception.stack : undefined,
      };
    }

    response.status(status).json(payload);
  }
}

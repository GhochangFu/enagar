import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';

import type { Request, Response } from 'express';

/**
 * Catch-all exception filter: logs the full error (message + stack) at `error`
 * level so server-side operators can see the real cause of any 5xx response.
 *
 * Default Nest behaviour hides the stack behind a generic 500 body. This filter
 * preserves that body shape (so existing clients see the same `statusCode`/
 * `message` JSON), but writes the underlying exception to the logger.
 */
@Catch()
export class AllExceptionsFilter implements ExceptionFilter {
  private readonly logger = new Logger(AllExceptionsFilter.name);

  catch(exception: unknown, host: ArgumentsHost): void {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest<Request>();

    let status: number;
    let body: { statusCode: number; message: string };
    if (exception instanceof HttpException) {
      status = exception.getStatus();
      const resBody = exception.getResponse();
      body =
        typeof resBody === 'string'
          ? { statusCode: status, message: resBody }
          : {
              statusCode: status,
              message: (resBody as { message?: string }).message ?? exception.message,
            };
    } else {
      status = HttpStatus.INTERNAL_SERVER_ERROR;
      body = { statusCode: status, message: 'Internal server error' };
      const err = exception as Error;
      this.logger.error(
        `Unhandled error on ${request.method} ${request.url}: ${err?.message ?? exception}`,
        err?.stack,
      );
    }

    response.status(status).json(body);
  }
}

import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import { Request, Response } from 'express';

type ErrorResponseBody = string | string[] | { [key: string]: unknown };

@Catch()
export class HttpExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger(HttpExceptionFilter.name);

  catch(exception: unknown, host: ArgumentsHost): void {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest<Request>();
    const isHttpException = exception instanceof HttpException;
    const statusCode = isHttpException
      ? exception.getStatus()
      : HttpStatus.INTERNAL_SERVER_ERROR;
    const exceptionResponse = isHttpException
      ? (exception.getResponse() as ErrorResponseBody)
      : null;
    const message = this.extractMessage(exceptionResponse, statusCode);
    const error = this.extractError(exceptionResponse, statusCode);

    if (statusCode >= 500) {
      this.logger.error(
        exception instanceof Error ? exception.stack : String(exception),
      );
    }

    response.status(statusCode).json({
      success: false,
      statusCode,
      message,
      error,
      ...this.extractExtra(exceptionResponse),
      path: request.url,
      timestamp: new Date().toISOString(),
    });
  }

  private extractMessage(
    body: ErrorResponseBody | null,
    statusCode: number,
  ): string | string[] {
    if (typeof body === 'string' || Array.isArray(body)) {
      return body;
    }

    if (body && typeof body.message === 'string') {
      return body.message;
    }

    if (body && Array.isArray(body.message)) {
      return body.message;
    }

    if (statusCode === HttpStatus.INTERNAL_SERVER_ERROR) {
      return 'Terjadi kesalahan pada server';
    }

    return 'Permintaan tidak dapat diproses';
  }

  private extractError(
    body: ErrorResponseBody | null,
    statusCode: number,
  ): string {
    if (
      body &&
      typeof body === 'object' &&
      !Array.isArray(body) &&
      typeof body.error === 'string'
    ) {
      return body.error;
    }

    return HttpStatus[statusCode] ?? 'Error';
  }

  private extractExtra(
    body: ErrorResponseBody | null,
  ): Record<string, unknown> {
    if (!body || typeof body !== 'object' || Array.isArray(body)) {
      return {};
    }

    const extra: Record<string, unknown> = {};
    if (Array.isArray(body.fields)) {
      extra.fields = body.fields;
    }
    if (Array.isArray(body.details)) {
      extra.details = body.details;
    }

    return extra;
  }
}

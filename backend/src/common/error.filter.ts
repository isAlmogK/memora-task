import { ArgumentsHost, Catch, ExceptionFilter, HttpException, Logger } from '@nestjs/common';
import type { Response } from 'express';
import { ApiError } from './api-error';

/** Postgres SQLSTATEs that can still reach us when two requests race past a service check. */
const PG_ERRORS: Record<string, [number, string, string]> = {
  '23505': [409, 'conflict', 'That already exists'],
  '23503': [404, 'not_found', 'A referenced resource was not found'],
  '23514': [400, 'validation_failed', 'A value is out of range'],
};

function pgCode(err: unknown): string | undefined {
  // node-postgres errors carry `code`; Drizzle wraps them in `cause`.
  for (let e: unknown = err; e && typeof e === 'object'; e = (e as { cause?: unknown }).cause) {
    const code = (e as { code?: unknown }).code;
    if (typeof code === 'string' && /^[0-9A-Z]{5}$/.test(code)) return code;
  }
  return undefined;
}

/** Every failure leaves the API as `{ error: { code, message, details? } }`. */
@Catch()
export class ErrorFilter implements ExceptionFilter {
  private readonly log = new Logger('Error');

  catch(err: unknown, host: ArgumentsHost): void {
    const res = host.switchToHttp().getResponse<Response>();
    const [status, body] = this.toBody(err);
    res.status(status).json(body);
  }

  private toBody(err: unknown): [number, unknown] {
    if (err instanceof ApiError) return [err.getStatus(), err.getResponse()];

    if (err instanceof HttpException) {
      // Framework-raised errors: unknown route, malformed JSON body, payload too large…
      const status = err.getStatus();
      const code =
        status === 404 ? 'not_found' : status === 400 ? 'bad_request' : status === 413 ? 'payload_too_large' : 'http_error';
      const message = status === 404 ? 'Route not found' : err.message;
      return [status, { error: { code, message } }];
    }

    const pg = pgCode(err);
    if (pg && PG_ERRORS[pg]) {
      const [status, code, message] = PG_ERRORS[pg];
      return [status, { error: { code, message } }];
    }

    this.log.error(err instanceof Error ? (err.stack ?? err.message) : String(err));
    return [500, { error: { code: 'internal', message: 'Something went wrong on our side' } }];
  }
}

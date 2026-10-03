import { HttpException } from '@nestjs/common';

/**
 * The only error shape the API returns: `{ error: { code, message, details? } }`.
 * `code` is stable and machine-readable; `message` is for humans; `details` carries
 * field-level validation messages (`{ field: message }`).
 */
export class ApiError extends HttpException {
  constructor(
    status: number,
    readonly code: string,
    message: string,
    readonly details?: Record<string, string>,
  ) {
    super({ error: { code, message, ...(details && { details }) } }, status);
  }

  static notFound(what: string): ApiError {
    return new ApiError(404, 'not_found', `${what} not found`);
  }

  static validation(details: Record<string, string>, message = 'Request is invalid'): ApiError {
    return new ApiError(400, 'validation_failed', message, details);
  }
}

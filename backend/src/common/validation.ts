import { ParseUUIDPipe, ValidationError, ValidationPipe } from '@nestjs/common';
import { ApiError } from './api-error';

/** class-validator errors → `details: { "field": "message; message" }` (nested paths dotted). */
function flatten(errors: ValidationError[], prefix = ''): Record<string, string> {
  const out: Record<string, string> = {};
  for (const e of errors) {
    const path = prefix ? `${prefix}.${e.property}` : e.property;
    if (e.constraints) out[path] = Object.values(e.constraints).join('; ');
    if (e.children?.length) Object.assign(out, flatten(e.children, path));
  }
  return out;
}

export const validationPipe = new ValidationPipe({
  whitelist: true,
  forbidNonWhitelisted: true, // unknown fields are a 400, not silently dropped
  transform: true,
  exceptionFactory: (errors) => ApiError.validation(flatten(errors)),
});

/** `:id` params must be UUIDs; anything else is rejected before it reaches SQL. */
export const uuidParam = (name = 'id') =>
  new ParseUUIDPipe({ exceptionFactory: () => ApiError.validation({ [name]: 'must be a UUID' }) });

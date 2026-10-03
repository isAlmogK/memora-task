import { applyDecorators } from '@nestjs/common';
import { ApiBearerAuth, ApiProperty, ApiResponse } from '@nestjs/swagger';

class ApiErrorDetail {
  @ApiProperty({ example: 'not_found' }) code!: string;
  @ApiProperty({ example: 'Library book not found' }) message!: string;
  @ApiProperty({ required: false, type: Object, additionalProperties: { type: 'string' }, example: { name: 'must be 1–80 characters' } })
  details?: Record<string, string>;
}

export class ApiErrorBody {
  @ApiProperty({ type: ApiErrorDetail }) error!: ApiErrorDetail;
}

const DESCRIPTIONS: Record<number, string> = {
  400: 'Validation failed (details has one message per field)',
  401: 'Missing, unknown or revoked API key',
  403: 'Valid key, wrong scope (a device key on a user endpoint)',
  404: "Not found, or it belongs to someone else (we don't say which)",
  409: 'Conflicts with existing data',
};

/** Documents the uniform error body for the given statuses (401/403 are on every guarded route). */
export function ApiErrors(...statuses: number[]) {
  return applyDecorators(
    ApiBearerAuth(),
    ...[401, 403, ...statuses].map((status) => ApiResponse({ status, description: DESCRIPTIONS[status], type: ApiErrorBody })),
  );
}

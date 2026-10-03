import { Body, Controller, HttpCode, Post } from '@nestjs/common';
import { ApiAcceptedResponse, ApiOperation, ApiProperty, ApiTags } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsDate, IsNumber, IsString, IsUUID, Length, Max, MaxDate, Min } from 'class-validator';
import { Caller, CurrentCaller, Scopes } from '../auth/auth.decorators';
import { ApiErrors } from '../common/api-docs';
import { ProgressService } from './progress.service';

export class DeviceProgressEventBody {
  @ApiProperty({ format: 'uuid' })
  @IsUUID('all', { message: 'must be a UUID' })
  libraryBookId!: string;

  @ApiProperty({ minimum: 0, maximum: 100 })
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  @Max(100)
  percent!: number;

  @ApiProperty({ format: 'date-time', description: 'When the reading happened (not when it was sent)' })
  @Type(() => Date)
  @IsDate({ message: 'must be an ISO 8601 timestamp' })
  // a few minutes of clock skew is fine; next week is not
  @MaxDate(() => new Date(Date.now() + 5 * 60_000), { message: 'must not be in the future' })
  occurredAt!: Date;

  @ApiProperty({ description: "The device's own id for this event; resending it is a no-op" })
  @IsString()
  @Length(1, 200)
  externalId!: string;
}

export class DeviceProgressAccepted {
  @ApiProperty({ description: 'false when this externalId was already recorded' }) recorded!: boolean;
}

/** Push endpoint for e-readers. Device-scoped keys may call this and nothing else. */
@ApiTags('progress')
@Controller('progress-events')
export class ProgressController {
  constructor(private readonly progress: ProgressService) {}

  @Post()
  @HttpCode(202)
  @Scopes('device')
  @ApiOperation({ summary: 'Ingest a reading event from a device (idempotent on externalId)' })
  @ApiAcceptedResponse({ type: DeviceProgressAccepted })
  @ApiErrors(400, 404)
  async ingest(@CurrentCaller() caller: Caller, @Body() body: DeviceProgressEventBody): Promise<DeviceProgressAccepted> {
    const recorded = await this.progress.record(caller.userId, body.libraryBookId, {
      source: 'device',
      percent: body.percent,
      occurredAt: body.occurredAt,
      externalId: body.externalId,
    });
    return { recorded };
  }
}

import { CanActivate, ExecutionContext, Injectable } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { and, eq, isNull } from 'drizzle-orm';
import type { Request } from 'express';
import { ApiError } from '../common/api-error';
import { Db, InjectDb } from '../db/db.module';
import { apiKey } from '../db/schema';
import { hashKey } from './api-key';
import { Caller, KeyScope, PUBLIC, SCOPES } from './auth.decorators';

/**
 * Global guard: every route needs `Authorization: Bearer <key>` unless marked @Public().
 * 401 = no key / unknown or revoked key; 403 = valid key, wrong scope for this route.
 * Ownership checks happen in the queries (every one filters by caller.userId).
 */
@Injectable()
export class ApiKeyGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    @InjectDb() private readonly db: Db,
  ) {}

  async canActivate(ctx: ExecutionContext): Promise<boolean> {
    const targets = [ctx.getHandler(), ctx.getClass()];
    if (this.reflector.getAllAndOverride<boolean>(PUBLIC, targets)) return true;

    const req = ctx.switchToHttp().getRequest<Request & { caller?: Caller }>();
    const match = /^Bearer (\S+)$/.exec(req.header('authorization') ?? '');
    if (!match) throw new ApiError(401, 'unauthorized', 'Missing API key: send Authorization: Bearer <key>');

    const [key] = await this.db
      .select({ userId: apiKey.userId, scope: apiKey.scope })
      .from(apiKey)
      .where(and(eq(apiKey.keyHash, hashKey(match[1]!)), isNull(apiKey.revokedAt)))
      .limit(1);
    if (!key) throw new ApiError(401, 'invalid_api_key', 'API key is invalid or has been revoked');

    const allowed = this.reflector.getAllAndOverride<KeyScope[]>(SCOPES, targets) ?? ['user'];
    if (!allowed.includes(key.scope)) {
      throw new ApiError(403, 'forbidden_scope', `A ${key.scope} key can't call this endpoint`);
    }

    req.caller = { userId: key.userId, scope: key.scope };
    return true;
  }
}

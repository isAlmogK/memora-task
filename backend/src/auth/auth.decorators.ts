import { createParamDecorator, ExecutionContext, SetMetadata } from '@nestjs/common';
import type { Request } from 'express';

export type KeyScope = 'user' | 'device';

/** Who is calling, resolved from the API key by ApiKeyGuard. */
export interface Caller {
  userId: string;
  scope: KeyScope;
}

export const PUBLIC = 'auth:public';
export const SCOPES = 'auth:scopes';

/** No key needed (health check). */
export const Public = () => SetMetadata(PUBLIC, true);

/** Which key scopes may call a route. Default (no decorator): `user` only. */
export const Scopes = (...scopes: KeyScope[]) => SetMetadata(SCOPES, scopes);

export const CurrentCaller = createParamDecorator((_: unknown, ctx: ExecutionContext): Caller => {
  const req = ctx.switchToHttp().getRequest<Request & { caller?: Caller }>();
  if (!req.caller) throw new Error('CurrentCaller used on a route without ApiKeyGuard');
  return req.caller;
});

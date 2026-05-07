import { createParamDecorator, ExecutionContext } from '@nestjs/common';

import type { AuthenticatedPrincipal } from './jwt-claims';

export const CurrentPrincipal = createParamDecorator(
  (_data: unknown, ctx: ExecutionContext): AuthenticatedPrincipal | undefined => {
    const request = ctx.switchToHttp().getRequest<{ auth?: AuthenticatedPrincipal }>();
    return request.auth;
  },
);

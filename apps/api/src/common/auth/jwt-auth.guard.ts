import { CanActivate, ExecutionContext, Injectable, UnauthorizedException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';

import { JwtVerifierService } from './jwt-verifier.service';
import { PUBLIC_ROUTE_KEY } from './public.decorator';

import type { AuthenticatedPrincipal } from './jwt-claims';
import type { TenantId } from '@enagar/types';
import type { Request } from 'express';

type AuthenticatedRequest = Request & {
  auth?: AuthenticatedPrincipal;
  tenant?: { id: TenantId; code?: string };
};

@Injectable()
export class JwtAuthGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly jwtVerifier: JwtVerifierService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const isPublic = this.reflector.getAllAndOverride<boolean>(PUBLIC_ROUTE_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (isPublic) {
      return true;
    }

    const request = context.switchToHttp().getRequest<AuthenticatedRequest>();
    const token = this.extractBearerToken(request);
    const principal = await this.jwtVerifier.verifyBearerToken(token);

    request.auth = principal;
    request.tenant = {
      id: principal.tenantId,
      code: principal.tenantCode,
    };

    return true;
  }

  private extractBearerToken(request: Request): string {
    const authorization = request.header('authorization');
    const [scheme, token] = authorization?.split(' ') ?? [];

    if (scheme !== 'Bearer' || !token) {
      throw new UnauthorizedException('Bearer token required');
    }

    return token;
  }
}

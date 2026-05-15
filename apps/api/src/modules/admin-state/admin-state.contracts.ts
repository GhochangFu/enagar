import { BadRequestException, ForbiddenException } from '@nestjs/common';

import type { AuthenticatedPrincipal } from '../../common/auth/jwt-claims';

export function assertStateAdmin(principal: AuthenticatedPrincipal): void {
  if (!principal.roles.includes('state_admin')) {
    throw new ForbiddenException('State admin portal requires state_admin');
  }
}

export function assertTenantCode(value: unknown): asserts value is string {
  if (typeof value !== 'string' || !/^[A-Z0-9]{2,20}$/.test(value)) {
    throw new BadRequestException('tenant code must be uppercase alphanumeric, 2-20 chars');
  }
}

export function assertHexColor(value: unknown): asserts value is string {
  if (typeof value !== 'string' || !/^#[0-9a-fA-F]{6}$/.test(value)) {
    throw new BadRequestException('theme_color must be #RRGGBB');
  }
}

export function assertLanguages(value: unknown): asserts value is Array<'en' | 'bn' | 'hi'> {
  if (!Array.isArray(value) || value.length === 0) {
    throw new BadRequestException('languages_enabled must be a non-empty array');
  }
  for (const locale of value) {
    if (!['en', 'bn', 'hi'].includes(String(locale))) {
      throw new BadRequestException('languages_enabled supports en, bn, hi');
    }
  }
}

export function assertOnboardingStatus(value: unknown): asserts value is string {
  if (!['draft', 'active', 'suspended'].includes(String(value))) {
    throw new BadRequestException('status must be draft, active, or suspended');
  }
}

export function assertImpersonationReason(value: unknown): asserts value is string {
  if (typeof value !== 'string' || value.trim().length < 8 || value.length > 255) {
    throw new BadRequestException('impersonation reason must be 8-255 characters');
  }
}

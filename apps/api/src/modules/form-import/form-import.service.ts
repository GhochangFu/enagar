import { Injectable, NotImplementedException } from '@nestjs/common';

import { assertStateAdmin } from '../admin-state/admin-state.contracts';
import { assertTenantPortalStaff } from '../admin-tenant/tenant-admin-portal-roles';

import type { FormImportJobResponseDto, FormImportUploadedFile } from './dto/form-import.dto';
import type { AuthenticatedPrincipal } from '../../common/auth/jwt-claims';

/**
 * Form-import orchestration (EN-28 contract). Extractors and persistence land in EN-32+ / EN-45.
 */
@Injectable()
export class FormImportService {
  createTenantImportJob(
    _principal: AuthenticatedPrincipal,
    _serviceId: string,
    _file: FormImportUploadedFile,
  ): FormImportJobResponseDto {
    assertTenantPortalStaff(_principal);
    throw new NotImplementedException({
      message: 'Tenant form import is not wired yet. See EN-32 (Excel sync API).',
      follow_up_ticket: 'EN-32',
    });
  }

  getTenantImportJob(
    _principal: AuthenticatedPrincipal,
    _serviceId: string,
    _jobId: string,
  ): FormImportJobResponseDto {
    assertTenantPortalStaff(_principal);
    throw new NotImplementedException({
      message: 'Tenant form import job lookup is not wired yet. See EN-45 (job persistence).',
      follow_up_ticket: 'EN-45',
    });
  }

  createStateImportJob(
    _principal: AuthenticatedPrincipal,
    _serviceCode: string,
    _file: FormImportUploadedFile,
  ): FormImportJobResponseDto {
    assertStateAdmin(_principal);
    throw new NotImplementedException({
      message: 'State global form import is not wired yet. See EN-32 (Excel sync API).',
      follow_up_ticket: 'EN-32',
    });
  }

  getStateImportJob(
    _principal: AuthenticatedPrincipal,
    _serviceCode: string,
    _jobId: string,
  ): FormImportJobResponseDto {
    assertStateAdmin(_principal);
    throw new NotImplementedException({
      message: 'State form import job lookup is not wired yet. See EN-45 (job persistence).',
      follow_up_ticket: 'EN-45',
    });
  }
}

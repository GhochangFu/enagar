import { Injectable } from '@nestjs/common';

import type { ApplicationStore } from './application-store';
import type { ApplicationResponse } from './dto';

@Injectable()
export class InMemoryApplicationStore implements ApplicationStore {
  private readonly applications = new Map<string, ApplicationResponse>();
  private sequence = 0;

  async nextDocketNo(tenantCode: string, serviceCode: string): Promise<string> {
    this.sequence += 1;
    return `WBM/${tenantCode}/${serviceCode}/2026/${String(this.sequence).padStart(5, '0')}`;
  }

  async save(application: ApplicationResponse): Promise<void> {
    this.applications.set(application.id, cloneApplication(application));
  }

  async findById(applicationId: string): Promise<ApplicationResponse | null> {
    return cloneNullable(this.applications.get(applicationId) ?? null);
  }

  async findByDocketNo(docketNo: string): Promise<ApplicationResponse | null> {
    const application =
      Array.from(this.applications.values()).find(
        (candidate) => candidate.docket_no === docketNo,
      ) ?? null;
    return cloneNullable(application);
  }

  async list(): Promise<ApplicationResponse[]> {
    return Array.from(this.applications.values()).map(cloneApplication);
  }
}

function cloneNullable(application: ApplicationResponse | null): ApplicationResponse | null {
  return application ? cloneApplication(application) : null;
}

function cloneApplication(application: ApplicationResponse): ApplicationResponse {
  return {
    ...application,
    form_data: { ...application.form_data },
    timeline: application.timeline.map((item) => ({ ...item })),
    comments: application.comments.map((item) => ({ ...item })),
    documents: application.documents.map((item) => ({ ...item })),
  };
}

import type { ApplicationResponse } from './dto';

export const APPLICATION_STORE = 'APPLICATION_STORE';

export interface ApplicationStore {
  nextDocketNo(tenantCode: string, serviceCode: string): Promise<string>;
  save(application: ApplicationResponse): Promise<void>;
  findById(applicationId: string): Promise<ApplicationResponse | null>;
  findByDocketNo(docketNo: string): Promise<ApplicationResponse | null>;
  list(): Promise<ApplicationResponse[]>;
}

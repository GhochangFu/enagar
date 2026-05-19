import type { ServiceSummary } from '../types/dossier';

/** Native-stack route map ({@link apps/mobile CitizenNavigator}). */
export type CitizenRootStackParamList = {
  Splash: undefined;
  TenantPicker: undefined;
  OtpLogin: undefined;
  PinMunicipalities: undefined;
  CitizenHub: undefined;
  BrowseTenants: { intent?: 'grievance' | 'workspace' } | undefined;
  Workspace: undefined;
  /** Legacy single-tenant home — redirects via deep links only. */
  Home: undefined;
  GrievanceList: undefined;
  GrievanceComposer: undefined;
  GrievanceDetail: { id: string; tenantCode?: string };
  ServiceCatalog: undefined;
  ApplicationComposer: { serviceCode: string; serviceName?: string; service?: ServiceSummary };
  ApplicationList: undefined;
  ApplicationDetail: { docketNo: string };
  PaymentList: undefined;
};

/**
 * Canonical bootstrap labels audited by tests/security contracts
 * (`Splash → OtpLogin → hub` with optional pin gate).
 */
export type CitizenShellFlowContract = 'splash' | 'login' | 'pins' | 'hub' | 'workspace';

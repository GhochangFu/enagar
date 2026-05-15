import type { ServiceSummary } from '../types/dossier';

/** Native-stack route map ({@link apps/mobile CitizenNavigator}). */
export type CitizenRootStackParamList = {
  Splash: undefined;
  TenantPicker: undefined;
  OtpLogin: undefined;
  Home: undefined;
  GrievanceList: undefined;
  GrievanceComposer: undefined;
  GrievanceDetail: { id: string };
  ServiceCatalog: undefined;
  ApplicationComposer: { serviceCode: string; serviceName?: string; service?: ServiceSummary };
  ApplicationList: undefined;
  ApplicationDetail: { docketNo: string };
  PaymentList: undefined;
};

/**
 * Canonical bootstrap labels audited by tests/security contracts
 * (`Splash → TenantPicker → OtpLogin → authenticated hub`).
 */
export type CitizenShellFlowContract = 'splash' | 'tenant' | 'login' | 'main';

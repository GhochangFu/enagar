import type { LinkingOptions } from '@react-navigation/native';
import * as Linking from 'expo-linking';

import type { CitizenRootStackParamList } from './types';

const prefix = Linking.createURL('/');

/** Universal links + custom scheme (`enagarseba://`) for grievance/application routes (Master Sprint 5.4). */
export const citizenLinking: LinkingOptions<CitizenRootStackParamList> = {
  prefixes: [prefix, 'enagarseba://', 'exp+enagar-citizen://'],
  config: {
    screens: {
      Splash: '',
      TenantPicker: 'tenant-picker',
      OtpLogin: 'login',
      PinMunicipalities: 'pin-municipalities',
      CitizenHub: 'hub',
      BrowseTenants: 'browse',
      Workspace: 'workspace',
      Home: 'home',
      GrievanceList: 'grievances',
      GrievanceComposer: 'grievance/new',
      GrievanceDetail: 'grievance/:id',
      ServiceCatalog: 'services',
      ApplicationComposer: 'apply/:serviceCode',
      ApplicationList: 'applications',
      ApplicationDetail: 'application/:docketNo',
      PaymentList: 'payments',
    },
  },
};

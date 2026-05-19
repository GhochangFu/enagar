import type { NativeStackNavigationProp } from '@react-navigation/native-stack';

import { fetchCitizenPreferences } from './citizenHubApi';
import type { CitizenRootStackParamList } from '../navigation/types';

/** After OTP verify: pin gate or central hub (PWA parity). */
export async function navigateAfterCitizenLogin(
  navigation: NativeStackNavigationProp<CitizenRootStackParamList>,
  apiRoot: string,
  accessToken: string,
): Promise<void> {
  try {
    const prefs = await fetchCitizenPreferences(apiRoot, accessToken);
    if (prefs.pinned_tenant_codes.length > 0) {
      navigation.replace('CitizenHub');
      return;
    }
  } catch {
    /* preferences unavailable — still require pin onboarding */
  }
  navigation.replace('PinMunicipalities');
}

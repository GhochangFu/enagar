import { NavigationContainer } from '@react-navigation/native';

import { SessionProvider } from './context/SessionContext';
import { CitizenNavigator } from './navigation/CitizenNavigator';

/**
 * Thin root: persists session tokens + municipality, renders the native-stack
 * flow audited in `navigation/types.ts` (Splash → TenantPicker → OTP → Hub).
 */
export function CitizenShell() {
  return (
    <SessionProvider>
      <NavigationContainer>
        <CitizenNavigator />
      </NavigationContainer>
    </SessionProvider>
  );
}

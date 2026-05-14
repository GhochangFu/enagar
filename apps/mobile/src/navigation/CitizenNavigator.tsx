import type { JSX } from 'react';
import { createNativeStackNavigator } from '@react-navigation/native-stack';

import type { CitizenRootStackParamList } from './types';
import { ApplicationDetailScreen } from '../screens/applications/ApplicationDetailScreen';
import { ApplicationListScreen } from '../screens/applications/ApplicationListScreen';
import { HomeScreen } from '../screens/HomeScreen';
import { OtpLoginScreen } from '../screens/OtpLoginScreen';
import { PaymentListScreen } from '../screens/payments/PaymentListScreen';
import { SplashScreen } from '../screens/SplashScreen';
import { ApplicationComposerScreen } from '../screens/services/ApplicationComposerScreen';
import { ServiceCatalogScreen } from '../screens/services/ServiceCatalogScreen';
import { TenantPickerScreen } from '../screens/TenantPickerScreen';
import { GrievanceComposerScreen } from '../screens/grievances/GrievanceComposerScreen';
import { GrievanceDetailScreen } from '../screens/grievances/GrievanceDetailScreen';
import { GrievanceListScreen } from '../screens/grievances/GrievanceListScreen';

const Stack = createNativeStackNavigator<CitizenRootStackParamList>();

/** Native-stack citizen flow: Splash → municipality → OTP → hub + services/grievances/payments. */
export function CitizenNavigator(): JSX.Element {
  return (
    <Stack.Navigator initialRouteName="Splash" screenOptions={{ headerShown: false }}>
      <Stack.Screen name="Splash" component={SplashScreen} />
      <Stack.Screen name="TenantPicker" component={TenantPickerScreen} />
      <Stack.Screen name="OtpLogin" component={OtpLoginScreen} />
      <Stack.Screen name="Home" component={HomeScreen} />
      <Stack.Screen name="GrievanceList" component={GrievanceListScreen} />
      <Stack.Screen name="GrievanceComposer" component={GrievanceComposerScreen} />
      <Stack.Screen name="GrievanceDetail" component={GrievanceDetailScreen} />
      <Stack.Screen name="ServiceCatalog" component={ServiceCatalogScreen} />
      <Stack.Screen name="ApplicationComposer" component={ApplicationComposerScreen} />
      <Stack.Screen name="ApplicationList" component={ApplicationListScreen} />
      <Stack.Screen name="ApplicationDetail" component={ApplicationDetailScreen} />
      <Stack.Screen name="PaymentList" component={PaymentListScreen} />
    </Stack.Navigator>
  );
}

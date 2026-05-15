import Constants from 'expo-constants';
import * as Device from 'expo-device';
import * as Linking from 'expo-linking';
import * as Notifications from 'expo-notifications';
import { useEffect, useRef } from 'react';
import { Platform } from 'react-native';

import { sessionApiRoot, useSession } from '../context/SessionContext';

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: false,
    shouldSetBadge: false,
  }),
});

/**
 * Requests notification permission, registers the Expo push token with the API, and
 * forwards notification tap payloads that carry `data.deepLink` (custom scheme URL).
 */
export function useCitizenPushRegistration(): void {
  const { accessToken, selectedTenant } = useSession();
  const registeredToken = useRef<string | null>(null);

  useEffect(() => {
    const sub = Notifications.addNotificationResponseReceivedListener((response) => {
      const raw = response.notification.request.content.data?.deepLink;
      if (typeof raw === 'string' && raw.trim().length > 0) {
        void Linking.openURL(raw.trim());
      }
    });
    return () => sub.remove();
  }, []);

  useEffect(() => {
    if (!accessToken || !Device.isDevice) {
      return;
    }

    let cancelled = false;

    void (async () => {
      try {
        if (Platform.OS === 'android') {
          await Notifications.setNotificationChannelAsync('default', {
            name: 'default',
            importance: Notifications.AndroidImportance.DEFAULT,
          });
        }

        const { status: existing } = await Notifications.getPermissionsAsync();
        let finalStatus = existing;
        if (existing !== 'granted') {
          const { status } = await Notifications.requestPermissionsAsync();
          finalStatus = status;
        }
        if (finalStatus !== 'granted' || cancelled) {
          return;
        }

        const projectId =
          (Constants.expoConfig?.extra as { eas?: { projectId?: string } } | undefined)?.eas
            ?.projectId ?? process.env.EXPO_PUBLIC_EAS_PROJECT_ID;

        const tokenRow = await Notifications.getExpoPushTokenAsync(
          projectId ? { projectId: String(projectId) } : undefined,
        );
        const expoToken = tokenRow.data;
        if (!expoToken || cancelled || registeredToken.current === expoToken) {
          return;
        }

        const platform = Platform.OS === 'ios' ? 'ios' : 'android';
        const res = await fetch(`${sessionApiRoot()}/citizen/notifications/push-token`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${accessToken}`,
            ...(selectedTenant?.code ? { 'X-Enagar-Tenant-Code': selectedTenant.code } : {}),
          },
          body: JSON.stringify({ platform, token: expoToken }),
        });

        if (res.ok) {
          registeredToken.current = expoToken;
        }
      } catch {
        /* Simulators and missing EAS projectId are non-fatal. */
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [accessToken, selectedTenant?.code]);
}

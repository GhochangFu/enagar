import Constants from 'expo-constants';
import { Platform } from 'react-native';

import { hostFromMetroUri, rewriteLocalhostApiBase } from './apiBaseUrl';

export { rewriteLocalhostApiBase } from './apiBaseUrl';

export function metroLanHost(): string | null {
  const hostUri = Constants.expoConfig?.hostUri;
  if (typeof hostUri !== 'string' || hostUri.trim().length === 0) {
    return null;
  }
  return hostFromMetroUri(hostUri);
}

export function resolveSessionApiRoot(configured: string): string {
  const normalized = configured.replace(/\/$/, '');
  if (Platform.OS === 'web') {
    return normalized;
  }
  const lanHost = metroLanHost();
  if (!lanHost) {
    return normalized;
  }
  return rewriteLocalhostApiBase(normalized, lanHost);
}

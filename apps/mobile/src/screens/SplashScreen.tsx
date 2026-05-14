import { t } from '@enagar/i18n';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import Constants from 'expo-constants';
import { StatusBar } from 'expo-status-bar';
import { useEffect, useRef } from 'react';
import { Pressable, StyleSheet, Text } from 'react-native';

import { useSession } from '../context/SessionContext';
import type { CitizenRootStackParamList } from '../navigation/types';

type SplashNav = NativeStackNavigationProp<CitizenRootStackParamList, 'Splash'>;

export function SplashScreen() {
  const navigation = useNavigation<SplashNav>();
  const { locale, restoreSession } = useSession();
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    let alive = true;
    void (async () => {
      const recovered = await restoreSession();
      if (!alive) {
        return;
      }
      if (recovered) {
        navigation.replace('Home');
        return;
      }
      timer.current = setTimeout(() => navigation.replace('TenantPicker'), 2400);
    })();

    return () => {
      alive = false;
      if (timer.current) {
        clearTimeout(timer.current);
      }
    };
  }, [navigation, restoreSession]);

  function skip() {
    if (timer.current) {
      clearTimeout(timer.current);
    }
    navigation.replace('TenantPicker');
  }

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={t('action.continue', locale)}
      onPress={skip}
      style={[styles.fill, { justifyContent: 'center', padding: 24 }]}
    >
      <StatusBar style="light" />
      <Text style={styles.title}>{t('splash.title', locale)}</Text>
      <Text style={[styles.subtitle]}>{t('splash.subtitle', locale)}</Text>
      <Text style={styles.skipHint}>{t('action.continue', locale)}</Text>
      <Text style={styles.micro}>
        {Constants.expoConfig?.version
          ? `${Constants.expoConfig.name ?? 'eNagarSeba'} v${Constants.expoConfig.version}`
          : '@enagar/mobile'}
      </Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  fill: { flex: 1, backgroundColor: '#0F4C75' },
  title: { fontSize: 26, fontWeight: '700', color: '#FFFFFF', letterSpacing: 0.2 },
  subtitle: {
    marginTop: 10,
    fontSize: 16,
    lineHeight: 23,
    color: '#FFFFFF',
    opacity: 0.92,
  },
  skipHint: {
    marginTop: 24,
    fontSize: 14,
    textDecorationLine: 'underline',
    color: '#FFFFFF',
    opacity: 0.85,
  },
  micro: { marginTop: 14, fontSize: 11, color: '#FFFFFF', opacity: 0.65 },
});

import { t } from '@enagar/i18n';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import Constants from 'expo-constants';
import { StatusBar } from 'expo-status-bar';
import { useEffect, useRef } from 'react';
import { Pressable, StyleSheet, Text } from 'react-native';

import { useSession } from '../context/SessionContext';
import type { CitizenRootStackParamList } from '../navigation/types';
import {
  mobileTypography,
  platformBrandHex,
  readableOnBrandHex,
} from '../theme/citizenMobileTheme';

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
        navigation.replace('CitizenHub');
        return;
      }
      timer.current = setTimeout(() => navigation.replace('OtpLogin'), 2400);
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
    navigation.replace('OtpLogin');
  }

  const brand = platformBrandHex();
  const brandFg = readableOnBrandHex(brand);

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={t('action.continue', locale)}
      onPress={skip}
      style={[styles.fill, { justifyContent: 'center', padding: 28, backgroundColor: brand }]}
    >
      <StatusBar style="light" />
      <Text style={[mobileTypography.eyebrow, styles.eyebrowOnBrand, { color: brandFg }]}>
        eNagarSeba
      </Text>
      <Text style={[styles.title, { color: brandFg }]}>{t('splash.title', locale)}</Text>
      <Text style={[styles.subtitle, { color: brandFg }]}>{t('splash.subtitle', locale)}</Text>
      <Text style={[styles.skipHint, { color: brandFg }]}>{t('action.continue', locale)}</Text>
      <Text style={[styles.micro, { color: brandFg }]}>
        {Constants.expoConfig?.version
          ? `${Constants.expoConfig.name ?? 'eNagarSeba'} v${Constants.expoConfig.version}`
          : '@enagar/mobile'}
      </Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  fill: { flex: 1 },
  eyebrowOnBrand: { opacity: 0.88, marginBottom: 8 },
  title: { fontSize: 30, fontWeight: '800', letterSpacing: -0.5 },
  subtitle: {
    marginTop: 10,
    fontSize: 16,
    lineHeight: 23,
    opacity: 0.92,
  },
  skipHint: {
    marginTop: 24,
    fontSize: 14,
    textDecorationLine: 'underline',
    opacity: 0.85,
  },
  micro: { marginTop: 14, fontSize: 11, opacity: 0.65 },
});

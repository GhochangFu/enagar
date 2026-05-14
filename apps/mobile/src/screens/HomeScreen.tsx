import { SUPPORTED_LOCALES, t } from '@enagar/i18n';
import type { Locale } from '@enagar/i18n';
import { hexToRgb } from '@enagar/tenant-theme';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import * as SecureStore from 'expo-secure-store';
import { StatusBar } from 'expo-status-bar';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { Platform, Pressable, StyleSheet, Text, View } from 'react-native';

import { useSession } from '../context/SessionContext';
import type { CitizenRootStackParamList } from '../navigation/types';
import type { TenantListItem } from '../tenantApi';

async function probeSecureStorage(): Promise<boolean> {
  if (Platform.OS === 'web') {
    return false;
  }
  try {
    await SecureStore.setItemAsync('enagar.mobile.secure.probe', 'ok', {
      keychainAccessible: SecureStore.AFTER_FIRST_UNLOCK,
    });
    return (await SecureStore.getItemAsync('enagar.mobile.secure.probe')) === 'ok';
  } catch {
    return false;
  }
}

export function HomeScreen() {
  const navigation = useNavigation<NativeStackNavigationProp<CitizenRootStackParamList>>();
  const { locale, selectedTenant, setLocale, mobile, signOut } = useSession();

  const [secureOk, setSecureOk] = useState(false);

  const brand = selectedTenant ?? null;

  useEffect(() => {
    void probeSecureStorage().then(setSecureOk);
  }, []);

  const homeBg = useMemo(() => brandBackgroundHex(brand), [brand]);
  const homeFg = useMemo(() => deriveForegroundRgb(brand), [brand]);

  const openTenantPicker = useCallback(async () => {
    await signOut();
    navigation.replace('TenantPicker');
  }, [navigation, signOut]);

  const openLogin = useCallback(async () => {
    await signOut();
    navigation.replace('OtpLogin');
  }, [navigation, signOut]);

  function openGrievances() {
    navigation.navigate('GrievanceList');
  }

  const mobileCaption = mobile ?? '—';

  return (
    <View style={[styles.fill, { backgroundColor: homeBg }]}>
      <StatusBar style="light" />
      <View style={{ padding: 20 }}>
        <Text style={[styles.title, { color: homeFg }]}>
          {brand?.name ?? t('home.label', locale)}
        </Text>
        <Text style={[styles.subtitle, { color: homeFg }]}>
          {brand?.code ?? '—'} · {t('home.empty', locale)}
        </Text>

        <View style={styles.kv}>
          <Text style={[styles.kvLabel, { color: homeFg }]}>Signed-in mobile</Text>
          <Text style={[styles.kvValue, { color: homeFg }]}>{mobileCaption}</Text>
        </View>

        <View style={styles.kv}>
          <Text style={[styles.kvLabel, { color: homeFg }]}>{t('home.wards', locale)}</Text>
          <Text style={[styles.kvValue, { color: homeFg }]}>{brand?.ward_count ?? 0}</Text>
        </View>

        <View style={styles.kv}>
          <Text style={[styles.kvLabel, { color: homeFg }]}>{t('home.language', locale)}</Text>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
            {SUPPORTED_LOCALES.map((lng) => (
              <Pressable
                key={lng}
                accessibilityRole="button"
                accessibilityState={{ selected: locale === lng }}
                onPress={() => setLocale(lng as Locale)}
                style={[
                  styles.langChip,
                  locale === lng ? { borderColor: homeFg } : { borderColor: 'transparent' },
                ]}
              >
                <Text style={[styles.langChipLabel, { color: homeFg }]}>{lng.toUpperCase()}</Text>
              </Pressable>
            ))}
          </View>
        </View>

        <View style={styles.kv}>
          <Text style={[styles.kvLabel, { color: homeFg }]}>{t('home.tokenStorage', locale)}</Text>
          <Text style={[styles.kvValue, { color: homeFg }]}>
            {secureOk ? t('home.tokenEncrypted', locale) : '—'}
          </Text>
        </View>

        <Pressable
          accessibilityRole="button"
          onPress={openGrievances}
          style={[
            styles.primaryCta,
            { borderColor: homeFg, backgroundColor: 'rgba(255,255,255,0.15)' },
          ]}
        >
          <Text style={[styles.primaryCtaLabel, { color: homeFg }]}>
            {t('grievance.title', locale)}
          </Text>
        </Pressable>

        <Pressable
          accessibilityRole="button"
          onPress={() => navigation.navigate('ServiceCatalog')}
          style={[
            styles.primaryCta,
            { marginTop: 12, borderColor: homeFg, backgroundColor: 'rgba(255,255,255,0.12)' },
          ]}
        >
          <Text style={[styles.primaryCtaLabel, { color: homeFg }]}>
            {t('home.servicesCta', locale)}
          </Text>
        </Pressable>

        <Pressable
          accessibilityRole="button"
          onPress={() => navigation.navigate('ApplicationList')}
          style={[
            styles.primaryCta,
            { marginTop: 12, borderColor: homeFg, backgroundColor: 'rgba(255,255,255,0.12)' },
          ]}
        >
          <Text style={[styles.primaryCtaLabel, { color: homeFg }]}>
            {t('home.applicationsCta', locale)}
          </Text>
        </Pressable>

        <Pressable
          accessibilityRole="button"
          onPress={() => navigation.navigate('PaymentList')}
          style={[
            styles.primaryCta,
            { marginTop: 12, borderColor: homeFg, backgroundColor: 'rgba(255,255,255,0.12)' },
          ]}
        >
          <Text style={[styles.primaryCtaLabel, { color: homeFg }]}>
            {t('home.paymentsCta', locale)}
          </Text>
        </Pressable>

        <Pressable
          accessibilityRole="button"
          onPress={openLogin}
          style={[styles.secondaryCta, { borderColor: homeFg }]}
        >
          <Text style={[styles.secondaryCtaLabel, { color: homeFg }]}>
            Sign out & re-verify OTP
          </Text>
        </Pressable>

        <Pressable
          accessibilityRole="button"
          style={[styles.secondaryCta, { borderColor: homeFg }]}
          onPress={openTenantPicker}
        >
          <Text style={[styles.secondaryCtaLabel, { color: homeFg }]}>
            {t('tenant.title', locale)}
          </Text>
        </Pressable>
      </View>
    </View>
  );
}

function brandBackgroundHex(tenant: TenantListItem | null): string {
  const hex = tenant?.theme_color ?? '#0F4C75';
  return /^#[0-9a-f]{6}$/i.test(hex) ? hex : '#0F4C75';
}

function deriveForegroundRgb(tenant: TenantListItem | null): string {
  const hex = brandBackgroundHex(tenant);
  const [red = 15, green = 76, blue = 117] = hexToRgb(hex).split(' ').map(Number);
  const luminance = (0.2126 * red + 0.7152 * green + 0.0722 * blue) / 255;

  return luminance > 0.55 ? 'rgb(15, 23, 42)' : 'rgb(255, 255, 255)';
}

const styles = StyleSheet.create({
  fill: { flex: 1 },
  title: { fontSize: 26, fontWeight: '700', letterSpacing: 0.2 },
  subtitle: { marginTop: 10, fontSize: 16, lineHeight: 23 },
  kv: {
    marginTop: 18,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: 'rgba(255,255,255,0.35)',
    paddingTop: 12,
  },
  kvLabel: {
    fontSize: 13,
    opacity: 0.92,
    fontWeight: '600',
    marginBottom: 6,
    textTransform: 'uppercase',
    letterSpacing: 0.6,
  },
  kvValue: {
    fontSize: 17,
    fontWeight: '500',
  },
  langChip: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 999,
    borderWidth: 1,
    backgroundColor: 'rgba(255,255,255,0.12)',
  },
  langChipLabel: {
    fontSize: 13,
    fontWeight: '600',
  },
  secondaryCta: {
    marginTop: 28,
    borderWidth: 1,
    borderRadius: 10,
    paddingVertical: 12,
    alignItems: 'center',
  },
  secondaryCtaLabel: {
    fontSize: 15,
    fontWeight: '600',
  },
  primaryCta: {
    marginTop: 26,
    borderWidth: 1,
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: 'center',
  },
  primaryCtaLabel: { fontSize: 17, fontWeight: '700' },
});

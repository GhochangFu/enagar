import { resolveLocale, t } from '@enagar/i18n';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { StatusBar } from 'expo-status-bar';
import { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';

import { fetchPublicTenants, type TenantListItem } from '../tenantApi';
import {
  MOBILE_CANVAS_HEX,
  MOBILE_INK_PRIMARY,
  MOBILE_INK_SECONDARY,
  MOBILE_RADIUS_MD,
  MOBILE_SURFACE_HEX,
  MOBILE_WARM_BORDER,
  mobileShadowCard,
  platformBrandHex,
  resolveTenantBrandHex,
} from '../theme/citizenMobileTheme';

import type { CitizenRootStackParamList } from '../navigation/types';
import type { Locale } from '@enagar/i18n';
import { sessionApiRoot, useSession } from '../context/SessionContext';

function apiBase(): string {
  return sessionApiRoot();
}

export function TenantPickerScreen() {
  const navigation = useNavigation<NativeStackNavigationProp<CitizenRootStackParamList>>();
  const { locale, selectTenant, signOut } = useSession();
  const [tenants, setTenants] = useState<TenantListItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const lng: Locale =
    locale && (locale === 'en' || locale === 'bn' || locale === 'hi')
      ? locale
      : resolveLocale(undefined);

  const loadTenants = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      const rows = await fetchPublicTenants(apiBase());
      setTenants(rows);
    } catch {
      setError(t('status.apiUnreachable', lng));
      setTenants([]);
    } finally {
      setLoading(false);
    }
  }, [lng]);

  useEffect(() => {
    void loadTenants();
  }, [loadTenants]);

  return (
    <View style={[styles.fill, { backgroundColor: MOBILE_CANVAS_HEX }]}>
      <StatusBar style="dark" />
      <Text style={styles.screenTitle}>{t('tenant.title', lng)}</Text>
      <Pressable
        accessibilityRole="button"
        onPress={() => navigation.replace('OtpLogin')}
        style={[styles.signInCta, { backgroundColor: platformBrandHex() }]}
      >
        <Text style={styles.signInLabel}>Sign in with mobile OTP</Text>
      </Pressable>
      <Text style={styles.previewHint}>Preview municipalities below — hub pins after login.</Text>

      {loading ? (
        <View style={styles.centerGrow}>
          <ActivityIndicator
            accessibilityLabel={t('status.sendingOtp', lng)}
            color={platformBrandHex()}
          />
        </View>
      ) : null}

      {error ? (
        <Pressable accessibilityRole="button" onPress={loadTenants} style={styles.errorBanner}>
          <Text style={styles.errorText}>{error}</Text>
          <Text style={styles.retryHint}>Tap to retry</Text>
        </Pressable>
      ) : null}

      <FlatList<TenantListItem>
        data={tenants}
        keyExtractor={(item) => item.id}
        contentContainerStyle={{ paddingBottom: 32 }}
        ListEmptyComponent={
          !loading ? (
            <Text
              style={[styles.micro, { marginTop: 12, paddingHorizontal: 16, color: '#64748B' }]}
            >
              {error ? '' : 'No municipalities returned'}
            </Text>
          ) : null
        }
        renderItem={({ item }) => (
          <Pressable
            accessibilityRole="button"
            onPress={() => {
              void signOut();
              selectTenant(item);
              navigation.replace('OtpLogin');
            }}
            style={({ pressed }) => [
              styles.tenantCard,
              {
                opacity: pressed ? 0.9 : 1,
                borderLeftColor: resolveTenantBrandHex(item.theme_color),
              },
            ]}
          >
            <Text style={styles.tenantName}>{item.name}</Text>
            <Text style={styles.tenantMeta}>
              {item.code} · {item.district}
            </Text>
          </Pressable>
        )}
      />

      <Text style={styles.micro}>
        Platform: {Platform.OS} · API {apiBase()}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  fill: { flex: 1 },
  screenTitle: {
    fontSize: 20,
    fontWeight: '600',
    marginTop: 16,
    marginBottom: 8,
    paddingHorizontal: 16,
    color: MOBILE_INK_PRIMARY,
  },
  centerGrow: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  tenantCard: {
    marginHorizontal: 16,
    marginTop: 10,
    padding: 14,
    backgroundColor: MOBILE_SURFACE_HEX,
    borderRadius: MOBILE_RADIUS_MD,
    borderLeftWidth: 4,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: MOBILE_WARM_BORDER,
    ...mobileShadowCard,
  },
  tenantName: { fontSize: 16, fontWeight: '600', color: MOBILE_INK_PRIMARY },
  tenantMeta: { marginTop: 4, fontSize: 13, color: MOBILE_INK_SECONDARY },
  errorBanner: {
    marginHorizontal: 16,
    marginBottom: 8,
    padding: 12,
    backgroundColor: '#FEF2F2',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#FECACA',
  },
  errorText: { color: '#991B1B', fontWeight: '600' },
  retryHint: { color: '#7F1D1D', fontSize: 12, marginTop: 6 },
  micro: {
    paddingHorizontal: 16,
    marginTop: 6,
    fontSize: 11,
    color: '#64748B',
  },
  signInCta: {
    marginHorizontal: 16,
    marginBottom: 8,
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: 'center',
  },
  signInLabel: { fontSize: 15, fontWeight: '700', color: '#FFFFFF' },
  previewHint: {
    paddingHorizontal: 16,
    marginBottom: 8,
    fontSize: 12,
    color: MOBILE_INK_SECONDARY,
  },
});

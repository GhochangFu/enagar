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
    <View style={[styles.fill, { backgroundColor: '#F8FAFC' }]}>
      <StatusBar style="dark" />
      <Text style={styles.screenTitle}>{t('tenant.title', lng)}</Text>

      {loading ? (
        <View style={styles.centerGrow}>
          <ActivityIndicator accessibilityLabel={t('status.sendingOtp', lng)} color="#0F4C75" />
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
              { opacity: pressed ? 0.9 : 1, borderLeftColor: normalizeHex(item.theme_color) },
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

function normalizeHex(hex: string): string {
  return /^#[0-9a-f]{6}$/i.test(hex) ? hex : '#0F4C75';
}

const styles = StyleSheet.create({
  fill: { flex: 1 },
  screenTitle: {
    fontSize: 20,
    fontWeight: '600',
    marginTop: 16,
    marginBottom: 8,
    paddingHorizontal: 16,
    color: '#0F172A',
  },
  centerGrow: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  tenantCard: {
    marginHorizontal: 16,
    marginTop: 10,
    padding: 14,
    backgroundColor: '#FFFFFF',
    borderRadius: 10,
    borderLeftWidth: 4,
    shadowColor: '#0F172A',
    shadowOpacity: 0.06,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 2 },
    elevation: 2,
  },
  tenantName: { fontSize: 16, fontWeight: '600', color: '#0F172A' },
  tenantMeta: { marginTop: 4, fontSize: 13, color: '#475569' },
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
});

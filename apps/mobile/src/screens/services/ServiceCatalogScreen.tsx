import { t } from '@enagar/i18n';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { StatusBar } from 'expo-status-bar';
import { useCallback, useState } from 'react';
import { ActivityIndicator, FlatList, Pressable, StyleSheet, Text, View } from 'react-native';

import { fetchTenantServices } from '../../api/servicesCatalogApi';
import { sessionApiRoot, useSession } from '../../context/SessionContext';
import type { CitizenRootStackParamList } from '../../navigation/types';
import type { ServiceSummary } from '../../types/dossier';

export function ServiceCatalogScreen() {
  const navigation = useNavigation<NativeStackNavigationProp<CitizenRootStackParamList>>();
  const { locale, selectedTenant } = useSession();
  const municipality = selectedTenant?.code ?? null;

  const [services, setServices] = useState<ServiceSummary[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!municipality) {
      setServices([]);
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const rows = await fetchTenantServices(sessionApiRoot(), municipality);
      setServices(rows);
    } catch {
      setServices([]);
      setError(t('services.loadError', locale));
    } finally {
      setBusy(false);
    }
  }, [locale, municipality]);

  useFocusEffect(
    useCallback(() => {
      void load();
      return undefined;
    }, [load]),
  );

  return (
    <View style={styles.outer}>
      <StatusBar style="dark" />

      <View style={styles.topBar}>
        <Pressable
          accessibilityRole="button"
          onPress={() => navigation.goBack()}
          style={styles.back}
        >
          <Text style={styles.backLabel}>{t('grievance.back', locale)}</Text>
        </Pressable>
        <Text style={styles.h1}>{t('services.title', locale)}</Text>
      </View>

      {busy ? (
        <View style={styles.center}>
          <ActivityIndicator />
        </View>
      ) : null}
      {error ? <Text style={styles.err}>{error}</Text> : null}

      {!municipality ? (
        <Text style={styles.hint}>{t('tenant.title', locale)}</Text>
      ) : (
        <FlatList
          data={services}
          contentContainerStyle={services.length === 0 ? styles.emptyWrap : styles.listPad}
          keyExtractor={(item) => item.code}
          ListEmptyComponent={
            !busy ? <Text style={styles.empty}>{t('services.empty', locale)}</Text> : null
          }
          renderItem={({ item }) => {
            const title =
              item.name[locale === 'bn' || locale === 'hi' ? locale : 'en'] ?? item.name.en;
            return (
              <View style={styles.card}>
                <Text style={styles.name}>{title}</Text>
                <Text style={styles.meta}>{item.code}</Text>
                <Pressable
                  accessibilityRole="button"
                  onPress={() =>
                    navigation.navigate('ApplicationComposer', {
                      serviceCode: item.code,
                      serviceName: title,
                      service: item,
                    })
                  }
                  style={styles.cta}
                >
                  <Text style={styles.ctaLbl}>{t('services.apply', locale)}</Text>
                </Pressable>
              </View>
            );
          }}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  outer: { flex: 1, backgroundColor: '#F8FAFC' },
  topBar: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#E2E8F0',
  },
  back: { marginBottom: 6 },
  backLabel: { fontSize: 15, fontWeight: '600', color: '#0369A1' },
  h1: { fontSize: 20, fontWeight: '700', color: '#0F172A' },
  center: { padding: 24 },
  err: { paddingHorizontal: 16, color: '#B91C1C', fontWeight: '600' },
  hint: { padding: 24, fontSize: 15, color: '#64748B' },
  listPad: { padding: 16, paddingBottom: 40 },
  emptyWrap: { flexGrow: 1, justifyContent: 'center', padding: 24 },
  empty: { textAlign: 'center', color: '#475569', fontSize: 15 },
  card: {
    marginBottom: 12,
    padding: 14,
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: '#E2E8F0',
  },
  name: { fontSize: 16, fontWeight: '700', color: '#0F172A' },
  meta: {
    marginTop: 4,
    fontSize: 13,
    color: '#64748B',
    textTransform: 'uppercase',
    fontWeight: '600',
  },
  cta: {
    marginTop: 12,
    alignSelf: 'flex-start',
    backgroundColor: '#0F4C75',
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 10,
  },
  ctaLbl: { color: '#FFFFFF', fontWeight: '700', fontSize: 14 },
});

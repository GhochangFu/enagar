import { t } from '@enagar/i18n';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { StatusBar } from 'expo-status-bar';
import { useCallback, useState } from 'react';
import { ActivityIndicator, FlatList, Pressable, StyleSheet, Text, View } from 'react-native';

import { fetchApplicationList } from '../../api/applicationApi';
import { sessionApiRoot, useSession } from '../../context/SessionContext';
import type { CitizenRootStackParamList } from '../../navigation/types';
import type { ApplicationSummary } from '../../types/dossier';

export function ApplicationListScreen() {
  const navigation = useNavigation<NativeStackNavigationProp<CitizenRootStackParamList>>();
  const { locale, accessToken, selectedTenant } = useSession();
  const scope = selectedTenant?.code;

  const [rows, setRows] = useState<ApplicationSummary[]>([]);
  const [busy, setBusy] = useState(false);
  const [errorLine, setErrorLine] = useState<string | null>(null);

  const reload = useCallback(async () => {
    if (!accessToken) {
      setRows([]);
      return;
    }
    setBusy(true);
    setErrorLine(null);

    try {
      const items = await fetchApplicationList(sessionApiRoot(), accessToken, scope);
      setRows(items.filter((row) => !scope || !row.tenant_code || row.tenant_code === scope));
    } catch {
      setRows([]);
      setErrorLine(t('applications.loadError', locale));
    } finally {
      setBusy(false);
    }
  }, [accessToken, locale, scope]);

  useFocusEffect(
    useCallback(() => {
      void reload();
      return undefined;
    }, [reload]),
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
        <Text style={styles.h1}>{t('applications.title', locale)}</Text>
      </View>

      {busy ? (
        <View style={styles.center}>
          <ActivityIndicator />
        </View>
      ) : null}
      {errorLine ? <Text style={styles.err}>{errorLine}</Text> : null}

      {!accessToken ? (
        <View style={styles.banner}>
          <Text style={styles.bannerTxt}>{t('applications.signInRequired', locale)}</Text>
          <Pressable accessibilityRole="button" onPress={() => navigation.replace('OtpLogin')}>
            <Text style={styles.link}>{t('login.title', locale)}</Text>
          </Pressable>
        </View>
      ) : null}

      <FlatList
        data={rows}
        refreshing={busy}
        onRefresh={reload}
        keyExtractor={(item) => item.id}
        contentContainerStyle={
          rows.length === 0 && !busy
            ? { flexGrow: 1, justifyContent: 'center', padding: 24 }
            : { paddingBottom: 32 }
        }
        ListEmptyComponent={
          !busy && accessToken && !errorLine ? (
            <Text style={styles.empty}>{t('applications.empty', locale)}</Text>
          ) : null
        }
        renderItem={({ item }) => (
          <Pressable
            accessibilityRole="button"
            style={styles.card}
            onPress={() => navigation.navigate('ApplicationDetail', { docketNo: item.docket_no })}
          >
            <Text style={styles.doc}>{item.docket_no}</Text>
            <Text style={styles.svc}>{item.service_name}</Text>
            <Text style={styles.stat}>
              {item.status_label} · {item.payment_status}
            </Text>
          </Pressable>
        )}
      />

      <View style={styles.pad}>
        <Pressable style={styles.secondary} onPress={() => navigation.navigate('ServiceCatalog')}>
          <Text style={styles.secondaryLbl}>{t('home.servicesCta', locale)}</Text>
        </Pressable>
      </View>
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
  center: { padding: 16 },
  err: { paddingHorizontal: 16, color: '#B91C1C', fontWeight: '600' },
  banner: { padding: 16, alignItems: 'center' },
  bannerTxt: { fontWeight: '600', color: '#B91C1C', textAlign: 'center' },
  link: { marginTop: 10, color: '#0369A1', fontWeight: '700' },
  card: {
    marginHorizontal: 16,
    marginTop: 10,
    padding: 14,
    backgroundColor: '#FFFFFF',
    borderRadius: 10,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: '#E2E8F0',
  },
  doc: { fontSize: 17, fontWeight: '800', color: '#0F172A' },
  svc: { marginTop: 4, fontSize: 14, color: '#334155' },
  stat: { marginTop: 8, fontSize: 12, fontWeight: '600', color: '#0369A1' },
  empty: { textAlign: 'center', color: '#475569', fontSize: 15 },
  pad: { paddingHorizontal: 16, paddingBottom: 16 },
  secondary: {
    borderWidth: 1,
    borderColor: '#0F4C75',
    borderRadius: 10,
    paddingVertical: 12,
    alignItems: 'center',
  },
  secondaryLbl: { color: '#0F4C75', fontWeight: '700', fontSize: 15 },
});

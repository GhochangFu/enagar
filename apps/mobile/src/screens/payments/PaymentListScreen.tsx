import { t } from '@enagar/i18n';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { StatusBar } from 'expo-status-bar';
import { useCallback, useState } from 'react';
import { ActivityIndicator, FlatList, Pressable, StyleSheet, Text, View } from 'react-native';

import { fetchPaymentList } from '../../api/paymentApi';
import { sessionApiRoot, useSession } from '../../context/SessionContext';
import type { CitizenRootStackParamList } from '../../navigation/types';
import type { PaymentApiResponse } from '../../types/dossier';

function formatInr(paise: number): string {
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    minimumFractionDigits: 2,
  }).format(paise / 100);
}

export function PaymentListScreen() {
  const navigation = useNavigation<NativeStackNavigationProp<CitizenRootStackParamList>>();
  const { locale, accessToken, selectedTenant } = useSession();
  const scope = selectedTenant?.code;

  const [rows, setRows] = useState<PaymentApiResponse[]>([]);
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
      const list = await fetchPaymentList(sessionApiRoot(), accessToken, scope);
      setRows(list);
    } catch {
      setRows([]);
      setErrorLine(t('payments.loadError', locale));
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
        <Text style={styles.h1}>{t('payments.title', locale)}</Text>
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
            <Text style={styles.empty}>{t('payments.empty', locale)}</Text>
          ) : null
        }
        renderItem={({ item }) => (
          <View style={styles.card}>
            <Text style={styles.amt}>{formatInr(item.amount_paise)}</Text>
            <Text style={styles.meta}>
              {item.method} · {item.status}
            </Text>
            <Text style={styles.meta}>App {item.application_id.slice(0, 8)}…</Text>
          </View>
        )}
      />
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
  amt: { fontSize: 18, fontWeight: '800', color: '#0F172A' },
  meta: { marginTop: 6, fontSize: 13, color: '#64748B', fontWeight: '600' },
  empty: { textAlign: 'center', color: '#475569', fontSize: 15 },
});

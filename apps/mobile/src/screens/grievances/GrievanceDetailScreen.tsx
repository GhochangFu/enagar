import { t } from '@enagar/i18n';
import type { RouteProp } from '@react-navigation/native';
import { useFocusEffect, useNavigation, useRoute } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { StatusBar } from 'expo-status-bar';
import { useCallback, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import { fetchGrievanceDetail, type GrievanceDetailDto } from '../../api/grievanceApi';
import { sessionApiRoot, useSession } from '../../context/SessionContext';
import type { CitizenRootStackParamList } from '../../navigation/types';

type DetailNav = NativeStackNavigationProp<CitizenRootStackParamList, 'GrievanceDetail'>;
type DetailRoute = RouteProp<CitizenRootStackParamList, 'GrievanceDetail'>;

export function GrievanceDetailScreen() {
  const navigation = useNavigation<DetailNav>();
  const route = useRoute<DetailRoute>();
  const { locale, accessToken, selectedTenant } = useSession();
  const grievanceId = route.params.id;
  const scope = route.params.tenantCode ?? selectedTenant?.code;

  const [detail, setDetail] = useState<GrievanceDetailDto | null>(null);
  const [busy, setBusy] = useState(false);
  const [errorLine, setErrorLine] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!accessToken || !scope) {
      setDetail(null);
      setErrorLine(t('grievance.signInRequired', locale));
      return;
    }

    setBusy(true);
    setErrorLine(null);

    try {
      const dto = await fetchGrievanceDetail(sessionApiRoot(), accessToken, scope, grievanceId);
      setDetail(dto);
    } catch {
      setErrorLine(t('grievance.loadError', locale));
      setDetail(null);
    } finally {
      setBusy(false);
    }
  }, [accessToken, grievanceId, locale, scope]);

  useFocusEffect(
    useCallback(() => {
      void load();
      return undefined;
    }, [load]),
  );

  const g = detail?.grievance;

  return (
    <View style={styles.outer}>
      <StatusBar style="dark" />

      <View style={styles.topBar}>
        <Pressable
          accessibilityRole="button"
          onPress={() => navigation.goBack()}
          style={styles.backBtn}
        >
          <Text style={styles.backLabel}>← Back</Text>
        </Pressable>
        <Text style={styles.h1}>{t('grievance.title', locale)}</Text>
      </View>

      {busy && !g ? (
        <View style={styles.loaderWrap}>
          <ActivityIndicator accessibilityLabel={t('grievance.title', locale)} />
        </View>
      ) : null}

      {errorLine ? <Text style={styles.error}>{errorLine}</Text> : null}

      {g ? (
        <ScrollView contentContainerStyle={styles.pad}>
          <Text style={styles.ref}>{g.grievance_no}</Text>
          <Text style={styles.cat}>{g.category}</Text>
          <Text style={styles.status}>
            {t('grievance.statusLabel', locale)} · {g.status}
          </Text>

          <View style={styles.block}>
            <Text style={styles.blockLabel}>Description</Text>
            <Text style={styles.body}>{g.description}</Text>
          </View>

          {g.sla_due_at ? (
            <Text style={styles.meta}>SLA due: {formatIso(g.sla_due_at)}</Text>
          ) : null}
          {g.sla_breached_at ? (
            <Text style={styles.alert}>SLA breached: {formatIso(g.sla_breached_at)}</Text>
          ) : null}

          <Text style={styles.timelineH}>Updates</Text>
          {(detail?.timeline ?? []).length === 0 ? (
            <Text style={styles.muted}>{t('grievance.empty', locale)}</Text>
          ) : (
            <View style={styles.timeline}>
              {(detail?.timeline ?? []).map((row) => (
                <View key={row.id} style={styles.tlCard}>
                  <Text style={styles.tlActor}>{row.actor_subject}</Text>
                  <Text style={styles.tlEvent}>{row.event_type}</Text>
                  {row.body ? <Text style={styles.tlBody}>{row.body}</Text> : null}
                  <Text style={styles.tlWhen}>{formatIso(row.occurred_at)}</Text>
                </View>
              ))}
            </View>
          )}
        </ScrollView>
      ) : null}
    </View>
  );
}

function formatIso(raw: string): string {
  const d = new Date(raw);
  return Number.isNaN(d.valueOf()) ? raw : d.toLocaleString();
}

const styles = StyleSheet.create({
  outer: { flex: 1, backgroundColor: '#F8FAFC' },
  topBar: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#E2E8F0',
  },
  backBtn: { marginBottom: 6, alignSelf: 'flex-start' },
  backLabel: { fontSize: 15, fontWeight: '600', color: '#0369A1' },
  h1: { fontSize: 20, fontWeight: '700', color: '#0F172A' },
  pad: { padding: 16, paddingBottom: 40 },
  ref: { fontSize: 20, fontWeight: '800', color: '#0F172A' },
  cat: {
    marginTop: 6,
    fontSize: 13,
    fontWeight: '700',
    color: '#64748B',
    textTransform: 'uppercase',
  },
  status: { marginTop: 10, fontSize: 14, fontWeight: '600', color: '#0369A1' },
  block: {
    marginTop: 18,
    padding: 14,
    backgroundColor: '#FFFFFF',
    borderRadius: 10,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: '#E2E8F0',
  },
  blockLabel: { fontSize: 12, fontWeight: '700', color: '#64748B', textTransform: 'uppercase' },
  body: { marginTop: 8, fontSize: 15, color: '#334155', lineHeight: 22 },
  meta: { marginTop: 12, fontSize: 13, color: '#475569' },
  alert: { marginTop: 6, fontSize: 13, fontWeight: '600', color: '#B91C1C' },
  timelineH: { marginTop: 28, marginBottom: 8, fontSize: 16, fontWeight: '700', color: '#0F172A' },
  muted: { fontSize: 14, color: '#64748B' },
  timeline: { gap: 10 },
  tlCard: {
    padding: 12,
    backgroundColor: '#FFFFFF',
    borderRadius: 10,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: '#E2E8F0',
  },
  tlActor: { fontSize: 14, fontWeight: '700', color: '#0F172A' },
  tlEvent: {
    marginTop: 4,
    fontSize: 13,
    fontWeight: '600',
    color: '#0369A1',
    textTransform: 'uppercase',
  },
  tlBody: { marginTop: 8, fontSize: 14, color: '#334155' },
  tlWhen: { marginTop: 8, fontSize: 11, color: '#94A3B8', fontVariant: ['tabular-nums'] },
  error: { padding: 16, color: '#991B1B', fontWeight: '600' },
  loaderWrap: { paddingVertical: 24 },
});

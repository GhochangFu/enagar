import { t } from '@enagar/i18n';
import type { RouteProp } from '@react-navigation/native';
import { useFocusEffect, useNavigation, useRoute } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { StatusBar } from 'expo-status-bar';
import { useCallback, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';

import { fetchApplicationByDocket, postApplicationComment } from '../../api/applicationApi';
import { completeStubPayment, fetchPaymentList, initiatePayment } from '../../api/paymentApi';
import { fetchTenantServices } from '../../api/servicesCatalogApi';
import { sessionApiRoot, useSession } from '../../context/SessionContext';
import { fixedFeePaise } from '../../lib/serviceSchemas';
import type { CitizenRootStackParamList } from '../../navigation/types';
import type { ApplicationDetail } from '../../types/dossier';
import type { PaymentApiResponse } from '../../types/dossier';
import type { PaymentGatewayMethod } from '../../types/dossier';
import type { ServiceSummary } from '../../types/dossier';

function formatInr(paise: number): string {
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    minimumFractionDigits: 2,
  }).format(paise / 100);
}

type DetailNav = NativeStackNavigationProp<CitizenRootStackParamList, 'ApplicationDetail'>;
type DetailRoute = RouteProp<CitizenRootStackParamList, 'ApplicationDetail'>;

const METHODS: PaymentGatewayMethod[] = ['upi', 'card', 'netbanking', 'wallet'];

export function ApplicationDetailScreen() {
  const navigation = useNavigation<DetailNav>();
  const route = useRoute<DetailRoute>();
  const docketNo = route.params.docketNo;

  const { locale, accessToken, selectedTenant } = useSession();
  const municipality = selectedTenant?.code ?? null;

  const [detail, setDetail] = useState<ApplicationDetail | null>(null);
  const [services, setServices] = useState<ServiceSummary[]>([]);
  const [payments, setPayments] = useState<PaymentApiResponse[]>([]);
  const [comment, setComment] = useState('');
  const [method, setMethod] = useState<PaymentGatewayMethod>('upi');
  const [payBusy, setPayBusy] = useState(false);
  const [busy, setBusy] = useState(true);
  const [errorLine, setErrorLine] = useState<string | null>(null);

  const reload = useCallback(async () => {
    if (!accessToken || !municipality) {
      setBusy(false);
      setErrorLine(t('applications.signInRequired', locale));
      return;
    }
    setBusy(true);
    setErrorLine(null);
    try {
      const row = await fetchApplicationByDocket(
        sessionApiRoot(),
        accessToken,
        municipality,
        docketNo,
      );
      setDetail(row);
      const tenantForCatalog = row.tenant_code ?? municipality;
      const [svcRows, paymentRows] = await Promise.all([
        fetchTenantServices(sessionApiRoot(), tenantForCatalog),
        fetchPaymentList(sessionApiRoot(), accessToken, tenantForCatalog),
      ]);
      setServices(svcRows);
      setPayments(paymentRows.filter((p) => p.application_id === row.id));
    } catch {
      setDetail(null);
      setErrorLine(t('applications.loadError', locale));
    } finally {
      setBusy(false);
    }
  }, [accessToken, docketNo, locale, municipality]);

  useFocusEffect(
    useCallback(() => {
      void reload();
      return undefined;
    }, [reload]),
  );

  const feePaise = useMemo(() => {
    if (!detail) {
      return null;
    }
    return fixedFeePaise(services, detail.service_code);
  }, [detail, services]);

  const pendingStub = payments.find((p) => p.status === 'requires_action');
  const latestSettled = payments.find((p) => p.status === 'settled');
  const canStartNewPayment = Boolean(
    accessToken &&
    feePaise &&
    detail &&
    (detail.payment_status === 'pending' || detail.payment_status === 'failed') &&
    !pendingStub &&
    !busy,
  );

  async function onPostComment() {
    if (!accessToken || !municipality || !detail?.id || !comment.trim()) {
      return;
    }
    try {
      const nextRow = await postApplicationComment(
        sessionApiRoot(),
        accessToken,
        municipality,
        detail.id,
        comment.trim(),
      );
      setDetail(nextRow);
      setComment('');
    } catch {
      setErrorLine(t('apply.genericError', locale));
    }
  }

  async function onPay() {
    if (!accessToken || !municipality || !detail?.id || !feePaise) {
      return;
    }
    setPayBusy(true);
    setErrorLine(null);
    try {
      await initiatePayment(sessionApiRoot(), accessToken, municipality, {
        application_id: detail.id,
        amount_paise: feePaise,
        method,
      });
      await reload();
    } catch {
      setErrorLine(t('apply.genericError', locale));
    } finally {
      setPayBusy(false);
    }
  }

  async function onStubComplete(row: PaymentApiResponse) {
    if (!accessToken || !detail) {
      return;
    }
    const scopePay = municipality ?? detail.tenant_code ?? null;
    setPayBusy(true);
    try {
      await completeStubPayment(sessionApiRoot(), accessToken, scopePay, {
        payment_id: row.id,
        gateway_order_id: row.gateway_order_id,
      });
      await reload();
    } catch {
      setErrorLine(t('apply.genericError', locale));
    } finally {
      setPayBusy(false);
    }
  }

  const g = detail;

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
        <Text style={styles.h1}>{t('applications.detailTitle', locale)}</Text>
      </View>

      {busy && !g ? (
        <View style={styles.center}>
          <ActivityIndicator />
        </View>
      ) : null}
      {errorLine ? <Text style={styles.err}>{errorLine}</Text> : null}

      {!busy && !g ? null : g ? (
        <ScrollView contentContainerStyle={styles.pad}>
          <Text style={styles.doc}>{g.docket_no}</Text>
          <Text style={styles.svc}>{g.service_name}</Text>
          <Text style={styles.stat}>
            {g.status_label} · {t('grievance.statusLabel', locale)} {g.current_stage}{' '}
          </Text>
          <Text style={styles.payMeta}>
            {t('dossier.paymentSection', locale)}: {g.payment_status}
            {feePaise ? ` (${formatInr(feePaise)})` : ''}
          </Text>

          <Text style={styles.section}>{t('dossier.timeline', locale)}</Text>
          {(g.timeline ?? []).map((step) => (
            <View key={step.id} style={styles.tl}>
              <Text style={styles.tlVerb}>{step.verb}</Text>
              <Text style={styles.tlSmall}>{step.to_stage}</Text>
              <Text style={styles.tlDate}>{step.created_at}</Text>
            </View>
          ))}

          <Text style={[styles.section, styles.mt]}>{t('dossier.comments', locale)}</Text>
          {(g.comments ?? []).map((cRow) => (
            <Text key={cRow.id} style={styles.commentLine}>
              {cRow.body}
            </Text>
          ))}
          <TextInput
            editable={Boolean(accessToken)}
            placeholder={t('dossier.commentPlaceholder', locale)}
            style={styles.commentBox}
            value={comment}
            onChangeText={setComment}
            multiline
          />
          <Pressable
            accessibilityRole="button"
            onPress={() => void onPostComment()}
            style={styles.commentCta}
          >
            <Text style={styles.commentCtaLbl}>{t('dossier.postComment', locale)}</Text>
          </Pressable>

          <Text style={[styles.section, styles.mt]}>{t('dossier.paymentSection', locale)}</Text>
          {(g.payment_status === 'pending' || g.payment_status === 'failed') &&
          feePaise &&
          latestSettled == null &&
          pendingStub == null ? (
            <Text style={styles.note}>{t('dossier.feePending', locale)}</Text>
          ) : null}

          <View style={styles.methodRow}>
            {METHODS.map((m) => (
              <Pressable
                key={m}
                accessibilityRole="button"
                onPress={() => setMethod(m)}
                style={[styles.methodChip, method === m && styles.methodChipOn]}
              >
                <Text style={[styles.methodLbl, method === m && styles.methodLblOn]}>{m}</Text>
              </Pressable>
            ))}
          </View>

          {canStartNewPayment ? (
            <Pressable
              accessibilityRole="button"
              disabled={payBusy}
              onPress={() => void onPay()}
              style={[styles.payCta, payBusy && styles.disabled]}
            >
              <Text style={styles.payCtaLbl}>{t('dossier.initiateStubPay', locale)}</Text>
            </Pressable>
          ) : null}

          {pendingStub ? (
            <View style={{ marginTop: 10 }}>
              <Text style={styles.note}>Stub PSP — {pendingStub.gateway_order_id}</Text>
              <Pressable
                accessibilityRole="button"
                disabled={payBusy}
                onPress={() => void onStubComplete(pendingStub)}
                style={[styles.payCta, payBusy && styles.disabled]}
              >
                <Text style={styles.payCtaLbl}>{t('dossier.simulateCapture', locale)}</Text>
              </Pressable>
            </View>
          ) : null}

          {latestSettled ? (
            <Text style={styles.ok}>
              {t('dossier.paymentSettled', locale)} — {latestSettled.id.slice(0, 8)}…
            </Text>
          ) : null}
        </ScrollView>
      ) : null}
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
  err: { paddingHorizontal: 16, fontWeight: '600', color: '#B91C1C' },
  pad: { padding: 16, paddingBottom: 48 },
  doc: { fontSize: 20, fontWeight: '800', color: '#0F172A' },
  svc: { marginTop: 6, fontSize: 16, color: '#334155' },
  stat: { marginTop: 8, fontSize: 14, color: '#0369A1', fontWeight: '600' },
  payMeta: { marginTop: 8, fontSize: 14, color: '#475569' },
  section: { marginTop: 22, fontSize: 16, fontWeight: '700', color: '#0F172A' },
  mt: { marginTop: 24 },
  tl: {
    marginTop: 8,
    padding: 12,
    backgroundColor: '#FFFFFF',
    borderRadius: 10,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: '#E2E8F0',
  },
  tlVerb: { fontWeight: '700', color: '#0F172A' },
  tlSmall: { marginTop: 4, fontSize: 13, color: '#64748B' },
  tlDate: { marginTop: 4, fontSize: 11, color: '#94A3B8' },
  commentLine: { marginTop: 6, fontSize: 14, color: '#334155' },
  commentBox: {
    marginTop: 10,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    borderRadius: 10,
    padding: 12,
    minHeight: 72,
    backgroundColor: '#FFFFFF',
    textAlignVertical: 'top',
    color: '#0F172A',
  },
  commentCta: {
    alignSelf: 'flex-start',
    marginTop: 10,
    backgroundColor: '#0F172A',
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 10,
  },
  commentCtaLbl: { color: '#FFFFFF', fontWeight: '700' },
  note: { marginTop: 8, color: '#475569', fontSize: 14 },
  methodRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 12 },
  methodChip: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    backgroundColor: '#FFFFFF',
  },
  methodChipOn: {
    borderColor: '#0F4C75',
    backgroundColor: 'rgba(15,76,117,0.08)',
  },
  methodLbl: { fontSize: 13, color: '#334155', textTransform: 'uppercase', fontWeight: '600' },
  methodLblOn: { color: '#0F4C75' },
  payCta: {
    marginTop: 14,
    backgroundColor: '#0F4C75',
    borderRadius: 12,
    alignItems: 'center',
    paddingVertical: 14,
  },
  payCtaLbl: { fontSize: 16, fontWeight: '700', color: '#FFFFFF' },
  disabled: { opacity: 0.5 },
  ok: { marginTop: 14, fontSize: 14, fontWeight: '700', color: '#166534' },
});

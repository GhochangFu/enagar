import { createRenderPlan, validateSubmission } from '@enagar/forms';
import { t } from '@enagar/i18n';
import type { RouteProp } from '@react-navigation/native';
import { useNavigation, useRoute } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { StatusBar } from 'expo-status-bar';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import { createApplicationDraft, submitDraft } from '../../api/applicationApi';
import { finalizeDraftDocumentsMobile, type MobilePendingFile } from '../../api/documentsApi';
import { fetchTenantService } from '../../api/servicesCatalogApi';
import { sessionApiRoot, useSession } from '../../context/SessionContext';
import { DynamicFormFields } from '../../forms/DynamicFormFields';
import { defaultFormValuesForService } from '../../lib/serviceSchemas';
import type { CitizenRootStackParamList } from '../../navigation/types';
import type { FormSubmission, FormSubmissionValue } from '@enagar/forms';

type Nav = NativeStackNavigationProp<CitizenRootStackParamList, 'ApplicationComposer'>;
type R = RouteProp<CitizenRootStackParamList, 'ApplicationComposer'>;

export function ApplicationComposerScreen() {
  const navigation = useNavigation<Nav>();
  const route = useRoute<R>();
  const serviceCode = route.params.serviceCode;
  const subtitle = route.params.serviceName ?? serviceCode;

  const { locale, accessToken, selectedTenant } = useSession();
  const municipality = selectedTenant?.code ?? null;

  const [service, setService] = useState(route.params.service ?? null);
  const [loadingSchema, setLoadingSchema] = useState(false);
  const schema = service?.form_schema ?? null;

  const [values, setValues] = useState<FormSubmission>(() =>
    defaultFormValuesForService(serviceCode),
  );
  const [pendingFiles, setPendingFiles] = useState<Record<string, MobilePendingFile>>({});
  const [busy, setBusy] = useState(false);
  const [errorLine, setErrorLine] = useState<string | null>(null);

  useEffect(() => {
    if (!municipality || service?.form_schema) {
      return;
    }

    let cancelled = false;
    setLoadingSchema(true);
    void fetchTenantService(sessionApiRoot(), municipality, serviceCode)
      .then((row) => {
        if (!cancelled) {
          setService(row);
        }
      })
      .catch(() => {
        if (!cancelled) {
          setErrorLine(t('services.loadError', locale));
        }
      })
      .finally(() => {
        if (!cancelled) {
          setLoadingSchema(false);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [locale, municipality, service?.form_schema, serviceCode]);

  const plan = useMemo(() => {
    if (!schema) {
      return null;
    }
    return createRenderPlan(schema, {
      locale: locale === 'bn' || locale === 'hi' ? locale : 'en',
      platform: 'native',
      values,
    });
  }, [locale, schema, values]);

  const setField = useCallback((fieldId: string, next: FormSubmissionValue | undefined) => {
    setValues((curr) => ({ ...curr, [fieldId]: next }));
  }, []);

  async function onSubmit() {
    if (!accessToken || !municipality || !schema) {
      setErrorLine(t('applications.signInRequired', locale));
      return;
    }

    const validation = validateSubmission(schema, values);
    if (!validation.ok) {
      const first = validation.issues[0]?.message ?? t('apply.validationError', locale);
      setErrorLine(`${t('apply.validationError', locale)}: ${first}`);
      return;
    }

    setBusy(true);
    setErrorLine(null);

    try {
      setErrorLine(t('apply.draftCreating', locale));
      const draft = await createApplicationDraft(sessionApiRoot(), accessToken, municipality, {
        service_code: serviceCode,
        form_data: values,
      });

      setErrorLine(t('apply.documentsBusy', locale));
      const docsOk = await finalizeDraftDocumentsMobile(
        sessionApiRoot(),
        accessToken,
        municipality,
        draft.id,
        schema,
        values,
        pendingFiles,
      );

      if (!docsOk) {
        setErrorLine(t('apply.genericError', locale));
        return;
      }

      setErrorLine(t('apply.submitBusy', locale));
      const submitted = await submitDraft(sessionApiRoot(), accessToken, municipality, draft.id);
      navigation.replace('ApplicationDetail', { docketNo: submitted.docket_no });
    } catch {
      setErrorLine(t('apply.genericError', locale));
    } finally {
      setBusy(false);
    }
  }

  if (loadingSchema) {
    return (
      <View style={styles.outer}>
        <ActivityIndicator style={{ marginTop: 48 }} />
      </View>
    );
  }

  if (!schema) {
    return (
      <View style={styles.outer}>
        <Text style={styles.err}>{`No published form is available for ${serviceCode}.`}</Text>
        <Pressable onPress={() => navigation.goBack()}>
          <Text style={styles.back}>{t('grievance.back', locale)}</Text>
        </Pressable>
      </View>
    );
  }

  return (
    <View style={styles.outer}>
      <StatusBar style="dark" />
      <View style={styles.topBar}>
        <Pressable
          accessibilityRole="button"
          onPress={() => navigation.goBack()}
          style={styles.backPress}
        >
          <Text style={styles.backLbl}>{t('grievance.back', locale)}</Text>
        </Pressable>
        <Text style={styles.h1}>{t('apply.title', locale)}</Text>
        <Text style={styles.sub}>{subtitle}</Text>
        {__DEV__ ? <Text style={styles.dev}>{t('apply.developerPrefillHint', locale)}</Text> : null}
      </View>

      <ScrollView contentContainerStyle={styles.scroll}>
        {plan ? (
          <DynamicFormFields
            nodes={plan.nodes}
            onChange={setField}
            values={values}
            onFilePick={(fieldId, pending) => {
              setPendingFiles((current) => {
                const next = { ...current };
                if (pending) {
                  next[fieldId] = pending;
                } else {
                  delete next[fieldId];
                }
                return next;
              });
            }}
          />
        ) : null}

        {errorLine ? (
          <Text style={[styles.err, busy ? styles.status : null]}>{errorLine}</Text>
        ) : null}

        <Pressable
          accessibilityRole="button"
          disabled={busy}
          onPress={() => void onSubmit()}
          style={[styles.primary, busy && styles.disabled]}
        >
          <Text style={styles.primaryLbl}>{t('apply.submit', locale)}</Text>
        </Pressable>

        {busy ? <ActivityIndicator style={{ marginTop: 14 }} /> : null}
      </ScrollView>
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
  scroll: { padding: 16, paddingBottom: 48 },
  backPress: { marginBottom: 6 },
  backLbl: { fontSize: 15, fontWeight: '600', color: '#0369A1' },
  h1: { fontSize: 20, fontWeight: '700', color: '#0F172A' },
  sub: { marginTop: 4, fontSize: 14, color: '#475569' },
  dev: { marginTop: 6, fontSize: 11, color: '#94A3B8' },
  primary: {
    marginTop: 28,
    backgroundColor: '#0F4C75',
    borderRadius: 12,
    alignItems: 'center',
    paddingVertical: 14,
  },
  primaryLbl: { color: '#FFFFFF', fontSize: 16, fontWeight: '700' },
  disabled: { opacity: 0.55 },
  err: { marginTop: 12, fontSize: 14, color: '#B91C1C', fontWeight: '600' },
  status: { color: '#0369A1' },
  back: { padding: 16, color: '#0369A1', fontWeight: '600' },
});

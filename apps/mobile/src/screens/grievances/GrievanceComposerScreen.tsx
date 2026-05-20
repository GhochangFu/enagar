import {
  fetchPublicGrievanceCatalogue,
  resolveGrievanceCategoryLabel,
  resolveGrievanceSubtypeLabel,
  sortCatalogueCategories,
  type GrievanceCatalogueCategory,
  type GrievanceCatalogueResponse,
  type GrievanceCatalogueSubtype,
} from '@enagar/grievance-catalogue';
import { t } from '@enagar/i18n';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { StatusBar } from 'expo-status-bar';
import { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';

import type { CitizenRootStackParamList } from '../../navigation/types';

import { createGrievance } from '../../api/grievanceApi';

import { sessionApiRoot, useSession } from '../../context/SessionContext';

import {
  loadGrievanceComposerDraft,
  persistGrievanceComposerDraft,
  clearGrievanceComposerDraft,
  type GrievanceComposerDraftPayload,
} from '../../draft/grievanceComposerDraft';

const PRIORITIES: GrievanceComposerDraftPayload['priority'][] = ['low', 'medium', 'high', 'urgent'];

type ComposerStep = 'category' | 'subtype' | 'form';

export function GrievanceComposerScreen() {
  const navigation = useNavigation<NativeStackNavigationProp<CitizenRootStackParamList>>();
  const { locale, accessToken, selectedTenant } = useSession();
  const lng = locale;
  const municipality = selectedTenant?.code ?? null;

  const [step, setStep] = useState<ComposerStep>('category');
  const [catalogue, setCatalogue] = useState<GrievanceCatalogueResponse | null>(null);
  const [catalogueLoading, setCatalogueLoading] = useState(false);
  const [catalogueError, setCatalogueError] = useState<string | null>(null);
  const [categoryCode, setCategoryCode] = useState<string | null>(null);
  const [subtypeCode, setSubtypeCode] = useState<string | null>(null);
  const [description, setDescription] = useState('');
  const [priority, setPriority] = useState<GrievanceComposerDraftPayload['priority']>('medium');
  const [wardHint, setWardHint] = useState('');
  const [addressHint, setAddressHint] = useState('');
  const [busy, setBusy] = useState(false);
  const [errorLine, setErrorLine] = useState<string | null>(null);

  const selectedCategory: GrievanceCatalogueCategory | undefined = catalogue?.categories.find(
    (row) => row.code === categoryCode,
  );

  useEffect(() => {
    if (!municipality) {
      return;
    }
    let cancelled = false;
    setCatalogueLoading(true);
    setCatalogueError(null);
    void fetchPublicGrievanceCatalogue(sessionApiRoot(), municipality)
      .then((data) => {
        if (!cancelled) {
          setCatalogue(data);
        }
      })
      .catch((err: unknown) => {
        if (!cancelled) {
          setCatalogue(null);
          setCatalogueError(err instanceof Error ? err.message : t('grievance.loadError', lng));
        }
      })
      .finally(() => {
        if (!cancelled) {
          setCatalogueLoading(false);
        }
      });
    return () => {
      cancelled = true;
    };
  }, [lng, municipality]);

  useEffect(() => {
    let cancelled = false;

    void (async () => {
      if (!municipality) {
        return;
      }

      const saved = await loadGrievanceComposerDraft(municipality);
      if (cancelled || !saved) {
        return;
      }

      setCategoryCode(saved.category_slug || null);
      setSubtypeCode(saved.subtype_slug ?? null);
      setDescription(saved.description ?? '');
      setPriority(saved.priority);
      setWardHint(saved.ward_hint ?? '');
      setAddressHint(saved.address_hint ?? '');
      setStep(saved.subtype_slug ? 'form' : saved.category_slug ? 'form' : 'category');
    })();

    return () => {
      cancelled = true;
    };
  }, [municipality]);

  useEffect(() => {
    if (!municipality || !categoryCode) {
      return undefined;
    }

    const id = setTimeout(() => {
      void persistGrievanceComposerDraft(municipality, {
        category_slug: categoryCode,
        ...(subtypeCode ? { subtype_slug: subtypeCode } : {}),
        description,
        priority,
        ...(wardHint ? { ward_hint: wardHint } : {}),
        ...(addressHint ? { address_hint: addressHint } : {}),
      });
    }, 420);

    return () => clearTimeout(id);
  }, [addressHint, categoryCode, description, municipality, priority, subtypeCode, wardHint]);

  function pickCategory(row: GrievanceCatalogueCategory): void {
    setCategoryCode(row.code);
    setSubtypeCode(null);
    if (row.subtypes.length > 0) {
      setStep('subtype');
    } else {
      setStep('form');
    }
  }

  function pickSubtype(row: GrievanceCatalogueSubtype): void {
    setSubtypeCode(row.code);
    setStep('form');
  }

  async function submit() {
    setErrorLine(null);

    const trimmedDesc = description.trim();

    if (!categoryCode) {
      setErrorLine(t('grievance.chooseCategory', lng));
      setStep('category');
      return;
    }
    if (selectedCategory && selectedCategory.subtypes.length > 0 && !subtypeCode) {
      setErrorLine(t('grievance.chooseSubtype', lng));
      setStep('subtype');
      return;
    }
    if (trimmedDesc.length < 3) {
      setErrorLine('Describe the issue in at least 3 characters.');
      return;
    }
    if (!accessToken || !municipality) {
      navigation.replace('OtpLogin');
      return;
    }

    setBusy(true);

    try {
      await createGrievance(sessionApiRoot(), accessToken, municipality, {
        category: categoryCode,
        ...(subtypeCode ? { subtype_code: subtypeCode } : {}),
        description: trimmedDesc,
        grievance_priority: priority,
        location: {
          ...(addressHint.trim() ? { address: addressHint.trim() } : {}),
          ...(wardHint.trim() ? { ward_hint: wardHint.trim() } : {}),
        },
      });
      await clearGrievanceComposerDraft(municipality);
      navigation.replace('GrievanceList');
    } catch {
      setErrorLine(t('grievance.submitError', lng));
    } finally {
      setBusy(false);
    }
  }

  function categoryChip(row: GrievanceCatalogueCategory) {
    const selected = row.code === categoryCode;
    return (
      <Pressable
        key={row.code}
        accessibilityRole="button"
        accessibilityState={{ selected }}
        onPress={() => pickCategory(row)}
        style={[styles.slugChip, selected && styles.slugChipSel]}
      >
        <Text style={[styles.slugLabel, selected && styles.slugLabelSel]} numberOfLines={2}>
          {resolveGrievanceCategoryLabel(row.code, row.name, lng)}
        </Text>
      </Pressable>
    );
  }

  function subtypeChip(row: GrievanceCatalogueSubtype) {
    const selected = row.code === subtypeCode;
    return (
      <Pressable
        key={row.code}
        accessibilityRole="button"
        accessibilityState={{ selected }}
        onPress={() => pickSubtype(row)}
        style={[styles.slugChip, selected && styles.slugChipSel]}
      >
        <Text style={[styles.slugLabel, selected && styles.slugLabelSel]} numberOfLines={2}>
          {resolveGrievanceSubtypeLabel(row, lng)}
        </Text>
      </Pressable>
    );
  }

  return (
    <ScrollView
      keyboardShouldPersistTaps="handled"
      style={{ flex: 1 }}
      contentContainerStyle={{ paddingBottom: 40 }}
    >
      <StatusBar style="dark" />

      <View style={{ padding: 16 }}>
        <Text style={styles.screenTitle}>{t('grievance.fileNew', lng)}</Text>
        <Text style={{ color: '#475569', marginBottom: 8 }}>{t('grievance.intro', lng)}</Text>

        {step === 'category' ? (
          <>
            <Text style={styles.label}>{t('grievance.chooseCategory', lng)}</Text>
            {catalogueLoading ? <ActivityIndicator style={{ marginVertical: 12 }} /> : null}
            {catalogueError ? <Text style={styles.error}>{catalogueError}</Text> : null}
            <View style={styles.slugGrid}>
              {sortCatalogueCategories(catalogue?.categories ?? []).map(categoryChip)}
            </View>
          </>
        ) : null}

        {step === 'subtype' && categoryCode ? (
          <>
            <Pressable accessibilityRole="button" onPress={() => setStep('category')}>
              <Text style={styles.backLink}>← {t('grievance.back', lng)}</Text>
            </Pressable>
            <Text style={styles.label}>{t('grievance.chooseSubtype', lng)}</Text>
            <Text style={{ color: '#475569', marginBottom: 8 }}>
              {resolveGrievanceCategoryLabel(categoryCode, selectedCategory?.name, lng)}
            </Text>
            <View style={styles.slugGrid}>
              {(selectedCategory?.subtypes ?? []).map(subtypeChip)}
            </View>
          </>
        ) : null}

        {step === 'form' && categoryCode ? (
          <>
            <Pressable
              accessibilityRole="button"
              onPress={() => {
                if (selectedCategory && selectedCategory.subtypes.length > 0) {
                  setStep('subtype');
                  return;
                }
                setStep('category');
              }}
            >
              <Text style={styles.backLink}>← {t('grievance.back', lng)}</Text>
            </Pressable>
            <Text style={styles.formHeading}>
              {resolveGrievanceCategoryLabel(categoryCode, selectedCategory?.name, lng)}
              {subtypeCode
                ? ` · ${
                    resolveGrievanceSubtypeLabel(
                      selectedCategory?.subtypes.find((s) => s.code === subtypeCode),
                      lng,
                    ) ?? subtypeCode
                  }`
                : ''}
            </Text>

            <Text style={[styles.label, { marginTop: 14 }]}>{t('grievance.description', lng)}</Text>
            <Text style={{ color: '#475569', fontSize: 12, marginBottom: 6 }}>
              {t('grievance.descriptionHelp', lng)}
            </Text>
            <TextInput
              style={styles.bigInput}
              multiline
              numberOfLines={5}
              onChangeText={setDescription}
              value={description}
            />

            <Text style={[styles.label, { marginTop: 14 }]}>{t('grievance.priority', lng)}</Text>
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
              {PRIORITIES.map((p) => (
                <Pressable
                  key={p}
                  accessibilityRole="button"
                  accessibilityState={{ selected: p === priority }}
                  onPress={() => setPriority(p)}
                  style={[styles.priChip, p === priority && styles.priChipSel]}
                >
                  <Text
                    style={{
                      fontWeight: '600',
                      textTransform: 'capitalize',
                      color: p === priority ? '#FFFFFF' : '#0F172A',
                    }}
                  >
                    {p}
                  </Text>
                </Pressable>
              ))}
            </View>

            <Text style={[styles.label, { marginTop: 14 }]}>
              {t('grievance.optionalLocation', lng)}
            </Text>
            <TextInput style={styles.input} onChangeText={setAddressHint} value={addressHint} />

            <Text style={[styles.label, { marginTop: 10 }]}>
              {t('grievance.optionalWard', lng)}
            </Text>
            <TextInput style={styles.input} onChangeText={setWardHint} value={wardHint} />
          </>
        ) : null}

        {errorLine ? <Text style={styles.error}>{errorLine}</Text> : null}

        <Pressable
          accessibilityRole="button"
          onPress={() => navigation.goBack()}
          style={styles.secondary}
        >
          <Text style={styles.secondaryLabel}>{t('grievance.back', lng)}</Text>
        </Pressable>

        {step === 'form' ? (
          <Pressable
            accessibilityRole="button"
            disabled={busy}
            onPress={() => submit()}
            style={[styles.primary, busy && styles.disabled]}
          >
            {busy ? <ActivityIndicator accessibilityLabel={t('status.sendingOtp', lng)} /> : null}
            <Text style={[styles.primaryLabel, { marginTop: busy ? 10 : 4 }]}>
              {t('grievance.submit', lng)}
            </Text>
          </Pressable>
        ) : null}
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screenTitle: {
    fontSize: 21,
    fontWeight: '700',
    marginBottom: 6,
    color: '#0F172A',
  },
  formHeading: {
    fontSize: 17,
    fontWeight: '700',
    color: '#0F172A',
    marginTop: 8,
  },
  backLink: {
    color: '#0F4C75',
    fontWeight: '600',
    marginBottom: 8,
  },
  slugGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  slugChip: {
    borderRadius: 8,
    borderWidth: StyleSheet.hairlineWidth,
    paddingHorizontal: 10,
    paddingVertical: 7,
    backgroundColor: '#FFFFFF',
    borderColor: '#CBD5F5',
    maxWidth: '48%',
    flexGrow: 1,
  },
  slugChipSel: {
    borderColor: '#0F4C75',
    backgroundColor: '#E0F2FE',
  },
  slugLabel: { fontSize: 12, fontWeight: '600', color: '#0F172A' },
  slugLabelSel: { color: '#0F4C75' },
  label: {
    marginTop: 10,
    fontSize: 11,
    color: '#64748B',
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.6,
  },
  priChip: {
    borderRadius: 999,
    borderWidth: 1,
    borderColor: '#94A3B8',
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  priChipSel: { backgroundColor: '#0F4C75', borderColor: '#0F4C75' },
  input: {
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: '#CBD5F5',
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    backgroundColor: '#FFFFFF',
  },
  bigInput: {
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: '#CBD5F5',
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 12,
    minHeight: 120,
    textAlignVertical: 'top',
    backgroundColor: '#FFFFFF',
    color: '#0F172A',
  },
  secondary: {
    marginTop: 22,
    borderWidth: 1,
    borderColor: '#0F172A',
    paddingVertical: 12,
    borderRadius: 10,
    alignItems: 'center',
  },
  secondaryLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: '#0F172A',
  },
  primary: {
    marginTop: 16,
    backgroundColor: '#0F4C75',
    borderRadius: 10,
    paddingVertical: 14,
    alignItems: 'center',
  },
  primaryLabel: {
    color: '#FFFFFF',
    fontSize: 17,
    fontWeight: '700',
  },
  disabled: {
    opacity: 0.6,
  },
  error: {
    marginTop: 14,
    fontWeight: '600',
    fontSize: 14,
    color: '#B91C1C',
  },
});

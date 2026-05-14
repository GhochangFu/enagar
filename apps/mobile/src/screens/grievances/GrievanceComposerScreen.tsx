import { t, type MessageKey } from '@enagar/i18n';
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

import type { GrievanceCategorySlug } from '../../constants/grievanceCategories';

import { GRIEVANCE_CATEGORY_SLUGS } from '../../constants/grievanceCategories';

import { sessionApiRoot, useSession } from '../../context/SessionContext';

import {
  loadGrievanceComposerDraft,
  persistGrievanceComposerDraft,
  clearGrievanceComposerDraft,
  type GrievanceComposerDraftPayload,
} from '../../draft/grievanceComposerDraft';

function slugLabel(lng: 'en' | 'bn' | 'hi', slug: GrievanceCategorySlug): string {
  const key = CATEGORY_KEYS[slug];
  return t(key, lng);
}

const CATEGORY_KEYS: Record<GrievanceCategorySlug, MessageKey> = {
  roads: 'grievance.cat.roads',
  sanitation: 'grievance.cat.sanitation',
  streetlights: 'grievance.cat.streetlights',
  water: 'grievance.cat.water',
  drainage: 'grievance.cat.drainage',
  stray_dogs: 'grievance.cat.stray_dogs',
  parks: 'grievance.cat.parks',
  encroachment: 'grievance.cat.encroachment',
  trade: 'grievance.cat.trade',
  other: 'grievance.cat.other',
};

const PRIORITIES: GrievanceComposerDraftPayload['priority'][] = ['low', 'medium', 'high', 'urgent'];

export function GrievanceComposerScreen() {
  const navigation = useNavigation<NativeStackNavigationProp<CitizenRootStackParamList>>();
  const { locale, accessToken, selectedTenant } = useSession();
  const lng = locale;
  const municipality = selectedTenant?.code ?? null;

  const [category, setCategory] = useState<GrievanceCategorySlug>('roads');
  const [description, setDescription] = useState('');
  const [priority, setPriority] = useState<GrievanceComposerDraftPayload['priority']>('medium');
  const [wardHint, setWardHint] = useState('');
  const [addressHint, setAddressHint] = useState('');
  const [busy, setBusy] = useState(false);
  const [errorLine, setErrorLine] = useState<string | null>(null);

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

      const slug = saved.category_slug;
      const safeCat =
        slug && GRIEVANCE_CATEGORY_SLUGS.includes(slug as GrievanceCategorySlug)
          ? (slug as GrievanceCategorySlug)
          : 'roads';

      setCategory(safeCat);
      setDescription(saved.description ?? '');
      setPriority(saved.priority);
      setWardHint(saved.ward_hint ?? '');
      setAddressHint(saved.address_hint ?? '');
    })();

    return () => {
      cancelled = true;
    };
  }, [municipality]);

  useEffect(() => {
    if (!municipality) {
      return undefined;
    }

    const id = setTimeout(() => {
      void persistGrievanceComposerDraft(municipality, {
        category_slug: category,
        description,
        priority,
        ...(wardHint ? { ward_hint: wardHint } : {}),
        ...(addressHint ? { address_hint: addressHint } : {}),
      });
    }, 420);

    return () => clearTimeout(id);
  }, [addressHint, category, description, municipality, priority, wardHint]);

  async function submit() {
    setErrorLine(null);

    const trimmedDesc = description.trim();

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
        category,
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

  function chips(slug: GrievanceCategorySlug) {
    const selected = slug === category;

    return (
      <Pressable
        key={slug}
        accessibilityRole="button"
        accessibilityState={{ selected }}
        onPress={() => setCategory(slug)}
        style={[styles.slugChip, selected && styles.slugChipSel]}
      >
        <Text style={[styles.slugLabel, selected && styles.slugLabelSel]} numberOfLines={2}>
          {slugLabel(lng, slug)}
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

        <Text style={styles.label}>{t('grievance.chooseCategory', lng)}</Text>
        <View style={styles.slugGrid}>{GRIEVANCE_CATEGORY_SLUGS.map(chips)}</View>

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

        <Text style={[styles.label, { marginTop: 10 }]}>{t('grievance.optionalWard', lng)}</Text>
        <TextInput style={styles.input} onChangeText={setWardHint} value={wardHint} />

        {errorLine ? <Text style={styles.error}>{errorLine}</Text> : null}

        <Pressable
          accessibilityRole="button"
          onPress={() => navigation.goBack()}
          style={styles.secondary}
        >
          <Text style={styles.secondaryLabel}>{t('grievance.back', lng)}</Text>
        </Pressable>

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

import { t } from '@enagar/i18n';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { StatusBar } from 'expo-status-bar';
import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { patchCitizenPreferences } from '../api/citizenHubApi';
import { MobileHubHero, MobilePrimaryButton } from '../components/ui/MobileChrome';
import { MAX_PINNED_MUNICIPALITIES } from '../constants/citizenPortal';
import { sessionApiRoot, useSession } from '../context/SessionContext';
import type { CitizenRootStackParamList } from '../navigation/types';
import { fetchPublicTenants, type TenantListItem } from '../tenantApi';
import {
  MOBILE_CANVAS_HEX,
  MOBILE_ERROR_HEX,
  MOBILE_INK_PRIMARY,
  MOBILE_INK_SECONDARY,
  MOBILE_LINK_HEX,
  MOBILE_PEACH_SOFT_HEX,
  MOBILE_SURFACE_HEX,
  MOBILE_WARM_BORDER,
  platformBrandHex,
  resolveTenantBrandHex,
} from '../theme/citizenMobileTheme';

export function PinMunicipalitiesScreen() {
  const navigation = useNavigation<NativeStackNavigationProp<CitizenRootStackParamList>>();
  const { locale, accessToken } = useSession();
  const [tenants, setTenants] = useState<TenantListItem[]>([]);
  const [draftPins, setDraftPins] = useState<string[]>([]);
  const [search, setSearch] = useState('');
  const [busy, setBusy] = useState(false);
  const [loading, setLoading] = useState(true);
  const [errorLine, setErrorLine] = useState<string | null>(null);

  const brand = platformBrandHex();

  const loadCatalogue = useCallback(async () => {
    setLoading(true);
    setErrorLine(null);
    try {
      const rows = await fetchPublicTenants(sessionApiRoot());
      setTenants(rows.filter((row) => row.code !== 'WBPORTAL'));
    } catch {
      setErrorLine(t('status.apiUnreachable', locale));
    } finally {
      setLoading(false);
    }
  }, [locale]);

  useEffect(() => {
    void loadCatalogue();
  }, [loadCatalogue]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) {
      return tenants;
    }
    return tenants.filter(
      (row) =>
        row.code.toLowerCase().includes(q) ||
        row.name.toLowerCase().includes(q) ||
        row.district.toLowerCase().includes(q),
    );
  }, [search, tenants]);

  function togglePin(code: string) {
    setDraftPins((prev) => {
      if (prev.includes(code)) {
        return prev.filter((c) => c !== code);
      }
      if (prev.length >= MAX_PINNED_MUNICIPALITIES) {
        return prev;
      }
      return [...prev, code];
    });
  }

  async function onSave() {
    if (!accessToken || draftPins.length === 0) {
      setErrorLine('Pin at least one municipality to continue.');
      return;
    }
    setBusy(true);
    setErrorLine(null);
    try {
      await patchCitizenPreferences(sessionApiRoot(), accessToken, {
        pinned_tenant_codes: draftPins,
      });
      navigation.replace('CitizenHub');
    } catch {
      setErrorLine(t('status.apiUnreachable', locale));
    } finally {
      setBusy(false);
    }
  }

  return (
    <SafeAreaView style={styles.fill}>
      <StatusBar style="dark" />
      <View style={styles.inner}>
        <MobileHubHero
          eyebrow="First-time setup"
          subtitle={`Choose up to ${MAX_PINNED_MUNICIPALITIES} ULBs you use most. Change later in Shortcuts.`}
          title="Pin your municipalities"
        />

        <TextInput
          accessibilityLabel="Search municipalities"
          onChangeText={setSearch}
          placeholder="Search code, name, district"
          placeholderTextColor="#94A3B8"
          style={styles.search}
          value={search}
        />

        {loading ? (
          <ActivityIndicator color={brand} style={{ marginTop: 24 }} />
        ) : (
          <FlatList
            data={filtered}
            keyExtractor={(item) => item.id}
            contentContainerStyle={{ paddingBottom: 120 }}
            renderItem={({ item }) => {
              const pinned = draftPins.includes(item.code);
              return (
                <Pressable
                  accessibilityRole="checkbox"
                  accessibilityState={{ checked: pinned }}
                  onPress={() => togglePin(item.code)}
                  style={[
                    styles.row,
                    { borderLeftColor: resolveTenantBrandHex(item.theme_color) },
                    pinned && styles.rowPinned,
                  ]}
                >
                  <View style={{ flex: 1 }}>
                    <Text style={styles.rowTitle}>{item.name}</Text>
                    <Text style={styles.rowMeta}>
                      {item.code} · {item.district}
                    </Text>
                  </View>
                  <Text style={styles.check}>{pinned ? '✓' : ''}</Text>
                </Pressable>
              );
            }}
          />
        )}

        {errorLine ? <Text style={styles.error}>{errorLine}</Text> : null}
      </View>
      <View style={styles.footer}>
        <MobilePrimaryButton
          disabled={busy || draftPins.length === 0}
          label={busy ? 'Saving…' : `Continue (${draftPins.length} pinned)`}
          onPress={() => void onSave()}
        />
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  fill: { flex: 1, backgroundColor: MOBILE_CANVAS_HEX },
  inner: { flex: 1, paddingHorizontal: 16, paddingTop: 8 },
  search: {
    marginTop: 16,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: MOBILE_WARM_BORDER,
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 10,
    backgroundColor: '#FFFFFF',
    fontSize: 15,
    color: MOBILE_INK_PRIMARY,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 10,
    padding: 14,
    borderRadius: 12,
    borderLeftWidth: 4,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: MOBILE_WARM_BORDER,
    backgroundColor: '#FFFFFF',
  },
  rowPinned: { backgroundColor: MOBILE_PEACH_SOFT_HEX, borderColor: MOBILE_LINK_HEX },
  rowTitle: { fontSize: 16, fontWeight: '700', color: MOBILE_INK_PRIMARY },
  rowMeta: { marginTop: 4, fontSize: 13, color: MOBILE_INK_SECONDARY },
  check: {
    fontSize: 20,
    fontWeight: '800',
    color: MOBILE_INK_PRIMARY,
    width: 28,
    textAlign: 'center',
  },
  error: { marginTop: 10, color: MOBILE_ERROR_HEX, fontWeight: '600' },
  footer: {
    padding: 16,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: MOBILE_WARM_BORDER,
    backgroundColor: MOBILE_SURFACE_HEX,
  },
});

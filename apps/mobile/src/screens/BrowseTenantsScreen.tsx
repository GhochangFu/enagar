import { t } from '@enagar/i18n';
import { useNavigation, useRoute } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import type { RouteProp } from '@react-navigation/native';
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

import { selectCitizenTenant } from '../api/citizenHubApi';
import { sessionApiRoot, useSession } from '../context/SessionContext';
import type { CitizenRootStackParamList } from '../navigation/types';
import { fetchPublicTenants, type TenantListItem } from '../tenantApi';
import { MobileHubHero, MobileScreen } from '../components/ui/MobileChrome';
import {
  MOBILE_ERROR_HEX,
  MOBILE_INK_PRIMARY,
  MOBILE_INK_SECONDARY,
  MOBILE_LINK_HEX,
  MOBILE_RADIUS_MD,
  MOBILE_SURFACE_HEX,
  MOBILE_WARM_BORDER,
  mobileShadowCard,
  platformBrandHex,
  resolveTenantBrandHex,
} from '../theme/citizenMobileTheme';

type BrowseRoute = RouteProp<CitizenRootStackParamList, 'BrowseTenants'>;

export function BrowseTenantsScreen() {
  const navigation = useNavigation<NativeStackNavigationProp<CitizenRootStackParamList>>();
  const route = useRoute<BrowseRoute>();
  const intent = route.params?.intent ?? 'workspace';
  const { locale, accessToken, selectTenant } = useSession();
  const [tenants, setTenants] = useState<TenantListItem[]>([]);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [errorLine, setErrorLine] = useState<string | null>(null);
  const [entering, setEntering] = useState<string | null>(null);

  const load = useCallback(async () => {
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
    void load();
  }, [load]);

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

  async function enterWorkspace(tenant: TenantListItem) {
    if (!accessToken) {
      navigation.replace('OtpLogin');
      return;
    }
    setEntering(tenant.code);
    selectTenant(tenant);
    try {
      await selectCitizenTenant(sessionApiRoot(), accessToken, tenant.code);
    } catch {
      /* local workspace still usable */
    }
    setEntering(null);
    if (intent === 'grievance') {
      navigation.navigate('GrievanceComposer');
      return;
    }
    navigation.navigate('Workspace');
  }

  return (
    <MobileScreen>
      <StatusBar style="dark" />
      <View style={styles.inner}>
        <Pressable
          accessibilityRole="button"
          onPress={() => navigation.goBack()}
          style={styles.back}
        >
          <Text style={styles.backLabel}>← Back to hub</Text>
        </Pressable>
        <MobileHubHero
          eyebrow="Municipalities"
          title={intent === 'grievance' ? 'Choose ULB for grievance' : 'Browse all municipalities'}
        />
        <TextInput
          onChangeText={setSearch}
          placeholder="Search code, name, district"
          placeholderTextColor="#94A3B8"
          style={styles.search}
          value={search}
        />
        {loading ? (
          <ActivityIndicator color={platformBrandHex()} style={{ marginTop: 20 }} />
        ) : null}
        {errorLine ? (
          <Pressable onPress={() => void load()}>
            <Text style={styles.error}>{errorLine}</Text>
          </Pressable>
        ) : null}
        <FlatList
          data={filtered}
          keyExtractor={(item) => item.id}
          renderItem={({ item }) => (
            <Pressable
              accessibilityRole="button"
              disabled={entering === item.code}
              onPress={() => void enterWorkspace(item)}
              style={[styles.card, { borderLeftColor: resolveTenantBrandHex(item.theme_color) }]}
            >
              <Text style={styles.name}>{item.name}</Text>
              <Text style={styles.meta}>
                {item.code} · {item.district}
              </Text>
            </Pressable>
          )}
        />
      </View>
    </MobileScreen>
  );
}

const styles = StyleSheet.create({
  inner: { flex: 1, paddingHorizontal: 16, paddingTop: 4 },
  back: { marginBottom: 4 },
  backLabel: { fontSize: 14, fontWeight: '700', color: MOBILE_LINK_HEX },
  search: {
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: MOBILE_WARM_BORDER,
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 10,
    backgroundColor: '#FFFFFF',
    marginBottom: 12,
    fontSize: 15,
    color: MOBILE_INK_PRIMARY,
  },
  card: {
    marginBottom: 10,
    padding: 14,
    borderRadius: MOBILE_RADIUS_MD,
    borderLeftWidth: 4,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: MOBILE_WARM_BORDER,
    backgroundColor: MOBILE_SURFACE_HEX,
    ...mobileShadowCard,
  },
  name: { fontSize: 16, fontWeight: '700', color: MOBILE_INK_PRIMARY },
  meta: { marginTop: 4, fontSize: 13, color: MOBILE_INK_SECONDARY },
  error: { color: MOBILE_ERROR_HEX, fontWeight: '600', marginBottom: 8 },
});

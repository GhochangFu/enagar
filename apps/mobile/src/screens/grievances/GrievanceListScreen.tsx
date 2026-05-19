import { t } from '@enagar/i18n';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { StatusBar } from 'expo-status-bar';
import { useCallback, useMemo, useState } from 'react';
import { ActivityIndicator, FlatList, Pressable, StyleSheet, Text, View } from 'react-native';

import { fetchGrievanceList, type GrievanceListItemDto } from '../../api/grievanceApi';
import { MobilePrimaryButton, MobileScreen } from '../../components/ui/MobileChrome';
import { grievanceRowTenantScope } from '../../lib/grievanceScope';
import { sessionApiRoot, useSession } from '../../context/SessionContext';
import type { CitizenRootStackParamList } from '../../navigation/types';
import { fetchPublicTenants, type TenantListItem } from '../../tenantApi';
import {
  MOBILE_CANVAS_HEX,
  MOBILE_ERROR_HEX,
  MOBILE_INK_MUTED,
  MOBILE_INK_PRIMARY,
  MOBILE_INK_SECONDARY,
  MOBILE_LINK_HEX,
  MOBILE_RADIUS_MD,
  MOBILE_SURFACE_HEX,
  MOBILE_WARM_BORDER,
  mobileShadowCard,
  mobileTypography,
  platformBrandHex,
} from '../../theme/citizenMobileTheme';

export function GrievanceListScreen() {
  const navigation = useNavigation<NativeStackNavigationProp<CitizenRootStackParamList>>();
  const { locale, accessToken, selectedTenant } = useSession();
  const scope = selectedTenant?.code ?? null;
  const hubPortfolio = !scope;

  const [tenants, setTenants] = useState<TenantListItem[]>([]);
  const [rows, setRows] = useState<GrievanceListItemDto[]>([]);
  const [busy, setBusy] = useState(false);
  const [errorLine, setErrorLine] = useState<string | null>(null);

  const tenantCatalogue = useMemo(
    () => tenants.filter((row) => row.code !== 'WBPORTAL'),
    [tenants],
  );

  const reload = useCallback(async () => {
    if (!accessToken) {
      setRows([]);
      return;
    }
    setBusy(true);
    setErrorLine(null);

    try {
      const apiRoot = sessionApiRoot();
      if (hubPortfolio) {
        const catalogue = await fetchPublicTenants(apiRoot);
        setTenants(catalogue);
      }
      const items = await fetchGrievanceList(apiRoot, accessToken, scope);
      setRows(items);
    } catch {
      setErrorLine(t('grievance.loadError', locale));
      setRows([]);
    } finally {
      setBusy(false);
    }
  }, [accessToken, hubPortfolio, locale, scope]);

  useFocusEffect(
    useCallback(() => {
      void reload();
      return undefined;
    }, [reload]),
  );

  function openComposer() {
    if (scope) {
      navigation.navigate('GrievanceComposer');
      return;
    }
    navigation.navigate('BrowseTenants', { intent: 'grievance' });
  }

  function openDetail(item: GrievanceListItemDto) {
    const tenantCode =
      scope ??
      grievanceRowTenantScope({
        grievanceTenantId: item.tenant_id,
        hubCatalogue: tenantCatalogue,
      });
    if (!tenantCode) {
      setErrorLine('Unknown municipality for this grievance.');
      return;
    }
    navigation.navigate('GrievanceDetail', { id: item.id, tenantCode });
  }

  return (
    <MobileScreen style={styles.screen}>
      <StatusBar style="dark" />
      <View style={styles.header}>
        <Pressable accessibilityRole="button" onPress={() => navigation.goBack()}>
          <Text style={styles.back}>← Back</Text>
        </Pressable>
        <Text style={mobileTypography.title}>{t('grievance.title', locale)}</Text>
        <Text style={mobileTypography.caption}>
          {hubPortfolio ? 'All municipalities' : (scope ?? '')}
        </Text>
        <View style={{ marginTop: 12 }}>
          <MobilePrimaryButton label={t('grievance.fileNew', locale)} onPress={openComposer} />
        </View>
      </View>

      {busy ? (
        <View style={styles.loader}>
          <ActivityIndicator color={platformBrandHex()} />
        </View>
      ) : null}

      {errorLine ? <Text style={styles.error}>{errorLine}</Text> : null}

      <FlatList
        data={rows}
        refreshing={busy}
        onRefresh={reload}
        keyExtractor={(item) => item.id}
        contentContainerStyle={
          rows.length === 0 && !busy
            ? { flexGrow: 1, justifyContent: 'center', alignItems: 'center', padding: 24 }
            : { paddingHorizontal: 16, paddingBottom: 32 }
        }
        ListEmptyComponent={
          !busy && !errorLine ? (
            <Text style={styles.empty}>{t('grievance.empty', locale)}</Text>
          ) : null
        }
        renderItem={({ item }) => {
          const ulb =
            hubPortfolio &&
            grievanceRowTenantScope({
              grievanceTenantId: item.tenant_id,
              hubCatalogue: tenantCatalogue,
            });
          return (
            <Pressable
              style={({ pressed }) => [styles.card, pressed && styles.cardPressed]}
              accessibilityRole="button"
              onPress={() => openDetail(item)}
            >
              {ulb ? <Text style={styles.ulb}>{ulb}</Text> : null}
              <Text style={styles.ref}>{item.grievance_no}</Text>
              <Text style={styles.meta}>{item.category}</Text>
              <Text numberOfLines={2} style={styles.preview}>
                {item.description}
              </Text>
              <Text style={styles.status}>
                {t('grievance.statusLabel', locale)} · {item.status}
              </Text>
            </Pressable>
          );
        }}
      />

      {!accessToken ? (
        <View style={{ padding: 24 }}>
          <Text style={styles.error}>{t('grievance.signInRequired', locale)}</Text>
          <Pressable onPress={() => navigation.replace('OtpLogin')} style={{ marginTop: 12 }}>
            <Text style={styles.back}>{t('login.title', locale)}</Text>
          </Pressable>
        </View>
      ) : null}
    </MobileScreen>
  );
}

const styles = StyleSheet.create({
  screen: { backgroundColor: MOBILE_CANVAS_HEX },
  header: { paddingHorizontal: 16, paddingTop: 8, paddingBottom: 12 },
  back: { fontSize: 14, fontWeight: '700', color: MOBILE_LINK_HEX, marginBottom: 8 },
  card: {
    marginBottom: 10,
    backgroundColor: MOBILE_SURFACE_HEX,
    borderRadius: MOBILE_RADIUS_MD,
    padding: 14,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: MOBILE_WARM_BORDER,
    ...mobileShadowCard,
  },
  cardPressed: { opacity: 0.92 },
  ulb: {
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 1,
    color: MOBILE_LINK_HEX,
    textTransform: 'uppercase',
  },
  ref: { marginTop: 6, fontSize: 17, fontWeight: '800', color: MOBILE_INK_PRIMARY },
  preview: { marginTop: 6, fontSize: 14, lineHeight: 20, color: MOBILE_INK_SECONDARY },
  meta: { marginTop: 4, fontSize: 12, color: MOBILE_INK_MUTED, fontWeight: '600' },
  status: { marginTop: 8, fontSize: 12, fontWeight: '700', color: MOBILE_LINK_HEX },
  loader: { paddingVertical: 8 },
  error: {
    paddingHorizontal: 16,
    color: MOBILE_ERROR_HEX,
    marginBottom: 8,
    fontWeight: '600',
  },
  empty: { textAlign: 'center', maxWidth: 320, fontSize: 15, color: MOBILE_INK_SECONDARY },
});

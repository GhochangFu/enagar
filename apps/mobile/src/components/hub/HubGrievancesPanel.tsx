import { t } from '@enagar/i18n';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';

import { fetchGrievanceList, type GrievanceListItemDto } from '../../api/grievanceApi';
import { MobilePrimaryButton } from '../ui/MobileChrome';
import { sessionApiRoot, useSession } from '../../context/SessionContext';
import { grievanceRowTenantScope } from '../../lib/grievanceScope';
import type { CitizenRootStackParamList } from '../../navigation/types';
import type { TenantListItem } from '../../tenantApi';
import {
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

/** Hub portfolio grievances — unscoped list (PWA `tenantScopeCode={undefined}`). */
export function HubGrievancesPanel({ tenants }: { tenants: readonly TenantListItem[] }) {
  const navigation = useNavigation<NativeStackNavigationProp<CitizenRootStackParamList>>();
  const { locale, accessToken } = useSession();
  const [rows, setRows] = useState<GrievanceListItemDto[]>([]);
  const [busy, setBusy] = useState(false);
  const [errorLine, setErrorLine] = useState<string | null>(null);

  const brand = platformBrandHex();

  const reload = useCallback(async () => {
    if (!accessToken) {
      setRows([]);
      return;
    }
    setBusy(true);
    setErrorLine(null);
    try {
      const items = await fetchGrievanceList(sessionApiRoot(), accessToken, null);
      setRows(items);
    } catch {
      setErrorLine(t('grievance.loadError', locale));
      setRows([]);
    } finally {
      setBusy(false);
    }
  }, [accessToken, locale]);

  useEffect(() => {
    void reload();
  }, [reload]);

  function openDetail(item: GrievanceListItemDto) {
    const tenantCode = grievanceRowTenantScope({
      grievanceTenantId: item.tenant_id,
      hubCatalogue: tenants,
    });
    if (!tenantCode) {
      setErrorLine('Unknown municipality for this grievance — refresh hub.');
      return;
    }
    navigation.navigate('GrievanceDetail', { id: item.id, tenantCode });
  }

  return (
    <View style={styles.wrap}>
      <Text style={mobileTypography.body}>
        Track complaints across all pinned municipalities. Detail views use each row ULB scope.
      </Text>
      <MobilePrimaryButton
        label={t('grievance.fileNew', locale)}
        onPress={() => navigation.navigate('BrowseTenants', { intent: 'grievance' })}
      />

      {busy ? <ActivityIndicator color={brand} style={{ marginVertical: 16 }} /> : null}
      {errorLine ? <Text style={styles.error}>{errorLine}</Text> : null}

      {!busy && !errorLine && rows.length === 0 ? (
        <Text style={styles.empty}>{t('grievance.empty', locale)}</Text>
      ) : null}
      {rows.map((item) => {
        const ulb =
          grievanceRowTenantScope({
            grievanceTenantId: item.tenant_id,
            hubCatalogue: tenants,
          }) ?? '—';
        return (
          <Pressable
            key={item.id}
            onPress={() => openDetail(item)}
            style={({ pressed }) => [styles.card, pressed && styles.cardPressed]}
          >
            <Text style={styles.ulb}>{ulb}</Text>
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
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { marginBottom: 8 },
  error: { color: MOBILE_ERROR_HEX, fontWeight: '600', marginVertical: 8 },
  empty: {
    textAlign: 'center',
    paddingVertical: 20,
    ...mobileTypography.body,
    color: MOBILE_INK_MUTED,
  },
  card: {
    marginTop: 10,
    padding: 14,
    borderRadius: MOBILE_RADIUS_MD,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: MOBILE_WARM_BORDER,
    backgroundColor: MOBILE_SURFACE_HEX,
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
  meta: { marginTop: 4, fontSize: 12, fontWeight: '600', color: MOBILE_INK_MUTED },
  preview: { marginTop: 8, fontSize: 14, lineHeight: 20, color: MOBILE_INK_SECONDARY },
  status: { marginTop: 10, fontSize: 12, fontWeight: '700', color: MOBILE_LINK_HEX },
});

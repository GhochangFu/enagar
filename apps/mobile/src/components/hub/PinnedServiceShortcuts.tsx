import { Pressable, StyleSheet, Text, View } from 'react-native';

import type { PinnedServicePreference } from '../../types/citizenHub';
import type { ServiceSummary } from '../../types/dossier';
import type { TenantListItem } from '../../tenantApi';
import {
  MOBILE_INK_SECONDARY,
  MOBILE_PEACH_SOFT_HEX,
  MOBILE_RADIUS_PILL,
  MOBILE_WARM_BORDER,
  mobileTypography,
  platformBrandHex,
} from '../../theme/citizenMobileTheme';

export function PinnedServiceShortcuts({
  preferences,
  tenants,
  serviceCatalogueByTenant,
  locale,
  onOpen,
}: {
  preferences: readonly PinnedServicePreference[];
  tenants: readonly TenantListItem[];
  serviceCatalogueByTenant: Record<string, ServiceSummary[]>;
  locale: 'en' | 'bn' | 'hi';
  onOpen: (tenant: TenantListItem, serviceCode: string) => void;
}) {
  if (preferences.length === 0) {
    return null;
  }

  const brand = platformBrandHex();

  return (
    <View style={styles.wrap}>
      <Text style={mobileTypography.section}>Pinned service shortcuts</Text>
      <View style={styles.row}>
        {preferences.map((pref) => {
          const tenant = tenants.find((row) => row.code === pref.tenant_code);
          const services = serviceCatalogueByTenant[pref.tenant_code] ?? [];
          const summary = services.find((svc) => svc.code === pref.service_code);
          const title = summary?.name?.[locale] ?? pref.service_code;
          return (
            <Pressable
              key={`${pref.tenant_code}-${pref.service_code}`}
              disabled={!tenant}
              onPress={() => {
                if (tenant) {
                  onOpen(tenant, pref.service_code);
                }
              }}
              style={({ pressed }) => [styles.chip, pressed && styles.chipPressed]}
            >
              <Text style={[styles.code, { color: brand }]}>{pref.tenant_code}</Text>
              <Text style={styles.title} numberOfLines={1}>
                {title}
              </Text>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { marginBottom: 18 },
  row: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  chip: {
    maxWidth: '100%',
    borderRadius: MOBILE_RADIUS_PILL,
    borderWidth: 1,
    borderColor: MOBILE_WARM_BORDER,
    backgroundColor: MOBILE_PEACH_SOFT_HEX,
    paddingHorizontal: 14,
    paddingVertical: 10,
    minHeight: 44,
    justifyContent: 'center',
  },
  chipPressed: { opacity: 0.9 },
  code: { fontSize: 10, fontWeight: '800', letterSpacing: 0.8, textTransform: 'uppercase' },
  title: { marginTop: 2, fontSize: 13, fontWeight: '700', color: MOBILE_INK_SECONDARY },
});

import { Pressable, StyleSheet, Text, View } from 'react-native';

import type { CitizenHubDashboardMunicipalityBucket } from '../../types/citizenHub';
import type { TenantListItem } from '../../tenantApi';
import {
  MOBILE_INK_MUTED,
  MOBILE_INK_PRIMARY,
  MOBILE_INK_SECONDARY,
  MOBILE_PEACH_SOFT_HEX,
  MOBILE_RADIUS_LG,
  MOBILE_SURFACE_HEX,
  MOBILE_WARM_BORDER,
  mobileShadowCard,
  platformBrandHex,
  readableOnBrandHex,
} from '../../theme/citizenMobileTheme';

export function PinnedMunicipalityCard({
  bucket,
  catalogue,
  onEnter,
}: {
  bucket: CitizenHubDashboardMunicipalityBucket;
  catalogue: TenantListItem | null;
  onEnter: () => void;
}) {
  const disabled = !catalogue;
  const brand = platformBrandHex();
  const brandFg = readableOnBrandHex(brand);

  return (
    <Pressable
      accessibilityRole="button"
      disabled={disabled}
      onPress={onEnter}
      style={({ pressed }) => [
        styles.card,
        disabled && styles.cardDisabled,
        pressed && !disabled && styles.cardPressed,
      ]}
    >
      <View style={[styles.accent, { backgroundColor: bucket.theme_color }]} />
      <Text style={styles.code}>{bucket.tenant_code}</Text>
      <Text style={styles.name}>{catalogue?.name ?? bucket.tenant_code}</Text>
      {catalogue ? (
        <Text style={styles.meta}>
          {catalogue.district} · {catalogue.ward_count} wards
        </Text>
      ) : null}
      <View style={styles.badges}>
        <Text style={[styles.badge, styles.badgeApps]}>Apps {bucket.application_count}</Text>
        <Text style={[styles.badge, styles.badgePay]}>Pay {bucket.payment_count}</Text>
        <Text style={[styles.badge, styles.badgeGriev]}>Griev {bucket.grievance_count}</Text>
      </View>
      <View style={[styles.enterCta, { backgroundColor: brand }]}>
        <Text style={[styles.enterLabel, { color: brandFg }]}>Open workspace →</Text>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: {
    marginBottom: 14,
    borderRadius: MOBILE_RADIUS_LG,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: MOBILE_WARM_BORDER,
    backgroundColor: MOBILE_SURFACE_HEX,
    padding: 18,
    overflow: 'hidden',
    ...mobileShadowCard,
  },
  cardDisabled: { opacity: 0.55 },
  cardPressed: { opacity: 0.94, transform: [{ scale: 0.995 }] },
  accent: { position: 'absolute', left: 0, right: 0, top: 0, height: 5 },
  code: {
    marginTop: 10,
    fontSize: 13,
    fontWeight: '800',
    letterSpacing: 1,
    color: MOBILE_INK_MUTED,
    textTransform: 'uppercase',
  },
  name: { marginTop: 4, fontSize: 20, fontWeight: '800', color: MOBILE_INK_PRIMARY },
  meta: {
    marginTop: 6,
    fontSize: 11,
    fontWeight: '600',
    color: MOBILE_INK_SECONDARY,
    textTransform: 'uppercase',
    letterSpacing: 0.4,
  },
  badges: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 14 },
  badge: {
    fontSize: 11,
    fontWeight: '700',
    paddingHorizontal: 11,
    paddingVertical: 5,
    borderRadius: 999,
  },
  badgeApps: { backgroundColor: MOBILE_PEACH_SOFT_HEX, color: '#9A3412' },
  badgePay: { backgroundColor: '#E8F5E9', color: '#2E7D32' },
  badgeGriev: { backgroundColor: '#FFEBEE', color: '#C62828' },
  enterCta: {
    marginTop: 16,
    borderRadius: 14,
    minHeight: 44,
    paddingVertical: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  enterLabel: { fontSize: 15, fontWeight: '700' },
});

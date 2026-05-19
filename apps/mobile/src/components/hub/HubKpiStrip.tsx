import { StyleSheet, Text, View } from 'react-native';

import {
  MOBILE_FOREST_HEX,
  MOBILE_MINT_BAND_HEX,
  MOBILE_WARM_BORDER,
  mobileShadowCard,
  mobileTypography,
} from '../../theme/citizenMobileTheme';

export function HubKpiStrip({ items }: { items: readonly [string, string][] }) {
  return (
    <View style={styles.grid}>
      {items.map(([label, value]) => (
        <View key={label} style={styles.tile}>
          <Text style={mobileTypography.kpiLabel}>{label}</Text>
          <Text style={styles.value}>{value}</Text>
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
    marginBottom: 16,
  },
  tile: {
    flexGrow: 1,
    flexBasis: '30%',
    minWidth: 100,
    borderRadius: 18,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: MOBILE_WARM_BORDER,
    backgroundColor: MOBILE_MINT_BAND_HEX,
    paddingVertical: 14,
    paddingHorizontal: 12,
    ...mobileShadowCard,
  },
  value: {
    ...mobileTypography.kpiValue,
    marginTop: 6,
    color: MOBILE_FOREST_HEX,
  },
});

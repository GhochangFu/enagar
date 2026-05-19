import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import {
  MOBILE_MINT_BAND_HEX,
  MOBILE_INK_SECONDARY,
  MOBILE_SURFACE_HEX,
  MOBILE_WARM_BORDER,
  mobileShadowCard,
  mobileTypography,
  platformBrandHex,
  readableOnBrandHex,
} from '../../theme/citizenMobileTheme';

export type HubTabBarItem<T extends string> = {
  id: T;
  label: string;
};

export function HubTabBar<T extends string>({
  activeTab,
  onSelect,
  tabs,
}: {
  activeTab: T;
  onSelect: (tab: T) => void;
  tabs: readonly HubTabBarItem<T>[];
}) {
  const brand = platformBrandHex();
  const brandFg = readableOnBrandHex(brand);

  return (
    <View style={styles.shell}>
      <ScrollView
        accessibilityRole="tablist"
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.row}
      >
        {tabs.map((tab) => {
          const active = activeTab === tab.id;
          return (
            <Pressable
              accessibilityRole="tab"
              accessibilityState={{ selected: active }}
              key={tab.id}
              onPress={() => onSelect(tab.id)}
              style={({ pressed }) => [
                styles.chip,
                active ? { backgroundColor: brand } : styles.chipIdle,
                pressed && styles.chipPressed,
              ]}
            >
              <Text
                style={[styles.chipLabel, active ? { color: brandFg } : styles.chipLabelIdle]}
                numberOfLines={1}
              >
                {tab.label}
              </Text>
            </Pressable>
          );
        })}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  shell: {
    borderRadius: 22,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: MOBILE_WARM_BORDER,
    backgroundColor: MOBILE_SURFACE_HEX,
    padding: 6,
    marginBottom: 14,
    ...mobileShadowCard,
  },
  row: { flexDirection: 'row', gap: 6, paddingHorizontal: 2 },
  chip: {
    minWidth: 76,
    minHeight: 44,
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  chipIdle: {
    backgroundColor: MOBILE_MINT_BAND_HEX,
  },
  chipPressed: { opacity: 0.9 },
  chipLabel: { fontSize: 11, fontWeight: '800', letterSpacing: 0.2 },
  chipLabelIdle: { ...mobileTypography.caption, fontWeight: '800', color: MOBILE_INK_SECONDARY },
});

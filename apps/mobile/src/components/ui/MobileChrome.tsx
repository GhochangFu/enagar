import type { ReactNode } from 'react';
import {
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
  type StyleProp,
  type ViewStyle,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import {
  MOBILE_CANVAS_HEX,
  MOBILE_INK_MUTED,
  MOBILE_INK_PRIMARY,
  MOBILE_MIN_TOUCH,
  MOBILE_PEACH_SOFT_HEX,
  MOBILE_RADIUS_LG,
  MOBILE_RADIUS_SM,
  MOBILE_SURFACE_HEX,
  MOBILE_WARM_BORDER,
  mobileLayout,
  mobileShadowCard,
  mobileTypography,
  platformBrandHex,
  readableOnBrandHex,
} from '../../theme/citizenMobileTheme';

/** Safe-area screen shell with warm canvas background. */
export function MobileScreen({
  children,
  style,
  edges = ['top', 'left', 'right'],
}: {
  children: ReactNode;
  style?: StyleProp<ViewStyle>;
  edges?: ('top' | 'bottom' | 'left' | 'right')[];
}) {
  return (
    <SafeAreaView edges={edges} style={[styles.screen, style]}>
      {children}
    </SafeAreaView>
  );
}

export function MobileScrollScreen({
  children,
  footer,
}: {
  children: ReactNode;
  footer?: ReactNode;
}) {
  return (
    <MobileScreen>
      <ScrollView
        contentContainerStyle={styles.scrollContent}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        {children}
      </ScrollView>
      {footer}
    </MobileScreen>
  );
}

/** Hub / auth hero band — Tricolor Calm peach surface. */
export function MobileHubHero({
  eyebrow,
  title,
  subtitle,
  trailing,
}: {
  eyebrow: string;
  title: string;
  subtitle?: string;
  trailing?: ReactNode;
}) {
  return (
    <View style={styles.hero}>
      <Text style={mobileTypography.eyebrow}>{eyebrow}</Text>
      <Text style={mobileTypography.title}>{title}</Text>
      {subtitle ? (
        <Text style={[mobileTypography.subtitle, styles.heroSub]}>{subtitle}</Text>
      ) : null}
      {trailing}
    </View>
  );
}

export function MobilePanel({
  children,
  style,
}: {
  children: ReactNode;
  style?: StyleProp<ViewStyle>;
}) {
  return <View style={[styles.panel, style]}>{children}</View>;
}

export function MobilePrimaryButton({
  label,
  onPress,
  disabled = false,
  brandHex,
}: {
  label: string;
  onPress: () => void;
  disabled?: boolean;
  brandHex?: string;
}) {
  const brand = brandHex ?? platformBrandHex();
  const fg = readableOnBrandHex(brand);
  return (
    <Pressable
      accessibilityRole="button"
      disabled={disabled}
      onPress={onPress}
      style={({ pressed }) => [
        styles.primaryBtn,
        { backgroundColor: brand },
        disabled && styles.disabled,
        pressed && !disabled && styles.pressed,
      ]}
    >
      <Text style={[styles.primaryLabel, { color: fg }]}>{label}</Text>
    </Pressable>
  );
}

export function MobileSecondaryButton({
  label,
  onPress,
  disabled = false,
}: {
  label: string;
  onPress: () => void;
  disabled?: boolean;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      disabled={disabled}
      onPress={onPress}
      style={({ pressed }) => [
        styles.secondaryBtn,
        disabled && styles.disabled,
        pressed && !disabled && styles.pressed,
      ]}
    >
      <Text style={styles.secondaryLabel}>{label}</Text>
    </Pressable>
  );
}

export function MobileTextField(props: {
  value: string;
  onChangeText: (v: string) => void;
  placeholder?: string;
  keyboardType?: 'default' | 'number-pad';
  maxLength?: number;
  editable?: boolean;
}) {
  return (
    <TextInput
      editable={props.editable}
      keyboardType={props.keyboardType ?? 'default'}
      maxLength={props.maxLength}
      onChangeText={props.onChangeText}
      placeholder={props.placeholder}
      placeholderTextColor={MOBILE_INK_MUTED}
      style={styles.input}
      value={props.value}
    />
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: MOBILE_CANVAS_HEX,
  },
  scrollContent: {
    paddingHorizontal: mobileLayout.screenPaddingX,
    paddingTop: mobileLayout.screenPaddingTop,
    paddingBottom: mobileLayout.screenPaddingBottom,
  },
  hero: {
    marginBottom: mobileLayout.gap,
    padding: mobileLayout.cardPadding,
    borderRadius: MOBILE_RADIUS_LG,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: MOBILE_WARM_BORDER,
    backgroundColor: MOBILE_PEACH_SOFT_HEX,
    ...mobileShadowCard,
  },
  heroSub: { marginTop: 8 },
  panel: {
    borderRadius: MOBILE_RADIUS_LG,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: MOBILE_WARM_BORDER,
    backgroundColor: MOBILE_SURFACE_HEX,
    padding: mobileLayout.cardPadding,
    marginBottom: mobileLayout.gap,
    ...mobileShadowCard,
  },
  primaryBtn: {
    minHeight: MOBILE_MIN_TOUCH,
    borderRadius: MOBILE_RADIUS_SM,
    paddingVertical: 14,
    paddingHorizontal: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  primaryLabel: {
    fontSize: 16,
    fontWeight: '700',
    textAlign: 'center',
  },
  secondaryBtn: {
    minHeight: MOBILE_MIN_TOUCH,
    borderRadius: MOBILE_RADIUS_SM,
    borderWidth: 1.5,
    borderColor: MOBILE_WARM_BORDER,
    backgroundColor: MOBILE_SURFACE_HEX,
    paddingVertical: 12,
    paddingHorizontal: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  secondaryLabel: {
    fontSize: 15,
    fontWeight: '700',
    color: MOBILE_INK_PRIMARY,
    textAlign: 'center',
  },
  input: {
    marginTop: 8,
    minHeight: MOBILE_MIN_TOUCH,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: MOBILE_WARM_BORDER,
    borderRadius: MOBILE_RADIUS_SM,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 16,
    backgroundColor: MOBILE_SURFACE_HEX,
    color: MOBILE_INK_PRIMARY,
  },
  disabled: { opacity: 0.5 },
  pressed: { opacity: 0.88, transform: [{ scale: 0.99 }] },
});

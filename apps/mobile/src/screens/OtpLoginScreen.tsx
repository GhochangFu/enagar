import { t } from '@enagar/i18n';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { StatusBar } from 'expo-status-bar';
import { useMemo, useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';

import { sendOtp, verifyOtp } from '../api/authApi';
import { registerCitizenProfile } from '../api/citizenProfileApi';
import { sessionApiRoot, useSession } from '../context/SessionContext';
import type { CitizenRootStackParamList } from '../navigation/types';

export function OtpLoginScreen() {
  const navigation = useNavigation<NativeStackNavigationProp<CitizenRootStackParamList>>();
  const { locale, selectedTenant, setTokens, signOut } = useSession();

  const [mobileDigits, setMobileDigits] = useState('');
  const [otpDigits, setOtpDigits] = useState('');
  const [otpSentHint, setOtpSentHint] = useState(false);
  const [busy, setBusy] = useState(false);
  const [errorLine, setErrorLine] = useState<string | null>(null);

  const devHintVisible = __DEV__;
  const devOtpEcho = __DEV__
    ? 'Development: use OTP matching API DEV_OTP_CODE (default **12345**).'
    : '';

  const base = sessionApiRoot();

  const normalizedMobile = useMemo(() => mobileDigits.replace(/\s+/g, ''), [mobileDigits]);

  function ensureTenantChosen() {
    if (!selectedTenant) {
      navigation.replace('TenantPicker');
      return false;
    }
    return true;
  }

  async function onSendOtp() {
    if (!ensureTenantChosen()) {
      return;
    }
    if (!/^[6-9]\d{9}$/.test(normalizedMobile)) {
      setErrorLine('Enter a valid 10-digit mobile number.');
      return;
    }
    setBusy(true);
    setErrorLine(null);

    try {
      await sendOtp(base, normalizedMobile);
      setOtpSentHint(true);
    } catch {
      setErrorLine(t('status.apiUnreachable', locale));
    } finally {
      setBusy(false);
    }
  }

  async function onVerify() {
    if (!ensureTenantChosen()) {
      return;
    }

    setBusy(true);
    setErrorLine(null);

    try {
      const tokens = await verifyOtp(base, normalizedMobile, otpDigits.trim());
      await setTokens({
        accessToken: tokens.access_token,
        refreshToken: tokens.refresh_token,
        mobileDigits: normalizedMobile,
      });
      void registerCitizenProfile({
        apiRoot: base,
        accessToken: tokens.access_token,
        mobileDigits10: normalizedMobile,
        locale,
      });
      navigation.replace('Home');
    } catch {
      setErrorLine('OTP verification failed.');
    } finally {
      setBusy(false);
    }
  }

  async function changeTenant() {
    await signOut();
    navigation.replace('TenantPicker');
  }

  if (!selectedTenant) {
    return (
      <View style={styles.fill}>
        <Text style={styles.padded}>Missing municipality selection.</Text>
        <Pressable onPress={() => navigation.replace('TenantPicker')} style={styles.primaryCta}>
          <Text style={styles.primaryCtaLabel}>{t('tenant.title', locale)}</Text>
        </Pressable>
      </View>
    );
  }

  return (
    <View style={styles.fill}>
      <StatusBar style="dark" />
      <View style={{ paddingHorizontal: 16 }}>
        <Text style={styles.h1}>{t('login.title', locale)}</Text>
        <Text style={styles.muted}>{selectedTenant.name}</Text>

        <Text style={styles.label}>{t('login.mobile', locale)}</Text>
        <TextInput
          editable={!busy}
          keyboardType="number-pad"
          maxLength={10}
          onChangeText={setMobileDigits}
          placeholder="9876543210"
          placeholderTextColor="#94A3B8"
          style={styles.input}
          value={mobileDigits}
        />

        <Pressable
          accessibilityRole="button"
          disabled={busy}
          onPress={onSendOtp}
          style={[styles.secondaryCta, busy && styles.disabled]}
        >
          <Text style={styles.secondaryCtaLabel}>{t('login.sendOtp', locale)}</Text>
        </Pressable>

        {otpSentHint ? <Text style={styles.miniOk}>{t('status.otpSent', locale)}</Text> : null}

        <Text style={[styles.label, { marginTop: 18 }]}>{t('otp.title', locale)}</Text>
        <TextInput
          editable={!busy}
          keyboardType="number-pad"
          maxLength={8}
          onChangeText={setOtpDigits}
          placeholder="•••••"
          placeholderTextColor="#94A3B8"
          style={styles.input}
          value={otpDigits}
        />

        <Pressable
          accessibilityRole="button"
          disabled={busy}
          onPress={onVerify}
          style={[styles.primaryCta, busy && styles.disabled]}
        >
          <Text style={styles.primaryCtaLabel}>{t('otp.submit', locale)}</Text>
        </Pressable>

        <Pressable onPress={() => void changeTenant()} style={{ marginTop: 16 }}>
          <Text style={styles.link}>Change municipality</Text>
        </Pressable>

        {errorLine ? <Text style={styles.error}>{errorLine}</Text> : null}

        {devHintVisible ? <Text style={styles.dev}>{devOtpEcho}</Text> : null}

        {busy ? (
          <View style={{ marginTop: 16 }}>
            <ActivityIndicator accessibilityLabel={t('status.sendingOtp', locale)} />
          </View>
        ) : null}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  fill: { flex: 1, backgroundColor: '#F8FAFC', paddingTop: 52 },
  h1: { fontSize: 22, fontWeight: '700', color: '#0F172A' },
  muted: { marginTop: 6, color: '#475569' },
  label: {
    marginTop: 14,
    fontSize: 12,
    fontWeight: '600',
    color: '#475569',
    textTransform: 'uppercase',
  },
  input: {
    marginTop: 8,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: '#CBD5F5',
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 11,
    fontSize: 16,
    backgroundColor: '#FFFFFF',
    color: '#0F172A',
  },
  primaryCta: {
    marginTop: 22,
    backgroundColor: '#0F4C75',
    borderRadius: 10,
    paddingVertical: 14,
    alignItems: 'center',
  },
  primaryCtaLabel: { fontSize: 16, fontWeight: '700', color: '#FFFFFF' },
  secondaryCta: {
    marginTop: 12,
    borderWidth: 1,
    borderColor: '#0F4C75',
    borderRadius: 10,
    paddingVertical: 12,
    alignItems: 'center',
  },
  secondaryCtaLabel: { fontSize: 15, fontWeight: '600', color: '#0F4C75' },
  miniOk: { marginTop: 10, fontSize: 13, color: '#166534', fontWeight: '600' },
  error: { marginTop: 16, fontSize: 14, fontWeight: '600', color: '#B91C1C' },
  dev: { marginTop: 18, fontSize: 11, color: '#64748B', lineHeight: 16 },
  link: { fontSize: 14, fontWeight: '600', color: '#0369A1' },
  disabled: { opacity: 0.55 },
  padded: { padding: 24, fontSize: 16 },
});

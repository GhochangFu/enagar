import { t } from '@enagar/i18n';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { StatusBar } from 'expo-status-bar';
import { useMemo, useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';

import { sendOtp, verifyOtp } from '../api/authApi';
import { registerCitizenProfile } from '../api/citizenProfileApi';
import { navigateAfterCitizenLogin } from '../api/postLoginRouting';
import {
  MobileHubHero,
  MobilePrimaryButton,
  MobileScrollScreen,
  MobileSecondaryButton,
  MobileTextField,
} from '../components/ui/MobileChrome';
import { sessionApiRoot, useSession } from '../context/SessionContext';
import type { CitizenRootStackParamList } from '../navigation/types';
import {
  MOBILE_ERROR_HEX,
  MOBILE_INK_MUTED,
  MOBILE_LINK_HEX,
  MOBILE_SUCCESS_HEX,
  mobileTypography,
} from '../theme/citizenMobileTheme';

export function OtpLoginScreen() {
  const navigation = useNavigation<NativeStackNavigationProp<CitizenRootStackParamList>>();
  const { locale, setTokens, signOut } = useSession();

  const [mobileDigits, setMobileDigits] = useState('');
  const [otpDigits, setOtpDigits] = useState('');
  const [otpSentHint, setOtpSentHint] = useState(false);
  const [busy, setBusy] = useState(false);
  const [errorLine, setErrorLine] = useState<string | null>(null);

  const devHintVisible = __DEV__;
  const devOtpEcho = __DEV__
    ? 'Development: use OTP matching API DEV_OTP_CODE (default 12345). Portal identity (WBPORTAL).'
    : '';

  const base = sessionApiRoot();
  const normalizedMobile = useMemo(() => mobileDigits.replace(/\s+/g, ''), [mobileDigits]);

  async function onSendOtp() {
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
      await navigateAfterCitizenLogin(navigation, base, tokens.access_token);
    } catch {
      setErrorLine('OTP verification failed.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <StatusBar style="dark" />
      <MobileScrollScreen>
        <MobileHubHero
          eyebrow="Citizen portal"
          subtitle="Sign in once — use every municipality from your central hub."
          title={t('login.title', locale)}
        />

        <Text style={styles.label}>{t('login.mobile', locale)}</Text>
        <MobileTextField
          editable={!busy}
          keyboardType="number-pad"
          maxLength={10}
          onChangeText={setMobileDigits}
          placeholder="9876543210"
          value={mobileDigits}
        />

        <View style={{ marginTop: 12 }}>
          <MobileSecondaryButton
            disabled={busy}
            label={t('login.sendOtp', locale)}
            onPress={() => void onSendOtp()}
          />
        </View>

        {otpSentHint ? <Text style={styles.miniOk}>{t('status.otpSent', locale)}</Text> : null}

        <Text style={[styles.label, { marginTop: 20 }]}>{t('otp.title', locale)}</Text>
        <MobileTextField
          editable={!busy}
          keyboardType="number-pad"
          maxLength={8}
          onChangeText={setOtpDigits}
          placeholder="•••••"
          value={otpDigits}
        />

        <View style={{ marginTop: 16 }}>
          <MobilePrimaryButton
            disabled={busy}
            label={t('otp.submit', locale)}
            onPress={() => void onVerify()}
          />
        </View>

        <Pressable
          onPress={() => {
            void signOut();
            navigation.navigate('TenantPicker');
          }}
          style={styles.linkWrap}
        >
          <Text style={styles.link}>Browse municipalities (preview)</Text>
        </Pressable>

        {errorLine ? <Text style={styles.error}>{errorLine}</Text> : null}
        {devHintVisible ? <Text style={styles.dev}>{devOtpEcho}</Text> : null}

        {busy ? (
          <View style={{ marginTop: 16 }}>
            <ActivityIndicator accessibilityLabel={t('status.sendingOtp', locale)} />
          </View>
        ) : null}
      </MobileScrollScreen>
    </>
  );
}

const styles = StyleSheet.create({
  label: {
    ...mobileTypography.eyebrow,
    marginTop: 4,
  },
  miniOk: { marginTop: 10, fontSize: 13, color: MOBILE_SUCCESS_HEX, fontWeight: '600' },
  error: { marginTop: 16, fontSize: 14, fontWeight: '600', color: MOBILE_ERROR_HEX },
  dev: { marginTop: 18, fontSize: 11, color: MOBILE_INK_MUTED, lineHeight: 16 },
  linkWrap: { marginTop: 20, paddingVertical: 8 },
  link: { fontSize: 14, fontWeight: '700', color: MOBILE_LINK_HEX },
});

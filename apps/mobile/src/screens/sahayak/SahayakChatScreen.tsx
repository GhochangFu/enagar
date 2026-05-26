import { useNavigation, useRoute } from '@react-navigation/native';
import type { RouteProp } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useCallback, useEffect, useState } from 'react';
import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native';

import {
  fetchChatbotConsent,
  postChatbotConsent,
  streamChatbotQueryMobile,
} from '../../api/chatbotApi';
import {
  MobilePanel,
  MobilePrimaryButton,
  MobileScrollScreen,
} from '../../components/ui/MobileChrome';
import { sessionApiRoot, useSession } from '../../context/SessionContext';
import type { CitizenRootStackParamList } from '../../navigation/types';
import {
  MOBILE_INK_PRIMARY,
  MOBILE_INK_SECONDARY,
  MOBILE_RADIUS_CARD,
  MOBILE_WARM_BORDER,
  mobileTypography,
  platformBrandHex,
} from '../../theme/citizenMobileTheme';

type Msg = { role: 'user' | 'assistant'; text: string };

export function SahayakChatScreen() {
  const navigation = useNavigation<NativeStackNavigationProp<CitizenRootStackParamList>>();
  const route = useRoute<RouteProp<CitizenRootStackParamList, 'SahayakChat'>>();
  const { accessToken, locale } = useSession();
  const tenantCode = route.params.tenantCode;
  const tenantName = route.params.tenantName ?? tenantCode;

  const [consentReady, setConsentReady] = useState(false);
  const [messages, setMessages] = useState<Msg[]>([]);
  const [input, setInput] = useState('');
  const [busy, setBusy] = useState(false);
  const [sessionId] = useState(`mob-${Date.now()}`);

  const brand = platformBrandHex();

  const ensureConsent = useCallback(async () => {
    if (!accessToken) {
      return;
    }
    const row = await fetchChatbotConsent(sessionApiRoot(), accessToken, tenantCode);
    if (row.accepted) {
      setConsentReady(true);
      return;
    }
    await postChatbotConsent(sessionApiRoot(), accessToken, tenantCode, {
      mode: 'llm',
      accepted: true,
    });
    setConsentReady(true);
  }, [accessToken, tenantCode]);

  useEffect(() => {
    void ensureConsent().catch(() => setConsentReady(false));
  }, [ensureConsent]);

  async function send(): Promise<void> {
    const text = input.trim();
    if (!text || !accessToken || !consentReady || busy) {
      return;
    }
    setBusy(true);
    setInput('');
    setMessages((prev) => [...prev, { role: 'user', text }]);
    let assistant = '';
    setMessages((prev) => [...prev, { role: 'assistant', text: '' }]);
    try {
      await streamChatbotQueryMobile({
        apiRoot: sessionApiRoot(),
        accessToken,
        municipalityCode: tenantCode,
        message: text,
        sessionId,
        language: locale,
        onDelta: (delta) => {
          assistant += delta;
          setMessages((prev) => {
            const copy = [...prev];
            copy[copy.length - 1] = { role: 'assistant', text: assistant };
            return copy;
          });
        },
        onDone: () => undefined,
        onError: (message) => {
          setMessages((prev) => {
            const copy = [...prev];
            copy[copy.length - 1] = { role: 'assistant', text: message };
            return copy;
          });
        },
      });
    } finally {
      setBusy(false);
    }
  }

  return (
    <MobileScrollScreen>
      <Pressable onPress={() => navigation.goBack()} style={styles.back}>
        <Text style={styles.backText}>← Back</Text>
      </Pressable>
      <Text style={styles.title}>Sahayak — {tenantName}</Text>
      <Text style={styles.subtitle}>{tenantCode} · AI-assisted (PII redacted)</Text>

      <MobilePanel style={styles.chatPanel}>
        {messages.map((msg, index) => (
          <View
            key={`${msg.role}-${index}`}
            style={[
              styles.bubble,
              msg.role === 'user' ? styles.userBubble : styles.assistantBubble,
            ]}
          >
            <Text style={msg.role === 'user' ? styles.userText : styles.assistantText}>
              {msg.text}
            </Text>
          </View>
        ))}
      </MobilePanel>

      <View style={styles.composer}>
        <TextInput
          editable={consentReady && !busy}
          onChangeText={setInput}
          placeholder="Ask Sahayak…"
          style={styles.input}
          value={input}
        />
        <MobilePrimaryButton
          brandHex={brand}
          label={busy ? '…' : 'Send'}
          onPress={() => void send()}
        />
      </View>
    </MobileScrollScreen>
  );
}

const styles = StyleSheet.create({
  back: { marginBottom: 8 },
  backText: { ...mobileTypography.body, color: MOBILE_INK_SECONDARY },
  title: { ...mobileTypography.title, color: MOBILE_INK_PRIMARY },
  subtitle: { ...mobileTypography.caption, color: MOBILE_INK_SECONDARY, marginBottom: 12 },
  chatPanel: { minHeight: 280, marginBottom: 12 },
  bubble: {
    borderRadius: MOBILE_RADIUS_CARD,
    padding: 12,
    marginBottom: 8,
    maxWidth: '92%',
  },
  userBubble: { alignSelf: 'flex-end', backgroundColor: '#0F4C75' },
  assistantBubble: {
    alignSelf: 'flex-start',
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: MOBILE_WARM_BORDER,
  },
  userText: { color: '#fff', fontSize: 15 },
  assistantText: { color: MOBILE_INK_PRIMARY, fontSize: 15 },
  composer: { flexDirection: 'row', gap: 8, alignItems: 'center' },
  input: {
    flex: 1,
    borderWidth: 1,
    borderColor: MOBILE_WARM_BORDER,
    borderRadius: 16,
    paddingHorizontal: 14,
    paddingVertical: 10,
    fontSize: 15,
  },
});

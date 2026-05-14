import { t } from '@enagar/i18n';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { StatusBar } from 'expo-status-bar';
import { useCallback, useState } from 'react';
import { ActivityIndicator, FlatList, Pressable, StyleSheet, Text, View } from 'react-native';

import { fetchGrievanceList, type GrievanceListItemDto } from '../../api/grievanceApi';
import { sessionApiRoot, useSession } from '../../context/SessionContext';
import type { CitizenRootStackParamList } from '../../navigation/types';

export function GrievanceListScreen() {
  const navigation = useNavigation<NativeStackNavigationProp<CitizenRootStackParamList>>();
  const { locale, accessToken, selectedTenant } = useSession();
  const scope = selectedTenant?.code;

  const [rows, setRows] = useState<GrievanceListItemDto[]>([]);
  const [busy, setBusy] = useState(false);
  const [errorLine, setErrorLine] = useState<string | null>(null);

  const reload = useCallback(async () => {
    if (!accessToken || !scope) {
      setRows([]);
      return;
    }
    setBusy(true);
    setErrorLine(null);

    try {
      const items = await fetchGrievanceList(sessionApiRoot(), accessToken, scope);
      setRows(items);
    } catch {
      setErrorLine(t('grievance.loadError', locale));
      setRows([]);
    } finally {
      setBusy(false);
    }
  }, [accessToken, locale, scope]);

  useFocusEffect(
    useCallback(() => {
      void reload();
      return undefined;
    }, [reload]),
  );

  function openComposer() {
    navigation.navigate('GrievanceComposer');
  }

  function openDetail(id: string) {
    navigation.navigate('GrievanceDetail', { id });
  }

  return (
    <View style={{ flex: 1, backgroundColor: '#F8FAFC' }}>
      <StatusBar style="dark" />
      <View style={{ paddingHorizontal: 16, paddingVertical: 12 }}>
        <Text style={styles.h1}>{t('grievance.title', locale)}</Text>
        <Pressable accessibilityRole="button" onPress={openComposer} style={styles.ctaPrimary}>
          <Text style={styles.ctaPrimaryLabel}>{t('grievance.fileNew', locale)}</Text>
        </Pressable>
      </View>

      {busy ? (
        <View style={styles.loader}>
          <ActivityIndicator />
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
            : undefined
        }
        ListEmptyComponent={
          !busy && !errorLine ? (
            <Text style={{ textAlign: 'center', maxWidth: 320, fontSize: 15, color: '#475569' }}>
              {t('grievance.empty', locale)}
            </Text>
          ) : null
        }
        renderItem={({ item }) => (
          <Pressable
            style={styles.card}
            accessibilityRole="button"
            onPress={() => openDetail(item.id)}
          >
            <Text style={styles.ref}>{item.grievance_no}</Text>
            <Text style={styles.meta}>{item.category}</Text>
            <Text numberOfLines={2} style={styles.preview}>
              {item.description}
            </Text>
            <Text style={styles.status}>
              {t('grievance.statusLabel', locale)} · {item.status}
            </Text>
          </Pressable>
        )}
      />

      {!accessToken ? (
        <View style={{ padding: 24 }}>
          <Text style={{ color: '#B91C1C', fontWeight: '600', textAlign: 'center' }}>
            <Text accessibilityRole="alert">{t('grievance.signInRequired', locale)}</Text>
          </Text>
          <Pressable
            accessibilityRole="button"
            style={{ alignItems: 'center', marginTop: 12 }}
            onPress={() => navigation.replace('OtpLogin')}
          >
            <Text style={{ fontWeight: '700', color: '#0369A1' }}>{t('login.title', locale)}</Text>
          </Pressable>
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  h1: { fontSize: 22, fontWeight: '700', color: '#0F172A' },
  card: {
    marginHorizontal: 16,
    marginBottom: 10,
    backgroundColor: '#FFFFFF',
    borderRadius: 10,
    padding: 12,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: '#E2E8F0',
  },
  ref: { fontSize: 16, fontWeight: '700', color: '#0F172A' },
  preview: { marginTop: 6, fontSize: 14, color: '#334155' },
  meta: {
    marginTop: 4,
    fontSize: 12,
    color: '#64748B',
    textTransform: 'uppercase',
    fontWeight: '600',
  },
  status: { marginTop: 8, fontSize: 12, fontWeight: '600', color: '#0369A1' },
  ctaPrimary: {
    marginTop: 12,
    backgroundColor: '#0F4C75',
    borderRadius: 10,
    alignItems: 'center',
    paddingVertical: 12,
  },
  ctaPrimaryLabel: { fontSize: 15, fontWeight: '700', color: '#FFFFFF' },
  loader: { paddingVertical: 8 },
  error: {
    paddingHorizontal: 24,
    color: '#991B1B',
    marginBottom: 8,
    fontWeight: '600',
  },
});

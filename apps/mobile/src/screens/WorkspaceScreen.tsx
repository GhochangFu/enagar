import { t } from '@enagar/i18n';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { StatusBar } from 'expo-status-bar';
import { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { HubTabBar } from '../components/hub/HubTabBar';
import {
  MobilePanel,
  MobilePrimaryButton,
  MobileSecondaryButton,
} from '../components/ui/MobileChrome';
import { municipalityWorkspaceTabs, type WorkspaceTabId } from '../hub/hubTabs';
import { useSession } from '../context/SessionContext';
import type { CitizenRootStackParamList } from '../navigation/types';
import {
  MOBILE_CANVAS_HEX,
  MOBILE_LINK_HEX,
  mobileTypography,
  readableOnBrandHex,
  resolveTenantBrandHex,
} from '../theme/citizenMobileTheme';

export function WorkspaceScreen() {
  const navigation = useNavigation<NativeStackNavigationProp<CitizenRootStackParamList>>();
  const { locale, selectedTenant, selectTenant } = useSession();
  const [tab, setTab] = useState<WorkspaceTabId>('home');

  const tenant = selectedTenant;
  const brandHex = resolveTenantBrandHex(tenant?.theme_color);
  const brandFg = readableOnBrandHex(brandHex);

  function backToHub() {
    selectTenant(null);
    navigation.replace('CitizenHub');
  }

  if (!tenant) {
    return (
      <SafeAreaView style={styles.fill}>
        <Text style={mobileTypography.body}>No municipality selected.</Text>
        <Pressable onPress={backToHub}>
          <Text style={styles.backLink}>Back to hub</Text>
        </Pressable>
      </SafeAreaView>
    );
  }

  return (
    <View style={styles.fill}>
      <StatusBar style="light" />
      <SafeAreaView edges={['top']} style={[styles.header, { backgroundColor: brandHex }]}>
        <Pressable accessibilityRole="button" hitSlop={12} onPress={backToHub}>
          <Text style={[styles.back, { color: brandFg }]}>← Hub</Text>
        </Pressable>
        <Text style={[styles.headerTitle, { color: brandFg }]}>{tenant.name}</Text>
        <Text style={[styles.headerCode, { color: brandFg }]}>
          {tenant.code} · {tenant.district} · {tenant.ward_count} wards
        </Text>
      </SafeAreaView>

      <ScrollView
        contentContainerStyle={styles.body}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        <HubTabBar activeTab={tab} onSelect={setTab} tabs={municipalityWorkspaceTabs(locale)} />

        {tab === 'home' && (
          <MobilePanel>
            <Text style={mobileTypography.section}>Municipality workspace</Text>
            <Text style={[mobileTypography.body, { marginTop: 8 }]}>
              Services, applications, payments, and grievances for {tenant.code} are scoped to this
              ULB.
            </Text>
            <View style={{ marginTop: 14 }}>
              <MobilePrimaryButton
                brandHex={brandHex}
                label="Browse services"
                onPress={() => navigation.navigate('ServiceCatalog')}
              />
            </View>
          </MobilePanel>
        )}

        {tab === 'services' && (
          <MobilePanel>
            <Text style={mobileTypography.section}>Service catalogue</Text>
            <Text style={[mobileTypography.body, { marginTop: 8 }]}>
              Published services for this municipality.
            </Text>
            <View style={{ marginTop: 14 }}>
              <MobilePrimaryButton
                brandHex={brandHex}
                label="Open catalogue"
                onPress={() => navigation.navigate('ServiceCatalog')}
              />
            </View>
          </MobilePanel>
        )}

        {tab === 'apply' && (
          <MobilePanel>
            <Text style={mobileTypography.section}>Apply</Text>
            <Text style={[mobileTypography.body, { marginTop: 8 }]}>
              Pick a service from the catalogue to start an application.
            </Text>
            <View style={{ marginTop: 14 }}>
              <MobileSecondaryButton
                label="Browse services to apply"
                onPress={() => navigation.navigate('ServiceCatalog')}
              />
            </View>
          </MobilePanel>
        )}

        {tab === 'applications' && (
          <MobilePanel>
            <Text style={mobileTypography.section}>Applications</Text>
            <Text style={[mobileTypography.body, { marginTop: 8 }]}>
              Track dockets for {tenant.code}.
            </Text>
            <View style={{ marginTop: 14 }}>
              <MobileSecondaryButton
                label="My applications"
                onPress={() => navigation.navigate('ApplicationList')}
              />
            </View>
          </MobilePanel>
        )}

        {tab === 'payments' && (
          <MobilePanel>
            <Text style={mobileTypography.section}>Payments</Text>
            <Text style={[mobileTypography.body, { marginTop: 8 }]}>
              Payment history scoped to this municipality.
            </Text>
            <View style={{ marginTop: 14 }}>
              <MobileSecondaryButton
                label="My payments"
                onPress={() => navigation.navigate('PaymentList')}
              />
            </View>
          </MobilePanel>
        )}

        {tab === 'grievances' && (
          <MobilePanel>
            <Text style={mobileTypography.section}>{t('grievance.nav', locale)}</Text>
            <View style={{ marginTop: 14 }}>
              <MobilePrimaryButton
                brandHex={brandHex}
                label="View grievances"
                onPress={() => navigation.navigate('GrievanceList')}
              />
              <View style={{ marginTop: 10 }}>
                <MobileSecondaryButton
                  label="File new grievance"
                  onPress={() => navigation.navigate('GrievanceComposer')}
                />
              </View>
            </View>
          </MobilePanel>
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  fill: { flex: 1, backgroundColor: MOBILE_CANVAS_HEX },
  header: { paddingHorizontal: 18, paddingBottom: 20 },
  back: { fontSize: 14, fontWeight: '700', marginBottom: 10 },
  headerTitle: { fontSize: 24, fontWeight: '800', letterSpacing: -0.3 },
  headerCode: { marginTop: 6, fontSize: 13, fontWeight: '600', opacity: 0.92 },
  body: { padding: 16, paddingBottom: 40 },
  backLink: { marginTop: 12, fontSize: 14, fontWeight: '700', color: MOBILE_LINK_HEX },
});

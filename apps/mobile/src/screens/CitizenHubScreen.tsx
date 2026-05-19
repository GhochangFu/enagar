import { SUPPORTED_LOCALES, t } from '@enagar/i18n';
import type { Locale } from '@enagar/i18n';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { StatusBar } from 'expo-status-bar';
import { useCallback, useMemo, useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';
import {
  MobileHubHero,
  MobilePanel,
  MobilePrimaryButton,
  MobileScrollScreen,
  MobileSecondaryButton,
} from '../components/ui/MobileChrome';

import {
  fetchCitizenDashboard,
  fetchCitizenPreferences,
  patchCitizenPreferences,
  selectCitizenTenant,
  sumHubBucketTotals,
} from '../api/citizenHubApi';
import { HubGrievancesPanel } from '../components/hub/HubGrievancesPanel';
import { HubKpiStrip } from '../components/hub/HubKpiStrip';
import { HubTabBar } from '../components/hub/HubTabBar';
import { PinnedMunicipalityCard } from '../components/hub/PinnedMunicipalityCard';
import { PinnedServiceShortcuts } from '../components/hub/PinnedServiceShortcuts';
import { fetchTenantServices } from '../api/servicesCatalogApi';
import { MAX_PINNED_MUNICIPALITIES } from '../constants/citizenPortal';
import { sessionApiRoot, useSession } from '../context/SessionContext';
import { citizenHubTabs, type CitizenHubTabId } from '../hub/hubTabs';
import { useCitizenPushRegistration } from '../hooks/useCitizenPushRegistration';
import type { CitizenRootStackParamList } from '../navigation/types';
import { fetchPublicTenants, type TenantListItem } from '../tenantApi';
import type { CitizenHubDashboardResponse, CitizenPreferencesResponse } from '../types/citizenHub';
import type { ServiceSummary } from '../types/dossier';
import {
  MOBILE_ERROR_HEX,
  MOBILE_INK_PRIMARY,
  MOBILE_INK_SECONDARY,
  MOBILE_LINK_HEX,
  MOBILE_PEACH_SOFT_HEX,
  MOBILE_RADIUS_PILL,
  MOBILE_SUCCESS_HEX,
  MOBILE_SURFACE_HEX,
  MOBILE_WARNING_HEX,
  MOBILE_WARM_BORDER,
  mobileTypography,
  platformBrandHex,
  readableOnBrandHex,
} from '../theme/citizenMobileTheme';

export function CitizenHubScreen() {
  const navigation = useNavigation<NativeStackNavigationProp<CitizenRootStackParamList>>();
  const { locale, setLocale, accessToken, mobile, signOut, selectTenant } = useSession();

  const [hubTab, setHubTab] = useState<CitizenHubTabId>('home');
  const [dashboard, setDashboard] = useState<CitizenHubDashboardResponse | null>(null);
  const [preferences, setPreferences] = useState<CitizenPreferencesResponse | null>(null);
  const [tenants, setTenants] = useState<TenantListItem[]>([]);
  const [pinsDraft, setPinsDraft] = useState<string[]>([]);
  const [pinsDirty, setPinsDirty] = useState(false);
  const [serviceCatalogueByTenant, setServiceCatalogueByTenant] = useState<
    Record<string, ServiceSummary[]>
  >({});
  const [busy, setBusy] = useState(false);
  const [errorLine, setErrorLine] = useState<string | null>(null);
  const [statusLine, setStatusLine] = useState<string | null>(null);

  useCitizenPushRegistration();

  const brand = platformBrandHex();
  const brandFg = readableOnBrandHex(brand);

  const tenantByCode = useMemo(() => {
    const map = new Map<string, TenantListItem>();
    for (const row of tenants) {
      map.set(row.code, row);
    }
    return map;
  }, [tenants]);

  const pinnedBuckets = useMemo(() => {
    const pins = preferences?.pinned_tenant_codes ?? [];
    const buckets = dashboard?.municipalities ?? [];
    return pins.map((code) => {
      const bucket = buckets.find((row) => row.tenant_code === code);
      return { code, bucket, catalogue: tenantByCode.get(code) ?? null };
    });
  }, [dashboard?.municipalities, preferences?.pinned_tenant_codes, tenantByCode]);

  const hubTotals = useMemo(() => sumHubBucketTotals(dashboard), [dashboard]);

  const refreshHub = useCallback(async () => {
    if (!accessToken) {
      navigation.replace('OtpLogin');
      return;
    }
    setBusy(true);
    setErrorLine(null);
    try {
      const apiRoot = sessionApiRoot();
      const [dash, prefs, catalogue] = await Promise.all([
        fetchCitizenDashboard(apiRoot, accessToken),
        fetchCitizenPreferences(apiRoot, accessToken),
        fetchPublicTenants(apiRoot),
      ]);
      setDashboard(dash);
      setPreferences(prefs);
      const catalogueRows = catalogue.filter((row) => row.code !== 'WBPORTAL');
      setTenants(catalogueRows);
      if (!pinsDirty) {
        setPinsDraft(prefs.pinned_tenant_codes);
      }

      const codesToLoad = new Set<string>([
        ...prefs.pinned_tenant_codes,
        ...prefs.pinned_services.map((row) => row.tenant_code),
      ]);
      const serviceMap: Record<string, ServiceSummary[]> = {};
      await Promise.all(
        [...codesToLoad].map(async (code) => {
          try {
            serviceMap[code] = await fetchTenantServices(apiRoot, code);
          } catch {
            serviceMap[code] = [];
          }
        }),
      );
      setServiceCatalogueByTenant(serviceMap);
    } catch {
      setErrorLine(t('status.apiUnreachable', locale));
    } finally {
      setBusy(false);
    }
  }, [accessToken, locale, navigation, pinsDirty]);

  useFocusEffect(
    useCallback(() => {
      selectTenant(null);
      void refreshHub();
      return undefined;
    }, [refreshHub, selectTenant]),
  );

  async function enterWorkspace(tenant: TenantListItem) {
    if (!accessToken) {
      return;
    }
    selectTenant(tenant);
    try {
      await selectCitizenTenant(sessionApiRoot(), accessToken, tenant.code);
    } catch {
      /* workspace still opens with local tenant */
    }
    navigation.navigate('Workspace');
  }

  async function savePins() {
    if (!accessToken || pinsDraft.length === 0) {
      setErrorLine('Pin at least one municipality.');
      return;
    }
    setBusy(true);
    setErrorLine(null);
    setStatusLine(null);
    try {
      const apiRoot = sessionApiRoot();
      const next = await patchCitizenPreferences(apiRoot, accessToken, {
        pinned_tenant_codes: pinsDraft,
        pinned_services: preferences?.pinned_services ?? [],
      });
      setPinsDirty(false);
      setPreferences(next);
      setPinsDraft([...next.pinned_tenant_codes]);
      const dash = await fetchCitizenDashboard(apiRoot, accessToken);
      setDashboard(dash);
      setStatusLine('Pinned municipalities saved.');
    } catch (err) {
      const message = err instanceof Error ? err.message : t('status.apiUnreachable', locale);
      setErrorLine(message);
    } finally {
      setBusy(false);
    }
  }

  async function openServiceShortcut(tenant: TenantListItem, serviceCode: string) {
    if (!accessToken) {
      return;
    }
    selectTenant(tenant);
    try {
      await selectCitizenTenant(sessionApiRoot(), accessToken, tenant.code);
    } catch {
      /* workspace still opens */
    }
    const services = serviceCatalogueByTenant[tenant.code] ?? [];
    const svc = services.find((row) => row.code === serviceCode);
    navigation.navigate('ApplicationComposer', {
      serviceCode,
      serviceName: svc?.name[locale],
      service: svc,
    });
  }

  function togglePinDraft(code: string) {
    setPinsDirty(true);
    setPinsDraft((prev) => {
      if (prev.includes(code)) {
        return prev.filter((c) => c !== code);
      }
      if (prev.length >= MAX_PINNED_MUNICIPALITIES) {
        return prev;
      }
      return [...prev, code];
    });
  }

  async function onSignOut() {
    await signOut();
    navigation.replace('OtpLogin');
  }

  const servicesKpi = dashboard?.distinct_active_service_codes ?? 0;

  return (
    <>
      <StatusBar style="dark" />
      <MobileScrollScreen>
        <MobileHubHero
          eyebrow="Citizen hub"
          subtitle={
            mobile
              ? `+91 ${mobile} · Track services across municipalities`
              : t('home.empty', locale)
          }
          title={t('home.label', locale)}
          trailing={
            <View style={styles.localeRow}>
              {SUPPORTED_LOCALES.map((lng) => (
                <Pressable
                  key={lng}
                  onPress={() => setLocale(lng as Locale)}
                  style={[styles.localeChip, locale === lng && { backgroundColor: brand }]}
                >
                  <Text style={[styles.localeLabel, locale === lng && { color: brandFg }]}>
                    {lng.toUpperCase()}
                  </Text>
                </Pressable>
              ))}
            </View>
          }
        />

        <HubTabBar activeTab={hubTab} onSelect={setHubTab} tabs={citizenHubTabs(locale)} />

        {busy && hubTab === 'home' ? (
          <ActivityIndicator color={brand} style={{ marginVertical: 12 }} />
        ) : null}
        {errorLine ? <Text style={styles.error}>{errorLine}</Text> : null}
        {statusLine ? <Text style={styles.ok}>{statusLine}</Text> : null}

        {hubTab === 'home' && dashboard ? (
          <>
            <HubKpiStrip
              items={[
                ['Language', locale.toUpperCase()],
                ['Services', String(servicesKpi)],
                ['Applications', String(hubTotals.applications)],
                ['Payments', String(hubTotals.payments)],
                ['Grievances', String(hubTotals.grievances)],
              ]}
            />
            {preferences?.pinned_services?.length ? (
              <PinnedServiceShortcuts
                locale={locale}
                onOpen={(tenant, serviceCode) => void openServiceShortcut(tenant, serviceCode)}
                preferences={preferences.pinned_services}
                serviceCatalogueByTenant={serviceCatalogueByTenant}
                tenants={tenants}
              />
            ) : null}
            <Text style={mobileTypography.section}>Pinned municipalities</Text>
            {pinnedBuckets.map(({ code, bucket, catalogue }) =>
              bucket ? (
                <PinnedMunicipalityCard
                  bucket={bucket}
                  catalogue={catalogue}
                  key={code}
                  onEnter={() => {
                    if (catalogue) {
                      void enterWorkspace(catalogue);
                    }
                  }}
                />
              ) : (
                <Text key={code} style={styles.warn}>
                  {code} — refresh hub or update Shortcuts
                </Text>
              ),
            )}
            <MobileSecondaryButton
              label="Browse all municipalities"
              onPress={() => navigation.navigate('BrowseTenants')}
            />
          </>
        ) : null}

        {hubTab === 'shortcuts' && (
          <MobilePanel>
            <Text style={mobileTypography.section}>
              Pinned municipalities (≤{MAX_PINNED_MUNICIPALITIES})
            </Text>
            <Text style={[mobileTypography.body, { marginTop: 8 }]}>
              Tap to toggle. Saving updates server preferences used on hub home.
            </Text>
            {tenants.map((row) => {
              const active = pinsDraft.includes(row.code);
              return (
                <Pressable
                  key={row.id}
                  onPress={() => togglePinDraft(row.code)}
                  style={[styles.pinRow, active && styles.pinRowActive]}
                >
                  <Text style={styles.pinTitle}>{row.code}</Text>
                  <Text style={styles.pinMeta}>{row.name}</Text>
                  <Text style={styles.pinCheck}>{active ? '✓' : ''}</Text>
                </Pressable>
              );
            })}
            <View style={{ marginTop: 14 }}>
              <MobilePrimaryButton
                disabled={busy || pinsDraft.length === 0}
                label={busy ? 'Saving…' : 'Save pins'}
                onPress={() => void savePins()}
              />
            </View>
          </MobilePanel>
        )}

        {hubTab === 'services' || hubTab === 'apply' ? (
          <MobilePanel>
            <Text style={mobileTypography.section}>
              {hubTab === 'services' ? 'Services catalogue' : 'Apply for a service'}
            </Text>
            <Text style={[mobileTypography.body, { marginTop: 8 }]}>
              Open a pinned municipality workspace, or browse the full tenant list. Hub Services KPI
              ({servicesKpi}) reflects the active catalogue union.
            </Text>
            <View style={{ marginTop: 14 }}>
              <MobilePrimaryButton
                label="Browse municipalities"
                onPress={() => navigation.navigate('BrowseTenants')}
              />
            </View>
          </MobilePanel>
        ) : null}

        {hubTab === 'applications' && (
          <HubPortfolioLink
            description="Portfolio view across pinned ULBs (unscoped list)."
            label="All applications"
            onPress={() => navigation.navigate('ApplicationList')}
          />
        )}

        {hubTab === 'payments' && (
          <HubPortfolioLink
            description="Portfolio payments across municipalities."
            label="All payments"
            onPress={() => navigation.navigate('PaymentList')}
          />
        )}

        {hubTab === 'grievances' && (
          <MobilePanel>
            <Text style={mobileTypography.section}>{t('grievance.nav', locale)}</Text>
            <HubGrievancesPanel tenants={tenants} />
          </MobilePanel>
        )}

        <Pressable
          accessibilityRole="button"
          onPress={() => void onSignOut()}
          style={styles.signOut}
        >
          <Text style={styles.signOutLabel}>Sign out</Text>
        </Pressable>
      </MobileScrollScreen>
    </>
  );
}

function HubPortfolioLink({
  label,
  description,
  onPress,
}: {
  label: string;
  description: string;
  onPress: () => void;
}) {
  return (
    <MobilePanel>
      <Text style={mobileTypography.section}>{label}</Text>
      <Text style={[mobileTypography.body, { marginTop: 8 }]}>{description}</Text>
      <View style={{ marginTop: 14 }}>
        <MobileSecondaryButton label={label} onPress={onPress} />
      </View>
    </MobilePanel>
  );
}

const styles = StyleSheet.create({
  localeRow: { flexDirection: 'row', gap: 8, marginTop: 14 },
  localeChip: {
    minHeight: 36,
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: MOBILE_RADIUS_PILL,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: MOBILE_WARM_BORDER,
    backgroundColor: MOBILE_SURFACE_HEX,
  },
  localeLabel: { fontSize: 12, fontWeight: '800', color: MOBILE_INK_SECONDARY },
  pinRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 10,
    minHeight: 48,
    padding: 14,
    borderRadius: 14,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: MOBILE_WARM_BORDER,
    backgroundColor: MOBILE_SURFACE_HEX,
  },
  pinRowActive: { backgroundColor: MOBILE_PEACH_SOFT_HEX, borderColor: MOBILE_LINK_HEX },
  pinTitle: { fontWeight: '800', color: MOBILE_INK_PRIMARY, width: 56, fontSize: 14 },
  pinMeta: { flex: 1, fontSize: 13, color: MOBILE_INK_SECONDARY },
  pinCheck: {
    fontSize: 20,
    fontWeight: '800',
    width: 28,
    textAlign: 'right',
    color: MOBILE_LINK_HEX,
  },
  signOut: { marginTop: 16, paddingVertical: 14, alignItems: 'center' },
  signOutLabel: { fontSize: 14, fontWeight: '700', color: MOBILE_ERROR_HEX },
  error: { color: MOBILE_ERROR_HEX, fontWeight: '600', marginBottom: 8 },
  ok: { color: MOBILE_SUCCESS_HEX, fontWeight: '600', marginBottom: 8 },
  warn: { color: MOBILE_WARNING_HEX, marginBottom: 8, fontSize: 13 },
});

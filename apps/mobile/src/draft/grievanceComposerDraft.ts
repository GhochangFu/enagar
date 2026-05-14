import {
  MOBILE_GRIEVANCE_DRAFT_SCHEMA,
  createFormDraftEnvelope,
  parseFormDraftJson,
} from '@enagar/forms';
import AsyncStorage from '@react-native-async-storage/async-storage';

export type GrievanceComposerDraftPayload = {
  category_slug: string;
  description: string;
  priority: 'low' | 'medium' | 'high' | 'urgent';
  ward_hint?: string;
  address_hint?: string;
};

function storageKey(tenantCode: string): string {
  return `@enagar/draft/grievance/${tenantCode}`;
}

export async function loadGrievanceComposerDraft(
  tenantCode: string,
): Promise<GrievanceComposerDraftPayload | null> {
  const raw = await AsyncStorage.getItem(storageKey(tenantCode));
  if (!raw) {
    return null;
  }
  const envelope = parseFormDraftJson<GrievanceComposerDraftPayload>(raw);
  if (!envelope || envelope.schemaKey !== MOBILE_GRIEVANCE_DRAFT_SCHEMA) {
    return null;
  }
  if (envelope.tenantCode !== tenantCode) {
    return null;
  }
  return envelope.payload as GrievanceComposerDraftPayload;
}

export async function persistGrievanceComposerDraft(
  tenantCode: string,
  payload: GrievanceComposerDraftPayload,
): Promise<void> {
  const envelope = createFormDraftEnvelope(MOBILE_GRIEVANCE_DRAFT_SCHEMA, tenantCode, payload);
  await AsyncStorage.setItem(storageKey(tenantCode), JSON.stringify(envelope));
}

export async function clearGrievanceComposerDraft(tenantCode: string): Promise<void> {
  await AsyncStorage.removeItem(storageKey(tenantCode));
}

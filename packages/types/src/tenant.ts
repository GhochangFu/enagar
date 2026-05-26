// Minimal tenant-shape stubs. Full Prisma-derived types arrive in Phase 1
// once the schema is settled; this file exists so other scaffolds can
// reference `TenantId` etc. without circular phase dependencies.

/** UUID v7 string identifying a tenant (municipality / ULB). */
export type TenantId = string;

/** Per-tenant feature flags & integration config (mirrors `tenants.config` JSONB). */
export interface TenantConfig {
  chatbot?: {
    enabled?: boolean;
    /** Override of the global LLM_PROVIDER for this tenant (ADR-0008). */
    provider?: 'openai' | 'gemini' | 'ollama';
    /** Secondary provider when primary transport fails (Sprint 7.3). */
    fallback_provider?: 'openai' | 'gemini' | 'ollama';
    /** Provider-side model id. Falls back to the env-level default. */
    model?: string;
    /** Required by the runtime guard before any provider call is made. */
    dpa_signed?: boolean;
    /** Monthly token budget in INR; alerts fire at 80 % consumption. */
    monthly_budget_inr?: number;
  };
  bookings?: { enabled?: boolean };
  smart_city?: {
    parking?: { enabled?: boolean };
    ev_charging?: { enabled?: boolean };
  };
  // …extended in later phases.
}

export interface Tenant {
  id: TenantId;
  code: string; // e.g. 'KMC'
  name: string;
  district: string | null;
  ward_count: number | null;
  theme_color: string | null; // e.g. '#0F4C75'
  logo_url: string | null;
  languages_enabled: ReadonlyArray<'en' | 'bn' | 'hi'>;
  config: TenantConfig;
  is_active: boolean;
  created_at: string; // ISO 8601
}

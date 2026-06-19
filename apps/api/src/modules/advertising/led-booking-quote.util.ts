export const AD_LED_SERVICE_CODE = 'ad-led' as const;

export type LedBookingSnapshot = {
  asset_code: string;
  starts_at: string;
  ends_at: string;
  rent_paise: number;
  deposit_paise: number;
  total_paise: number;
  revenue_head_code?: string | null;
  quoted_at: string;
};

export function buildLedBookingSnapshot(input: {
  asset_code: string;
  starts_at: string;
  ends_at: string;
  rent_paise: number;
  deposit_paise: number;
  revenue_head_code?: string | null;
  quoted_at?: Date;
}): LedBookingSnapshot {
  return {
    asset_code: input.asset_code.trim(),
    starts_at: input.starts_at,
    ends_at: input.ends_at,
    rent_paise: input.rent_paise,
    deposit_paise: input.deposit_paise,
    total_paise: input.rent_paise + input.deposit_paise,
    revenue_head_code: input.revenue_head_code ?? null,
    quoted_at: (input.quoted_at ?? new Date()).toISOString(),
  };
}

export function parseLedBookingSnapshot(
  formData: Record<string, unknown>,
): LedBookingSnapshot | null {
  const raw = formData.led_booking_snapshot;
  if (typeof raw !== 'string' || !raw.trim()) {
    return null;
  }
  try {
    const parsed = JSON.parse(raw) as Partial<LedBookingSnapshot>;
    if (
      typeof parsed.asset_code !== 'string' ||
      typeof parsed.starts_at !== 'string' ||
      typeof parsed.ends_at !== 'string' ||
      typeof parsed.rent_paise !== 'number' ||
      typeof parsed.deposit_paise !== 'number' ||
      typeof parsed.total_paise !== 'number' ||
      typeof parsed.quoted_at !== 'string'
    ) {
      return null;
    }
    return parsed as LedBookingSnapshot;
  } catch {
    return null;
  }
}

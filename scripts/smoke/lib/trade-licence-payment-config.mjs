/** ADR-0013 payment config for KMC trade-licence (catalogue defaults). */
export const KMC_TRADE_LICENCE_PAYMENT_CONFIG = {
  payment_schedule: 'upfront_and_deferred',
  fee_lines: {
    application: {
      label: {
        en: 'Application fee',
        bn: 'আবেদন ফি',
        hi: 'आवेदन शुल्क',
      },
      rule: { type: 'fixed', amount_paise: 50_000, currency: 'INR' },
    },
    approval: {
      label: {
        en: 'Licence fee',
        bn: 'লাইসেন্স ফি',
        hi: 'लाइसेंस शुल्क',
      },
      rule: { type: 'fixed', amount_paise: 100_000, currency: 'INR' },
    },
  },
};

/** Smaller approval fee for post-approval desk smokes (Phase 11). */
export const PHASE11_TRADE_LICENCE_PAYMENT_CONFIG = {
  ...KMC_TRADE_LICENCE_PAYMENT_CONFIG,
  fee_lines: {
    ...KMC_TRADE_LICENCE_PAYMENT_CONFIG.fee_lines,
    approval: {
      ...KMC_TRADE_LICENCE_PAYMENT_CONFIG.fee_lines.approval,
      rule: { type: 'fixed', amount_paise: 1_000, currency: 'INR' },
    },
  },
};

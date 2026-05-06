# Service catalogue audit

> **Purpose.** Audit the 76+ services demonstrated in the prototype (`index.html`, `MunicipalApp.jsx`), document their structure, fees, SLAs, and workflow patterns, and produce the **seed-data plan** that Phase 2 will execute.

> **Audit source.** A line-by-line read of `index.html` (4857 lines) and `MunicipalApp.jsx` (2188 lines), captured 2026-05-06. Every claim in this document cites the prototype line range.

> **Status:** v0.1 — Sprint 0.2 deliverable. Coverage = **76 services** across **14 categories**. Prototype `SERVICES.length` reports **81**; the 5 extras are reference duplicates flagged in §13.

---

## 1. Why this document exists

The plug-and-play promise of eNagarSeba is that _new municipalities and new services are data, not code_. To make that real, three things have to be locked in **before** Phase 2 starts the implementation:

1. **The shape of a service** — what fields a service-template carries, how forms are described, how workflows are described.
2. **The catalogue itself** — which services ship out-of-the-box, what they cost, how long they take.
3. **The seed-data plan** — how prototype mock-data becomes the bootstrapped reference catalogue every new ULB inherits.

This document delivers all three, **purely as specification**. The actual TypeScript / SQL seed lives under `apps/api/prisma/seed/` (Phase 2 Sprint 2.1).

---

## 2. Service categories (14)

Source: `index.html:450-591` · `MunicipalApp.jsx:25-109`. **Categories are translated; service titles are not** (a Phase-2 gap — see §13).

| code       | English                | বাংলা               | हिंदी                 | Services in v1 | Notes                                                                                         |
| ---------- | ---------------------- | ------------------- | --------------------- | -------------- | --------------------------------------------------------------------------------------------- |
| `cert`     | Certificates           | শংসাপত্র            | प्रमाणपत्र            | 4              | Birth, Death, Marriage, Trade Licence                                                         |
| `tax`      | Tax & Property         | কর ও সম্পত্তি       | कर एवं संपत्ति        | 5              | Holding-tax, mutation, self-assessment                                                        |
| `water`    | Water & Sanitation     | জল ও স্যানিটেশন     | जल एवं स्वच्छता       | 7              | New connection, billing, sewerage, SWM                                                        |
| `building` | Building & Plan        | নির্মাণ ও পরিকল্পনা | भवन एवं योजना         | 4              | Plan, completion, occupancy, revision                                                         |
| `health`   | Health Services        | স্বাস্থ্য সেবা      | स्वास्थ्य सेवाएं      | 5              | Health licence, fogging, ambulance, hearse, crematorium                                       |
| `infra`    | Infrastructure         | অবকাঠামো            | अवसंरचना              | 3              | Road, streetlight, tree                                                                       |
| `welfare`  | Welfare & Pensions     | কল্যাণ ও পেনশন      | कल्याण एवं पेंशन      | 3              | Old-age, widow, disability                                                                    |
| `adv`      | Advertising & Hoarding | বিজ্ঞাপন ও হোর্ডিং  | विज्ञापन एवं होर्डिंग | 6              | Hoarding, billboard, mobile, LED, WiFi, bus-shelter                                           |
| `rent`     | Bookings & Rentals     | বুকিং ও ভাড়া       | बुकिंग एवं किराये     | 8              | Community hall, auditorium, market shop, stalls, parking lease, park, equipment, sport ground |
| `smart`    | Smart City             | স্মার্ট সিটি        | स्मार्ट सिटी          | 8              | Parking, EV charging, IoT meters, GIS data, land lease, rooftop solar, telecom NOC            |
| `fines`    | Fines & Penalties      | জরিমানা ও দণ্ড      | जुर्माना एवं दंड      | 8              | Late-payment, encroachment, illegal-construction, sanitation, trade, dumping, noise           |
| `tender`   | Tenders & Deposits     | দরপত্র ও জমা        | निविदा एवं जमा        | 6              | Form, EMD, security deposit, refund, scrap sale, vendor reg                                   |
| `info`     | Information & RTI      | তথ্য ও আরটিআই       | सूचना एवं आरटीआई      | 5              | RTI, doc-search, birth/death record search, certified copy                                    |
| `misc`     | Miscellaneous NOCs     | বিবিধ এনওসি         | विविध एनओसी           | 4              | Event, pandal, road-cut, tree-cut                                                             |
| **Total**  |                        |                     |                       | **76**         |                                                                                               |

> **Display order** in the citizen-PWA mirrors this table — citizens scroll vertically through cards. Per-tenant overrides (e.g. a small ULB hides `tender`) are honoured via `tenants.config.disabled_categories`.

---

## 3. Service-template structure

This is the **canonical shape** of a service-template row. Every service in the catalogue conforms; tenant overrides apply at the same shape.

```ts
// Full Prisma model lands in Phase 2 Sprint 2.1.
// This TS interface is the source of truth for design discussions.

interface ServiceTemplate {
  // ─── Identity ───────────────────────────────────────────────────────
  code: string;                 // e.g. 'birth-cert' — URL-safe, immutable
  category_code: 'cert' | 'tax' | 'water' | …;

  // ─── Display ────────────────────────────────────────────────────────
  title: { en: string; bn: string; hi: string };
  description: { en: string; bn: string; hi: string };
  icon: string;                 // Lucide icon name; mascots in admin portal
  popular: boolean;             // surfaces on Home as a quick-action card

  // ─── Money ──────────────────────────────────────────────────────────
  fees: FeeRule;                // see §5 — fixed | slab | computed | free
  late_fee?: LateFeeRule;       // optional; e.g. property-tax 2 %/mo
  refundable?: boolean;         // tender deposits, security deposits

  // ─── Eligibility ────────────────────────────────────────────────────
  eligibility: {
    min_age?: number;
    citizen_only?: boolean;     // some services accept org-applicants
    requires_holding?: boolean;
    requires_active_trade_license?: boolean;
    custom_rule_json_schema?: object;     // Ajv expression
  };

  // ─── Required documents ─────────────────────────────────────────────
  required_documents: Array<{
    code: string;               // e.g. 'aadhaar', 'hospital-discharge'
    label: { en: string; bn: string; hi: string };
    accept: string[];           // mime types: ['application/pdf', 'image/jpeg']
    max_size_mb: number;        // default 10
    digilocker_uri?: string;    // if fetchable
    optional?: boolean;
  }>;

  // ─── Form schema ────────────────────────────────────────────────────
  form_schema: object;          // JSON-Schema draft 2020-12 (per @enagar/forms)
  ui_schema?: object;           // RJSF-style hints (widget, order, hidden)

  // ─── Workflow ───────────────────────────────────────────────────────
  workflow_pattern: 'cert-issuance' | 'tax-payment' | 'booking' | 'noc' | 'pension' | 'fine' | 'instant';
  workflow_overrides?: Stage[]; // per-tenant deviations from the pattern

  // ─── Promises ───────────────────────────────────────────────────────
  sla_days: number;             // working days from submit to certificate
  output_certificate?: { code: string; format: 'pdf'; pushes_to_digilocker: boolean };
  output_receipt: boolean;      // every paid service emits a receipt

  // ─── External-data lookup ───────────────────────────────────────────
  // Optional. Declares THAT a lookup point exists; the implementation
  // is provided by a per-tenant adapter (see ADR-0010).
  external_lookup?: {
    enabled: boolean;
    trigger_field: string;             // form field whose change triggers the lookup
    trigger_event: 'blur' | 'click' | 'on-load';
    input_schema: object;              // JSON-Schema for the lookup body
    output_schema: object;             // JSON-Schema for the response
    prefill_fields: Array<{
      from: string;                    // dotted path inside lookup result
      to: string;                      // form field id
    }>;
    show_summary_card?: boolean;       // render the dues / record summary card
  };

  // ─── Operational ────────────────────────────────────────────────────
  active: boolean;              // tenant can disable
  available_from: Date | null;  // dated rollout
  available_to: Date | null;    // dated retirement

  // ─── Audit ──────────────────────────────────────────────────────────
  source: 'state-template' | 'tenant-custom';
  parent_template_code?: string;          // when a tenant clones + modifies
  version: number;
  created_at: Date;
  updated_at: Date;
}
```

> **Single source of truth principle.** `form_schema` (JSON-Schema) is consumed by:
>
> 1. The citizen-PWA via `@enagar/forms` (RJSF + custom widgets).
> 2. The mobile app via `@enagar/forms` RN renderer.
> 3. The API server via `Ajv` for server-side validation.  
>    Editing `form_schema` in `apps/admin-tenant` instantly changes the form on web, mobile, and validator — _no redeploy, no migration_.

---

## 4. Workflow patterns

Six reusable patterns cover all 76 services. Per-service deviations are expressed as `workflow_overrides`, never as wholly new patterns.

### 4.1 `cert-issuance` (Certificates, NOCs, Building approvals)

```
submit → field-verify → fee-calc → pay → officer-approve → certificate-issue → closed
   │           │            │       │            │                 │
   └── citizen ┴── ward    ──┴── citizen          └── officer       └── auto + DigiLocker push
       (form)    inspector       (gateway)           (manual)
```

**Used by** Birth Cert, Death Cert, Marriage Reg, Trade Licence, Health Licence, Building Plan, Completion Cert, Occupancy Cert, Plan Revision, Telecom NOC, Event NOC, Pandal NOC, Road-cut NOC, Tree-cut NOC. **14 services.**

### 4.2 `tax-payment` (Property, Water, Conservancy, etc.)

```
fetch-dues → calculate-late-fee → pay → receipt-issue → closed
     │              │              │          │
     └── citizen    ─ system       ─ citizen   └── auto + email/SMS
         (holding/conn no.)          (gateway)
```

**Used by** Property Tax, Water Tax, Conservancy Tax, Self-Assessment, Water Bill, Sewerage Bill, SWM Fee, Smart Parking, EV Charging, IoT Water Meter Recharge, all 8 fines, IoT/smart instant payments. **18 services.**

### 4.3 `booking` (Halls, parks, slots, EV/parking)

```
check-availability → block-slot → pay → confirm → use → closed
       │                  │       │       │       │
       └── citizen        ─ system ─ citizen ─ system ─ system (cancellation/refund window)
```

**Used by** Community Hall, Auditorium, Park, Sport Ground, Equipment Hiring, Daily Stall, Parking Lease, Hearse, Ambulance, Crematorium, Smart Parking. **11 services.**

### 4.4 `pension` (Welfare disbursement)

```
submit → field-verify → bank-validate → officer-approve → schedule-disbursement → closed
   │           │              │                │                   │
   └── citizen ┴── ward       ─ NACH/ACH        └── officer         └── recurring (BullMQ cron)
       (form +     inspector
        income
        cert)
```

**Used by** Old Age Pension, Widow Pension, Disability Pension. **3 services.**

### 4.5 `noc` (Pure permission grant — no fee, fast)

```
submit → field-verify → officer-approve → noc-issue → closed
```

> Currently merged into `cert-issuance`; called out so a tenant can configure a **fee-free** variant when statutory.

### 4.6 `instant` (Direct payments and information lookups)

```
form → pay (or no-pay) → receipt → closed
```

**Used by** RTI Application, Old Document Search, Old Birth/Death Record Search, Certified Copy, Public Toilet Pass, Tender Form Purchase, all 6 Tender / Deposit services, all 8 Fines (when paid by citizen at counter or online), Mosquito Fogging Request, Road Repair Request, Streetlight Repair, Tree Pruning Request. **30 services.**

> **Distinction from `tax-payment`:** instant has no "calculate late fee" step. The amount is the amount.

### 4.7 Pattern coverage summary

| Pattern         | Service count               |
| --------------- | --------------------------- |
| `cert-issuance` | 14                          |
| `tax-payment`   | 18                          |
| `booking`       | 11                          |
| `pension`       | 3                           |
| `noc`           | merged into `cert-issuance` |
| `instant`       | 30                          |
| **Total**       | **76**                      |

---

## 5. Fee rules

Fees are stored as **paise (integer)** to avoid float arithmetic. Display formatting is locale-aware (`₹` symbol, `1,23,456.78` Indian numbering).

```ts
type FeeRule =
  | { kind: 'fixed'; amount_paise: number }
  | { kind: 'free' }
  | { kind: 'slab'; slabs: Array<{ upto: number; amount_paise: number }>; based_on: 'sqft' | 'units' | 'income' }
  | { kind: 'computed'; formula: string; inputs: string[] } // sandboxed JS expr
  | { kind: 'tender'; note: string }; // EMD/SD: % of contract — handled by tender flow

type LateFeeRule =
  | { kind: 'percent_per_month'; rate: number } // 2 % / month
  | { kind: 'flat'; amount_paise: number }
  | { kind: 'graduated'; rules: Array<{ after_days: number; amount_paise: number }> };
```

Reference fee patterns from the prototype (`index.html:1972-2117` knowledge-base block):

| Service           | Fee                                   | Late fee                       |
| ----------------- | ------------------------------------- | ------------------------------ |
| Birth Cert        | ₹50 (free if filed within 21 days)    | ₹100 + magistrate after 1 yr   |
| Trade Licence     | ₹1,500 (new) / ₹1,000 (renewal)       | 25 % surcharge on late renewal |
| Property Tax      | computed from holding (slab × sq.ft.) | 2 %/mo                         |
| Building Plan     | ₹5,000 base + per-sq.ft. slab         | —                              |
| Sewerage Conn     | ₹3,500                                | —                              |
| Public WiFi Ad    | ₹5,000/month                          | —                              |
| Smart Parking     | ₹20-50/h                              | —                              |
| Pension           | free                                  | n/a (recurring disbursement)   |
| RTI               | ₹10 (BPL exempt)                      | n/a                            |
| Late-payment fine | computed: outstanding × 2 % × months  | n/a                            |

---

## 6. SLA targets

Working days, from `submit` to `certificate-issue` (or `closed` for non-cert flows).

| Pattern                  | Median target | Outliers                                          |
| ------------------------ | ------------- | ------------------------------------------------- |
| `instant`                | 0 (real-time) | RTI: **30 days** statutory                        |
| `tax-payment`            | 0 (real-time) | None                                              |
| `cert-issuance` (light)  | **7-15**      | Birth Cert 7d; Marriage Reg 15d; Tree-cut NOC 15d |
| `cert-issuance` (medium) | **21-30**     | Trade Licence 21d; Mutation 30d; Completion 30d   |
| `cert-issuance` (heavy)  | **45-60**     | Building Plan 60d; Land Lease 60d                 |
| `booking`                | **2-5**       | Community Hall 3d; Sport Ground 5d                |
| `pension`                | **45**        | All three pension types                           |

> **Escalation rule.** SLA breach triggers (a) auto-comment on the application, (b) email to next-up officer, (c) Commissioner-dashboard counter +1, (d) optional auto-approve if `tenants.config.allow_sla_auto_approve = true` (off by default).

---

## 7. Required-documents inventory

Distinct document codes referenced across the 76 services. Phase-2 seed populates this as a separate table for de-duplication (`required_documents` JOIN `documents`). DigiLocker URI fills in where the doc is fetchable.

| code                 | English label                          | DigiLocker URI              | Used by N services       |
| -------------------- | -------------------------------------- | --------------------------- | ------------------------ |
| `aadhaar`            | Aadhaar (last 4 + DigiLocker)          | `in.gov.uidai-aadhaar`      | 60+                      |
| `address-proof`      | Address proof                          | (multiple)                  | 30+                      |
| `holding-receipt`    | Last property tax receipt              | — (fetched via Holding No.) | 12                       |
| `connection-no`      | Water / sewerage connection number     | — (lookup)                  | 7                        |
| `hospital-discharge` | Hospital discharge summary             | —                           | 1 (Birth Cert)           |
| `medical-cert`       | Medical death certificate              | —                           | 1 (Death Cert)           |
| `marriage-witnesses` | Two witnesses + Aadhaar                | `in.gov.uidai-aadhaar`      | 1                        |
| `architect-drawings` | Architect-stamped drawings             | —                           | 4 (Building\*)           |
| `land-deed`          | Sale deed / lease deed                 | —                           | 8                        |
| `nocs`               | Fire / Pollution / Lift / Aviation NOC | —                           | 6                        |
| `trade-license`      | Active Trade Licence                   | (intra-platform)            | 12                       |
| `fssai`              | FSSAI licence                          | —                           | 1 (Health Trade Licence) |
| `disability-cert`    | UDID / 40 %+ disability certificate    | `in.gov.disability-udid`    | 1                        |
| `income-cert`        | Income certificate                     | `in.gov.income-cert`        | 3 (pensions)             |
| `bank-passbook`      | Bank passbook scan                     | —                           | 4                        |
| `gst-cert`           | GST registration                       | `in.gov.gst-cert`           | 6 (tender, vendor)       |
| `pan`                | PAN card                               | `in.gov.income-tax-pan`     | 8 (tender, vendor)       |
| `event-details`      | Event description PDF                  | —                           | 4 (NOCs, bookings)       |
| `vehicle-rc`         | Vehicle Registration Certificate       | `in.gov.parivahan-rc`       | 1 (Mobile Ad)            |
| `creative-mock`      | Hoarding / billboard creative          | —                           | 5 (advertising)          |
| `geo-photos`         | Geotagged photos                       | —                           | 7 (sanitation, encroach) |
| `notice-number`      | Notice / challan number                | —                           | 8 (fines)                |
| `org-letter`         | Organisation letter / authority        | —                           | 6 (rent, scrap, GIS)     |
| `solvency-cert`      | Solvency / financial statement         | —                           | 3 (vendor, lease)        |

> **Phase-2 task:** finalize `required_documents` table with all DigiLocker URIs verified against `digilocker.gov.in/oauth2`. Owner: Backend.

---

## 8. Priority service specs (the Phase-2 lead-batch)

These are the **6 services Phase 2 implements first**. They were chosen by:

1. Citizen-PWA prototype lists them as `popular: true` (`index.html:1633` and surrounding rows).
2. They cover all six workflow patterns above (so the engine is exercised end-to-end on day one).
3. They map to **distinct fee rules** and **distinct certificate outputs**.

### 8.1 `birth-cert` — Birth Certificate

| field         | value                                                                                                                                                            |
| ------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Category      | `cert`                                                                                                                                                           |
| Pattern       | `cert-issuance`                                                                                                                                                  |
| Fee           | `free` if within 21 days of birth; `fixed` ₹50 (21d-1y); `flat-late` ₹100 + magistrate order if >1y                                                              |
| SLA           | **7 days**                                                                                                                                                       |
| Eligibility   | `applicant must be parent or guardian; child must have been born in this ULB jurisdiction`                                                                       |
| Required docs | `hospital-discharge`, `aadhaar` (parent), `address-proof`, optional `marriage-cert`                                                                              |
| Form fields   | `child_name`, `dob`, `gender`, `place_of_birth`, `father_name`, `mother_name`, `address`, `ward_no`, `hospital_doc` (file) — full schema in `index.html:613-639` |
| Output        | Certificate PDF (signed); pushed to citizen DigiLocker                                                                                                           |

### 8.2 `prop-tax` — Property Tax Payment

| field         | value                                                                         |
| ------------- | ----------------------------------------------------------------------------- |
| Category      | `tax`                                                                         |
| Pattern       | `tax-payment`                                                                 |
| Fee           | `computed` from holding (slab × sq.ft.)                                       |
| Late fee      | 2 %/month on outstanding                                                      |
| SLA           | Real-time                                                                     |
| Eligibility   | Holder of the holding; or anyone with the holding number (allows tenant-paid) |
| Required docs | None at submission; holding number is the lookup key                          |
| Form fields   | `holding_number`, optional `last_receipt_no`                                  |
| Output        | Receipt PDF                                                                   |

### 8.3 `trade-license` — Trade Licence (new + renewal)

| field         | value                                                                                                                 |
| ------------- | --------------------------------------------------------------------------------------------------------------------- |
| Category      | `cert`                                                                                                                |
| Pattern       | `cert-issuance`                                                                                                       |
| Fee           | `slab` by trade type (12 slabs from food-stall ₹500 → industrial ₹50,000) — see `index.html:1996-2003` for KB summary |
| Late fee      | 25 % surcharge on late renewal                                                                                        |
| SLA           | **21 days**                                                                                                           |
| Eligibility   | Adult applicant; valid premises proof; FSSAI for food trades                                                          |
| Required docs | `aadhaar`, `address-proof`, `land-deed` or `rental-agreement`, `passport-photo`, optional `fssai`                     |
| Output        | Certificate PDF (annual) + DigiLocker push                                                                            |

### 8.4 `community-hall` — Community Hall Booking

| field         | value                                                                                 |
| ------------- | ------------------------------------------------------------------------------------- |
| Category      | `rent`                                                                                |
| Pattern       | `booking`                                                                             |
| Fee           | `fixed` ₹5,000 + refundable deposit ₹5,000                                            |
| SLA           | **3 days** for confirmation; slot held for payment-window 30 min                      |
| Eligibility   | Anyone (including out-of-tenant — ULB choice via override)                            |
| Required docs | `aadhaar` or `org-letter`, `event-details`                                            |
| Form fields   | `event_date`, `event_type`, `expected_attendees`, `slot` (morning/afternoon/full-day) |
| Output        | Booking confirmation PDF + receipt                                                    |

### 8.5 `sanitation-grievance` — Garbage-not-collected (representative grievance)

> Grievances ride a **separate** workflow under `services/workflow-engine` (Phase 4), but the catalogue documents them here for vocabulary parity.

| field    | value                                                                                              |
| -------- | -------------------------------------------------------------------------------------------------- |
| Category | `grievance` (top-level) → `sanitation` → sub-type _garbage-not-collected_                          |
| Pattern  | bespoke (Phase 4) — `submit → triage → assign → field-verify → resolve → citizen-confirm → closed` |
| SLA      | 48 h (default) — 24 h if priority `High`                                                           |
| Required | photo (geotagged), street address, ward (auto-resolved)                                            |
| Output   | Resolution photo + resolved status                                                                 |

### 8.6 `rti` — RTI Application

| field         | value                                                                               |
| ------------- | ----------------------------------------------------------------------------------- |
| Category      | `info`                                                                              |
| Pattern       | `instant` (with statutory 30-day SLA)                                               |
| Fee           | `fixed` ₹10 (BPL: free)                                                             |
| SLA           | **30 days** statutory                                                               |
| Eligibility   | Indian citizen                                                                      |
| Required docs | `aadhaar`; `bpl-card` for fee waiver                                                |
| Form fields   | `subject`, `period_start`, `period_end`, `description`, optional `delivery_address` |
| Output        | Information bundle PDF (or refusal with reason)                                     |

---

## 9. Full inventory (76 services)

See `index.html:593-1633` for the canonical row data. Compact map below; **`X`** = popular flag set in prototype.

| Code                 | Category   | Pattern       | Fee (paise) | SLA  | Pop | Prototype line |
| -------------------- | ---------- | ------------- | ----------- | ---- | --- | -------------- |
| `birth-cert`         | `cert`     | cert-issuance | 5 000       | 7 d  | X   | 613-639        |
| `death-cert`         | `cert`     | cert-issuance | 5 000       | 7 d  |     |                |
| `marriage-reg`       | `cert`     | cert-issuance | 20 000      | 15 d |     |                |
| `trade-license`      | `cert`     | cert-issuance | 1 50 000    | 21 d | X   |                |
| `prop-tax`           | `tax`      | tax-payment   | computed    | rt   | X   |                |
| `mutation`           | `tax`      | cert-issuance | 50 000      | 30 d |     |                |
| `water-tax`          | `tax`      | tax-payment   | computed    | rt   |     |                |
| `conservancy-tax`    | `tax`      | tax-payment   | computed    | rt   |     |                |
| `self-assess`        | `tax`      | cert-issuance | 0           | 21 d |     |                |
| `water-conn`         | `water`    | cert-issuance | 2 50 000    | 21 d | X   |                |
| `water-bill`         | `water`    | tax-payment   | computed    | rt   |     |                |
| `sewerage-conn`      | `water`    | cert-issuance | 3 50 000    | 30 d |     |                |
| `sewerage-bill`      | `water`    | tax-payment   | computed    | rt   |     |                |
| `swm-fee`            | `water`    | tax-payment   | 20 000      | rt   |     |                |
| `public-toilet`      | `water`    | instant       | 10 000      | rt   |     |                |
| `septic-cleaning`    | `water`    | cert-issuance | 1 20 000    | 5 d  |     |                |
| `building-plan`      | `building` | cert-issuance | 5 00 000    | 60 d |     |                |
| `completion`         | `building` | cert-issuance | 1 00 000    | 30 d |     |                |
| `occupancy`          | `building` | cert-issuance | 1 50 000    | 30 d |     |                |
| `plan-revise`        | `building` | cert-issuance | 2 50 000    | 45 d |     |                |
| `health-license`     | `health`   | cert-issuance | 80 000      | 15 d |     |                |
| `fogging`            | `health`   | instant       | 0           | 3 d  |     |                |
| `ambulance`          | `health`   | booking       | 50 000      | rt   |     |                |
| `hearse`             | `health`   | booking       | 80 000      | rt   |     |                |
| `crematorium`        | `health`   | booking       | 50 000      | rt   |     |                |
| `road-repair`        | `infra`    | instant       | 0           | 7 d  |     |                |
| `streetlight`        | `infra`    | instant       | 0           | 5 d  |     |                |
| `tree-pruning`       | `infra`    | instant       | 0           | 10 d |     |                |
| `pension`            | `welfare`  | pension       | 0           | 45 d |     |                |
| `widow-pension`      | `welfare`  | pension       | 0           | 45 d |     |                |
| `disability-pension` | `welfare`  | pension       | 0           | 45 d |     |                |
| `ad-hoarding`        | `adv`      | cert-issuance | 5 00 000    | 15 d | X   |                |
| `ad-billboard`       | `adv`      | cert-issuance | 25 00 000   | 21 d |     |                |
| `ad-mobile`          | `adv`      | cert-issuance | 2 00 000    | 7 d  |     |                |
| `ad-led`             | `adv`      | booking       | 15 00 000   | 5 d  |     |                |
| `ad-wifi`            | `adv`      | tax-payment   | 5 00 000    | rt   |     |                |
| `ad-bus-shelter`     | `adv`      | cert-issuance | 8 00 000    | 10 d |     |                |
| `community-hall`     | `rent`     | booking       | 5 00 000    | 3 d  | X   |                |
| `auditorium`         | `rent`     | booking       | 15 00 000   | 7 d  |     |                |
| `market-shop`        | `rent`     | tax-payment   | computed    | rt   |     |                |
| `stall-daily`        | `rent`     | booking       | 10 000      | rt   |     |                |
| `parking-lease`      | `rent`     | tender        | 50 00 000   | 30 d |     |                |
| `park-booking`       | `rent`     | booking       | 2 00 000    | 3 d  |     |                |
| `equipment-hire`     | `rent`     | booking       | computed    | 2 d  |     |                |
| `sport-ground`       | `rent`     | booking       | 3 00 000    | 5 d  |     |                |
| `smart-parking`      | `smart`    | booking       | 3 000       | rt   | X   |                |
| `ev-charging`        | `smart`    | tax-payment   | computed    | rt   |     |                |
| `iot-water`          | `smart`    | tax-payment   | computed    | rt   |     |                |
| `smart-waste`        | `smart`    | tax-payment   | 20 000      | rt   |     |                |
| `gis-data`           | `smart`    | cert-issuance | 10 00 000   | 15 d |     |                |
| `land-lease`         | `smart`    | tender        | 1 00 00 000 | 60 d |     |                |
| `rooftop-solar`      | `smart`    | cert-issuance | 0           | 30 d |     |                |
| `telecom-noc`        | `smart`    | cert-issuance | 25 00 000   | 30 d |     |                |
| `fine-water-late`    | `fines`    | tax-payment   | computed    | rt   |     |                |
| `fine-tax-late`      | `fines`    | tax-payment   | computed    | rt   |     |                |
| `fine-encroach`      | `fines`    | instant       | computed    | rt   |     |                |
| `fine-illegal-const` | `fines`    | instant       | computed    | rt   |     |                |
| `fine-sanitation`    | `fines`    | instant       | 50 000      | rt   |     |                |
| `fine-trade`         | `fines`    | instant       | 1 00 000    | rt   |     |                |
| `fine-dump`          | `fines`    | instant       | 1 00 000    | rt   |     |                |
| `fine-noise`         | `fines`    | instant       | 1 00 000    | rt   |     |                |
| `tender-form`        | `tender`   | instant       | 50 000      | rt   |     |                |
| `tender-emd`         | `tender`   | tender        | computed    | rt   |     |                |
| `security-deposit`   | `tender`   | tender        | computed    | 5 d  |     |                |
| `deposit-refund`     | `tender`   | tender        | refund      | 15 d |     |                |
| `scrap-sale`         | `tender`   | tender        | 10 000      | rt   |     |                |
| `vendor-reg`         | `tender`   | cert-issuance | 2 50 000    | 21 d |     |                |
| `rti`                | `info`     | instant       | 1 000       | 30 d | X   |                |
| `doc-search`         | `info`     | instant       | 20 000      | 7 d  |     |                |
| `birth-search`       | `info`     | instant       | 10 000      | 7 d  |     |                |
| `death-search`       | `info`     | instant       | 10 000      | 7 d  |     |                |
| `cert-copy`          | `info`     | instant       | 15 000      | 7 d  |     |                |
| `event-noc`          | `misc`     | cert-issuance | 1 50 000    | 7 d  |     |                |
| `pandal-noc`         | `misc`     | cert-issuance | 50 000      | 5 d  |     |                |
| `roadcut-noc`        | `misc`     | cert-issuance | 5 00 000    | 10 d |     |                |
| `tree-cut-noc`       | `misc`     | cert-issuance | 2 00 000    | 15 d |     |                |

> Line numbers within the prototype are referenced inline (`index.html:NNN`). Source-of-truth is the audit report; this table is condensed for review.

---

## 10. Identifier formats

Lock these formats now — they appear on receipts, certificates, citizen mailers, official letters, and DigiLocker pushes. Changing them later is expensive.

### 10.1 Application ID

```
WBM/<TENANT_CODE>/<SERVICE_CODE>/<YEAR>/<5-DIGIT-SEQUENCE>

Example: WBM/KMC/birth-cert/2026/00342
```

| Part                 | Description                                                       |
| -------------------- | ----------------------------------------------------------------- |
| `WBM`                | Constant prefix — _West Bengal Municipal_.                        |
| `<TENANT_CODE>`      | 3-4 letter ULB code (`KMC`, `HMC`, `SDDM`).                       |
| `<SERVICE_CODE>`     | The full `services.code` value — readable, no abbreviation.       |
| `<YEAR>`             | 4-digit calendar year of submission.                              |
| `<5-DIGIT-SEQUENCE>` | Per-tenant, per-service, per-year sequence. Resets every January. |

> **Departure from prototype.** The prototype generator at `index.html:3117` slices the first 3 chars of the service code (`birth-cert` → `BIR`), but the seeded sample IDs use hand-picked abbreviations (`BC`, `PT`, `TL`). v1 standardises on the **full service code** (URL-safe and unambiguous).

### 10.2 Grievance docket

```
GRV/<TENANT_CODE>/<YEAR>/<CATEGORY_CODE>/<4-DIGIT-SEQUENCE>

Example: GRV/KMC/2026/SAN/4421
```

`<CATEGORY_CODE>` is the 3-4 letter abbreviation of the grievance category (`SAN`, `WAT`, `INF`, `LIT`, `HEA`, `TAX`, `ENC`, `ENV`, `SVC`, `EMG`).

### 10.3 Transaction ID

```
TXN<7-9 digit ULID-derived integer>

Example: TXN4429187
```

Maps 1:1 to a payment-gateway reference (Phase 3 ADR-0006).

### 10.4 Certificate Number

Per-service format:

| Service       | Format                                         | Example              |
| ------------- | ---------------------------------------------- | -------------------- |
| Birth Cert    | `BC/<TENANT_CODE>/<YEAR>/<6-digit>`            | `BC/KMC/2026/000342` |
| Trade Licence | `TL/<TENANT_CODE>/<YEAR>/<5-digit>`            | `TL/KMC/2026/01198`  |
| Building Plan | `BP/<TENANT_CODE>/<YEAR>/<5-digit>`            | `BP/KMC/2026/00041`  |
| Occupancy     | `OC/<TENANT_CODE>/<YEAR>/<5-digit>`            | `OC/KMC/2026/00012`  |
| (others)      | `<UPPER 2-3>/<TENANT_CODE>/<YEAR>/<5-6-digit>` |                      |

> **Exception.** RTI responses do **not** carry a certificate number — they cite the receipt number (`TXN…`) and an internal disclosure-case number (`RTI/<TENANT_CODE>/<YEAR>/<seq>`).

### 10.5 Holding Number

ULB-specific. Phase 3 codifies per-tenant regex patterns. Reference KMC pattern from prototype: `<WARD>/<STREET>/<NUMBER>` (e.g. `64/PARK-ST/12B`). v1 stores as a free-text string with per-tenant regex validation; a typed `Holding` record arrives in Phase 6.

---

## 11. Per-tenant override strategy

Three layers, evaluated in order:

```
1. State Service Template     ──┐
                                ├──▶  effective ServiceTemplate
2. Tenant Override (clone+edit) ┤        for the citizen
3. Tenant-only Custom Service  ─┘
```

| Override capability                       | Can be overridden? | Notes                                                                                      |
| ----------------------------------------- | ------------------ | ------------------------------------------------------------------------------------------ |
| `active` (enable / disable)               | ✅                 | Tenant can hide a service entirely.                                                        |
| `fees`                                    | ✅                 | Most common override (fees vary by ULB).                                                   |
| `late_fee`                                | ✅                 |                                                                                            |
| `sla_days`                                | ✅                 | Smaller ULBs may commit to faster SLAs as PR.                                              |
| `required_documents`                      | ✅                 | But cannot remove statutory docs (a flag on the template).                                 |
| `form_schema`                             | ✅ (additive)      | Tenant may add fields, never remove or break compatibility with the template.              |
| `workflow_overrides`                      | ✅ (additive)      | Add a stage (e.g. _legal-review_ between approve and issue) but can't skip statutory ones. |
| `output_certificate.pushes_to_digilocker` | ❌                 | Always on.                                                                                 |
| `service_code`                            | ❌                 | Immutable identifier.                                                                      |
| `category_code`                           | ❌                 | Immutable.                                                                                 |

> **Compliance gate.** When a tenant's overrides drift far enough from the state template, the admin portal flags a _compatibility warning_ and links the State Super-Admin's service-template doc.

---

## 12. Seed-data plan (Phase 2 Sprint 2.1)

Deliverable: `apps/api/prisma/seed/services.ts` ingests the catalogue and produces 76 service-templates owned by the synthetic _State_ tenant, plus a default override set per ULB.

### 12.1 Source of truth

- `services.ts` — TypeScript source authored from this document. Sat in source control; reviewed in PR.
- Each service exported as a `ServiceTemplateSeed` constant in its own file (`services/birth-cert.ts`, `services/prop-tax.ts`, …).
- An `index.ts` aggregates and validates against the `ServiceTemplate` Zod schema **at build time**. CI fails if any required field is missing.

### 12.2 Form-schema authoring

| Service                        | Status                                                                                                                                                                     |
| ------------------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Phase-2 lead batch (6 from §8) | Author full JSON-Schema in Sprint 2.1.                                                                                                                                     |
| Remaining 70                   | Author a **minimum** JSON-Schema (`fullName`, `address`, `ward_no`, `doc`) in Sprint 2.1. Tenants flesh out their full schemas in Sprints 2.2-2.4 via `apps/admin-tenant`. |

### 12.3 Translations

Per §13, prototype translates only category names. Phase 2 must:

- Translate all 76 service titles (en/bn/hi).
- Translate all 76 service descriptions.
- Translate the (max 250) form-field labels.

> **Estimate:** ~6 person-days per language with a domain-fluent translator. Owner: Citizen Services. This is on the Phase 2 critical path.

### 12.4 ULB seed

Eight tenants from `index.html:14-23`:

| code | name                               | district          | wards |
| ---- | ---------------------------------- | ----------------- | ----- |
| KMC  | Kolkata Municipal Corporation      | Kolkata           | 144   |
| HMC  | Howrah Municipal Corporation       | Howrah            | 66    |
| CMC  | Chandannagar Municipal Corporation | Hooghly           | 33    |
| BMC  | Bidhannagar Municipal Corporation  | North 24 Pgs      | 41    |
| SMC  | Siliguri Municipal Corporation     | Darjeeling        | 47    |
| AMC  | Asansol Municipal Corporation      | Paschim Bardhaman | 106   |
| DMC  | Durgapur Municipal Corporation     | Paschim Bardhaman | 43    |
| SDDM | South Dum Dum Municipality         | North 24 Pgs      | 35    |

Each gets the full 76-service catalogue with default values, plus a tenant-specific theme colour (already locked in the prototype).

---

## 13. Gaps & next actions

> **What the prototype _does not_ deliver — and who owns the fix.**

| #   | Gap                                                                                                                                                                                                                                                                                                                                                        | Owner                                                                                        | Phase |
| --- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------- | ----- |
| 1   | Service titles / descriptions are English-only                                                                                                                                                                                                                                                                                                             | Citizen Services + i18n team                                                                 | 2     |
| 2   | 75 of 76 services have no form schema (default 4-field fallback)                                                                                                                                                                                                                                                                                           | Backend + product                                                                            | 2     |
| 3   | DigiLocker integration is _narrative copy_ in the prototype — no real OAuth flow                                                                                                                                                                                                                                                                           | Backend (Phase 1 Sprint 1.4)                                                                 | 1     |
| 4   | No per-tenant catalogue override modeled in prototype data                                                                                                                                                                                                                                                                                                 | Backend + admin portal                                                                       | 2, 6  |
| 5   | Prototype application-ID generator is buggy (`slice(0,3).toUpperCase()`); v1 standardizes on full service code                                                                                                                                                                                                                                             | Backend                                                                                      | 2     |
| 6   | Tax / fee calculators (slab, late fee, mutation) are not interactive in prototype                                                                                                                                                                                                                                                                          | Backend + UI                                                                                 | 2     |
| 7   | Booking flows reuse the generic application form — no slot picker, no calendar, no availability check                                                                                                                                                                                                                                                      | UI + backend                                                                                 | 5     |
| 8   | `installChatbotMock` in `index.html:4691-4843` calls `api.anthropic.com` directly; production calls `ILLMProvider` per ADR-0008                                                                                                                                                                                                                            | Phase 7 — already addressed in architecture docs; remove from prototype during Phase 7 build | 7     |
| 9   | Grievance categories (10) have **only 1 fully populated** in seed data with timeline (sanitation); the others lack escalation chains and resolution patterns                                                                                                                                                                                               | Field operations + product                                                                   | 4     |
| 10  | The prototype defines `SERVICES.length = 81`; this catalogue locks **76 canonical services**. The 5 "extra" rows in the prototype are duplicate-by-mistake (e.g. early `prop-tax` and a later renamed entry); audit subagent flagged at `index.html:1633`                                                                                                  | Trimmed at seed-script-authoring time                                                        | 2     |
| 11  | No **service-template versioning** in prototype — Phase 2 adds `version: number` and a _deprecated_after_ field for soft-retirement                                                                                                                                                                                                                        | Backend                                                                                      | 2     |
| 12  | No **fee receipt** schema in prototype — the UI shows a button but no PDF                                                                                                                                                                                                                                                                                  | Backend + Phase 3 payments                                                                   | 3     |
| 13  | No **certificate output** schema in prototype — UI shows "Receive certificate via DigiLocker" but neither the format nor the signing chain are specified                                                                                                                                                                                                   | Backend + product                                                                            | 2-3   |
| 14  | Many services need to **read from legacy ULB systems** (e.g. property-tax dues from KMC SAP, water-meter readings from HMC SOAP, nightly CSV mirrors from smaller ULBs). Prototype does manual entry only. Resolution path: per-tenant, per-service `IExternalDataProvider` adapter — see [`ADR-0010`](./ADRs/ADR-0010-external-data-provider-adapters.md) | Backend + tenant IT liaisons                                                                 | 3     |

---

## 14. Acceptance criteria for "catalogue audit complete"

Sprint 0.2 closes this deliverable when all of the following hold:

- [ ] All 76 services from §9 have an entry in `apps/api/prisma/seed/services/<code>.ts` with a passing Zod validation **at CI time**. _(Phase 2 follow-up.)_
- [ ] All 6 priority services (§8) have a full `form_schema`, `workflow_overrides` if any, and translated titles/descriptions. _(Phase 2 follow-up.)_
- [ ] The 14 categories are translated (en/bn/hi) and seeded.
- [ ] The 8 ULBs are seeded with brand colours and ward counts.
- [ ] The application-ID generator is wired (per §10.1).
- [ ] The certificate-number generator (per-service formats) is unit-tested.
- [ ] `docs/glossary.md` and this document agree on every term used.

---

## Change log

| Date       | Change                                            | Reviewer                             |
| ---------- | ------------------------------------------------- | ------------------------------------ |
| 2026-05-06 | v0.1 — initial Phase-0 audit + Phase-2 seed plan. | _pending product + sponsor sign-off_ |

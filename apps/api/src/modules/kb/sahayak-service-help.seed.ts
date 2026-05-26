/**
 * Generates published KB articles (en / bn / hi) for every effective tenant service.
 * Used by Prisma seed and Phase 7 Sahayak RAG indexing.
 */
import {
  resolveEffectiveServices,
  type EffectiveServiceSummary,
  type LocaleMap,
} from '../services/service-catalogue.seed';
import { CITIZEN_PORTAL_TENANT_CODE, tenantSeeds } from '../tenants/tenant.seed';

import type { Prisma, PrismaClient } from '../../generated/prisma';

export type SahayakKbArticleSeed = {
  tenant_code: string;
  slug: string;
  title: LocaleMap;
  body: LocaleMap;
  tags: string[];
  status: 'published' | 'draft' | 'archived';
};

const DOCUMENT_LABELS: Record<string, LocaleMap> = {
  'hospital-discharge': label(
    'Hospital discharge certificate',
    'হাসপাতালের ছাড়পত্র',
    'अस्पताल डिस्चार्ज प्रमाणपत्र',
  ),
  'parent-aadhaar': label('Parent Aadhaar', 'অভিভাবকের আধার', 'अभिभावक आधार'),
  'address-proof': label('Address proof', 'ঠিকানার প্রমাণ', 'पता प्रमाण'),
  aadhaar: label('Aadhaar', 'আধার', 'आधार'),
  'premises-proof': label('Premises proof', 'প্রাঙ্গণের প্রমাণ', 'परिसर प्रमाण'),
  'passport-photo': label('Passport-size photo', 'পাসপোর্ট সাইজ ছবি', 'पासपोर्ट साइज फोटो'),
  'fssai-certificate': label('FSSAI certificate', 'এফএসএসএআই সনদ', 'एफएसएसएआई प्रमाणपत्र'),
  photo: label('Photograph of the issue', 'সমস্যার ছবি', 'समस्या की फोटो'),
  'identity-proof': label('Identity proof', 'পরিচয় প্রমাণ', 'पहचान प्रमाण'),
  'event-details': label('Event details document', 'অনুষ্ঠানের বিবরণ', 'कार्यक्रम विवरण'),
  'vaccination-proof': label('Vaccination proof', 'টিকাকরণের প্রমাণ', 'टीकाकरण प्रमाण'),
  'owner-address-proof': label(
    'Owner address proof',
    'মালিকের ঠিকানার প্রমাণ',
    'मालिक का पता प्रमाण',
  ),
};

const WORKFLOW_STEPS: Record<
  EffectiveServiceSummary['workflow_pattern'],
  { en: string[]; bn: string[]; hi: string[] }
> = {
  'cert-issuance': {
    en: [
      'Log in to the citizen portal and select your municipality.',
      'Open **Services** and choose this service.',
      'Complete the online form and upload required documents.',
      'Pay the applicable fee (if any) through the portal.',
      'Track status under **My applications** until the certificate is issued.',
      'Download from the portal or collect per municipality notice.',
    ],
    bn: [
      'নাগরিক পোর্টালে লগইন করে আপনার পৌরসভা/পুরসভা নির্বাচন করুন।',
      '**সেবা** খুলে এই সেবাটি বেছে নিন।',
      'অনলাইন ফর্ম পূরণ করুন এবং প্রয়োজনীয় নথি আপলোড করুন।',
      'প্রযোজ্য ফি (থাকলে) পোর্টালে পরিশোধ করুন।',
      '**আমার আবেদন** থেকে স্ট্যাটাস ট্র্যাক করুন যতক্ষণ সনদ প্রদান না হয়।',
      'পোর্টাল থেকে ডাউনলোড করুন বা পৌরসভার নোটিশ অনুযায়ী সংগ্রহ করুন।',
    ],
    hi: [
      'नागरिक पोर्टल में लॉगिन करके अपना नगर निकाय चुनें।',
      '**सेवाएं** खोलकर यह सेवा चुनें।',
      'ऑनलाइन फॉर्म भरें और आवश्यक दस्तावेज अपलोड करें।',
      'लागू शुल्क (यदि कोई हो) पोर्टल पर भुगतान करें।',
      '**मेरे आवेदन** में स्थिति ट्रैक करें जब तक प्रमाणपत्र जारी न हो।',
      'पोर्टल से डाउनलोड करें या नगर निकाय सूचना के अनुसार प्राप्त करें।',
    ],
  },
  'tax-payment': {
    en: [
      'Select your municipality on the citizen portal.',
      'Open this service and enter your **holding number**.',
      'Review the assessed amount shown by the system.',
      'Pay online and save the payment receipt.',
    ],
    bn: [
      'নাগরিক পোর্টালে পৌরসভা নির্বাচন করুন।',
      'এই সেবা খুলে **হোল্ডিং নম্বর** লিখুন।',
      'সিস্টেমে দেখানো নির্ধারিত পরিমাণ যাচাই করুন।',
      'অনলাইনে পরিশোধ করুন এবং রসিদ সংরক্ষণ করুন।',
    ],
    hi: [
      'नागरिक पोर्टल पर नगर निकाय चुनें।',
      'यह सेवा खोलकर **होल्डिंग नंबर** दर्ज करें।',
      'सिस्टम द्वारा दिखाई गई राशि की समीक्षा करें।',
      'ऑनलाइन भुगतान करें और रसीद सहेजें।',
    ],
  },
  booking: {
    en: [
      'Choose your municipality and open this booking service.',
      'Select the venue/date and provide event details.',
      'Pay booking fee and deposit (if applicable).',
      'Receive confirmation; contact the ward office for handover rules.',
    ],
    bn: [
      'পৌরসভা নির্বাচন করে বুকিং সেবা খুলুন।',
      'ভেন্যু/তারিখ ও অনুষ্ঠানের বিবরণ দিন।',
      'বুকিং ফি ও জমা (প্রযোজ্য হলে) পরিশোধ করুন।',
      'নিশ্চিতকরণ পান; হস্তান্তর নিয়মের জন্য ওয়ার্ড অফিসে যোগাযোগ করুন।',
    ],
    hi: [
      'नगर निकाय चुनकर बुकिंग सेवा खोलें।',
      'स्थान/तिथि और कार्यक्रम विवरण दें।',
      'बुकिंग शुल्क और जमा (यदि लागू) का भुगतान करें।',
      'पुष्टि प्राप्त करें; नियमों के लिए वार्ड कार्यालय से संपर्क करें।',
    ],
  },
  instant: {
    en: [
      'Log in, select municipality, and open this service.',
      'Submit the form with required details and attachments.',
      'Note your reference number for follow-up.',
    ],
    bn: [
      'লগইন করে পৌরসভা নির্বাচন করুন ও সেবা খুলুন।',
      'প্রয়োজনীয় তথ্য ও সংযুক্তি সহ ফর্ম জমা দিন।',
      'ফলো-আপের জন্য রেফারেন্স নম্বর নোট করুন।',
    ],
    hi: [
      'लॉगिन करके नगर निकाय चुनें और सेवा खोलें।',
      'आवश्यक विवरण और संलग्नक के साथ फॉर्म जमा करें।',
      'फॉलो-अप के लिए संदर्भ संख्या नोट करें।',
    ],
  },
  noc: {
    en: ['Apply online with site/plan details.', 'Pay fee.', 'Track NOC status.'],
    bn: ['অনলাইনে আবেদন করুন।', 'ফি পরিশোধ করুন।', 'এনওসি স্ট্যাটাস ট্র্যাক করুন।'],
    hi: ['ऑनलाइन आवेदन करें।', 'शुल्क भुगतान करें।', 'एनओसी स्थिति ट्रैक करें।'],
  },
  pension: {
    en: ['Check eligibility.', 'Submit application with proofs.', 'Track disbursement status.'],
    bn: ['যোগ্যতা যাচাই করুন।', 'প্রমাণসহ আবেদন জমা দিন।', 'ভাতার স্ট্যাটাস দেখুন।'],
    hi: ['पात्रता जांचें।', 'प्रमाण के साथ आवेदन जमा करें।', 'भुगतान स्थिति देखें।'],
  },
  fine: {
    en: ['View challan details.', 'Pay online.', 'Download receipt.'],
    bn: ['চালানের বিবরণ দেখুন।', 'অনলাইনে পরিশোধ করুন।', 'রসিদ ডাউনলোড করুন।'],
    hi: ['चालान विवरण देखें।', 'ऑनलाइन भुगतान करें।', 'रसीद डाउनलोड करें।'],
  },
};

export function buildSahayakServiceHelpArticles(tenantCode: string): SahayakKbArticleSeed[] {
  const tenant = tenantSeeds.find((row) => row.code === tenantCode);
  if (!tenant || tenantCode === CITIZEN_PORTAL_TENANT_CODE) {
    return [];
  }

  const services = resolveEffectiveServices(tenantCode).sort((a, b) =>
    a.code.localeCompare(b.code),
  );
  const articles: SahayakKbArticleSeed[] = [
    buildTenantIndexArticle(tenant.code, tenant.name, tenant.district, tenant.ward_count, services),
    buildGrievanceHelpArticle(tenant.code, tenant.name),
  ];

  for (const service of services) {
    articles.push(buildServiceHelpArticle(tenant, service));
  }

  return articles;
}

export function buildAllSahayakServiceHelpArticles(): SahayakKbArticleSeed[] {
  return tenantSeeds
    .filter((tenant) => tenant.code !== CITIZEN_PORTAL_TENANT_CODE && tenant.is_active)
    .flatMap((tenant) => buildSahayakServiceHelpArticles(tenant.code));
}

function buildTenantIndexArticle(
  tenantCode: string,
  tenantName: string,
  district: string,
  wardCount: number,
  services: EffectiveServiceSummary[],
): SahayakKbArticleSeed {
  const active = services.filter((service) => service.active);
  const inactive = services.filter((service) => !service.active);
  const serviceListEn = active
    .map((service) => `- **${service.name.en}** (\`${service.code}\`)`)
    .join('\n');
  const serviceListBn = active
    .map((service) => `- **${service.name.bn}** (\`${service.code}\`)`)
    .join('\n');
  const serviceListHi = active
    .map((service) => `- **${service.name.hi}** (\`${service.code}\`)`)
    .join('\n');
  const inactiveNoteEn =
    inactive.length > 0
      ? `\n\n### Not currently offered\n${inactive.map((s) => `- ${s.name.en} (\`${s.code}\`)`).join('\n')}`
      : '';
  const inactiveNoteBn =
    inactive.length > 0
      ? `\n\n### বর্তমানে উপলব্ধ নয়\n${inactive.map((s) => `- ${s.name.bn}`).join('\n')}`
      : '';
  const inactiveNoteHi =
    inactive.length > 0
      ? `\n\n### वर्तमान में उपलब्ध नहीं\n${inactive.map((s) => `- ${s.name.hi}`).join('\n')}`
      : '';

  return {
    tenant_code: tenantCode,
    slug: 'help-services',
    title: label(
      `${tenantName} — online services guide`,
      `${tenantName} — অনলাইন সেবা নির্দেশিকা`,
      `${tenantName} — ऑनलाइन सेवा मार्गदर्शिका`,
    ),
    body: label(
      `# ${tenantName} citizen services\n\n**Municipality code:** \`${tenantCode}\` · **District:** ${district} · **Wards:** ${wardCount}\n\nUse the eNagarSeba citizen portal to apply, pay, book, or report issues for **${tenantName}**. Sahayak AI answers using the per-service help articles below.\n\n## Services available online\n${serviceListEn}${inactiveNoteEn}\n\n## How to start\n1. Open the citizen portal and sign in with OTP.\n2. Pin or select **${tenantCode}** as your municipality.\n3. Pick a service from the hub or ask Sahayak in English, Bengali, or Hindi.\n4. For grievances (roads, sanitation, etc.), use **Grievance** — see article \`help-grievances\`.\n\n## Service help articles\nEach service has a dedicated article: slug \`help-services-<service-code>\` (example: \`help-services-birth-cert\`).`,
      `# ${tenantName} নাগরিক সেবা\n\n**পৌরসভা কোড:** \`${tenantCode}\` · **জেলা:** ${district} · **ওয়ার্ড:** ${wardCount}\n\n**${tenantName}**-এর জন্য eNagarSeba পোর্টালে আবেদন, পরিশোধ, বুকিং বা অভিযোগ করুন। সাহায়ক AI নিচের প্রতিটি সেবা নিবন্ধ ব্যবহার করে উত্তর দেয়।\n\n## অনলাইন সেবা\n${serviceListBn}${inactiveNoteBn}\n\n## শুরু করার ধাপ\n1. নাগরিক পোর্টালে OTP দিয়ে প্রবেশ করুন।\n2. **${tenantCode}** পৌরসভা নির্বাচন/পিন করুন।\n3. হাব থেকে সেবা বেছে নিন বা সাহায়ককে বাংলা/ইংরেজি/হিন্দিতে জিজ্ঞাসা করুন।\n4. অভিযোগের জন্য **অভিযোগ** মডিউল — \`help-grievances\` নিবন্ধ দেখুন।`,
      `# ${tenantName} नागरिक सेवाएं\n\n**निकाय कोड:** \`${tenantCode}\` · **जिला:** ${district} · **वार्ड:** ${wardCount}\n\n**${tenantName}** के लिए eNagarSeba पोर्टल पर आवेदन, भुगतान, बुकिंग या शिकायत करें। सहायक AI नीचे दिए प्रत्येक सेवा लेख का उपयोग करता है।\n\n## ऑनलाइन सेवाएं\n${serviceListHi}${inactiveNoteHi}\n\n## शुरुआत\n1. OTP से नागरिक पोर्टल में प्रवेश करें।\n2. **${tenantCode}** नगर निकाय चुनें।\n3. हब से सेवा चुनें या सहायक से पूछें।\n4. शिकायत के लिए \`help-grievances\` लेख देखें।`,
    ),
    tags: ['sahayak', 'service-help', 'index', tenantCode.toLowerCase()],
    status: 'published',
  };
}

function buildGrievanceHelpArticle(tenantCode: string, tenantName: string): SahayakKbArticleSeed {
  return {
    tenant_code: tenantCode,
    slug: 'help-grievances',
    title: label('Report a civic grievance', 'নাগরিক অভিযোগ জানান', 'नागरिक शिकायत दर्ज करें'),
    body: label(
      `# Grievances at ${tenantName}\n\nReport roads, streetlights, drainage, sanitation, stray animals, parks, or trade-related issues.\n\n## Steps\n1. Open **Grievance** on the citizen portal (municipality **${tenantCode}**).\n2. Choose category and sub-type (if shown).\n3. Describe the issue and attach a photo.\n4. Submit and save your grievance number (example format: \`GRV-${tenantCode}-YYYY-NNNNNN\`).\n5. Track status on the grievance detail screen.\n\n## SLA\nResolution targets depend on category and priority; urgent issues are routed first.\n\n## Not a substitute for\nBirth certificates, tax payment, trade licence, hall booking, or RTI — use the matching **service** help article instead.`,
      `# ${tenantName}-তে অভিযোগ\n\nরাস্তা, স্ট্রিটলাইট, নর্দমা, স্যানিটেশন, কুকুর বা উদ্যান সংক্রান্ত সমস্যা জানান।\n\n## ধাপ\n1. পোর্টালে **অভিযোগ** খুলুন (**${tenantCode}**).\n2. বিভাগ ও উপ-ধরন বেছে নিন।\n3. বিবরণ ও ছবি দিন।\n4. অভিযোগ নম্বর সংরক্ষণ করুন।\n5. স্ট্যাটাস ট্র্যাক করুন।`,
      `# ${tenantName} में शिकायत\n\nसड़क, स्ट्रीटलाइट, नाली, स्वच्छता, कुत्ते या पार्क की समस्या दर्ज करें।\n\n## चरण\n1. पोर्टल पर **शिकायत** खोलें (**${tenantCode}**).\n2. श्रेणी चुनें।\n3. विवरण और फोटो संलग्न करें।\n4. शिकायत संख्या सहेजें।\n5. स्थिति ट्रैक करें।`,
    ),
    tags: ['sahayak', 'grievance', tenantCode.toLowerCase()],
    status: 'published',
  };
}

function buildServiceHelpArticle(
  tenant: { code: string; name: string; district: string; ward_count: number },
  service: EffectiveServiceSummary,
): SahayakKbArticleSeed {
  const fee = formatFeeSummary(service);
  const sla = formatSlaSummary(service);
  const documents = formatDocumentsList(service);
  const steps = WORKFLOW_STEPS[service.workflow_pattern];
  const availability = service.active
    ? ''
    : localeBlock(
        '## Availability\n\n**This service is not currently active** for this municipality. Contact the ward office or citizen helpline for alternatives.',
        '## উপলব্ধতা\n\n**এই সেবা বর্তমানে সক্রিয় নয়।** ওয়ার্ড অফিসে যোগাযোগ করুন।',
        '## उपलब्धता\n\n**यह सेवा वर्तमान में सक्रिय नहीं है।** वार्ड कार्यालय से संपर्क करें।',
      );
  const digilocker = service.pushes_to_digilocker
    ? localeBlock(
        'Eligible outputs may be pushed to **DigiLocker** when issued.',
        'প্রদানের পর **ডিজি লকার**-এ পাঠানো যেতে পারে।',
        'जारी होने पर **DigiLocker** में उपलब्ध हो सकता है।',
      )
    : '';

  const tenantNotes = buildTenantSpecificNotes(tenant.code, service);

  return {
    tenant_code: tenant.code,
    slug: `help-services-${service.code}`,
    title: label(
      `${service.name.en} — ${tenant.name}`,
      `${service.name.bn} — ${tenant.name}`,
      `${service.name.hi} — ${tenant.name}`,
    ),
    body: label(
      buildServiceBodyEn(
        tenant,
        service,
        fee.en,
        sla.en,
        documents.en,
        steps.en,
        availability,
        digilocker,
        tenantNotes.en,
      ),
      buildServiceBodyBn(
        tenant,
        service,
        fee.bn,
        sla.bn,
        documents.bn,
        steps.bn,
        availability,
        digilocker,
        tenantNotes.bn,
      ),
      buildServiceBodyHi(
        tenant,
        service,
        fee.hi,
        sla.hi,
        documents.hi,
        steps.hi,
        availability,
        digilocker,
        tenantNotes.hi,
      ),
    ),
    tags: [
      'sahayak',
      'service-help',
      service.code,
      service.category_code,
      tenant.code.toLowerCase(),
      service.active ? 'active' : 'inactive',
    ],
    status: 'published',
  };
}

function buildServiceBodyEn(
  tenant: { code: string; name: string; district: string },
  service: EffectiveServiceSummary,
  fee: string,
  sla: string,
  documents: string,
  steps: string[],
  availability: string,
  digilocker: string,
  tenantNotes: string,
): string {
  return `# ${service.name.en} at ${tenant.name}

**Service code:** \`${service.code}\` · **Category:** \`${service.category_code}\` · **Municipality:** \`${tenant.code}\` (${tenant.district})

${service.description.en}

${availability}

## Who can use this service
Citizens and authorised applicants filing for properties or events within **${tenant.name}** municipal limits.

## Fees
${fee}

## Documents usually required
${documents}

## Processing time
${sla}

## How to apply (step by step)
${steps.map((step, index) => `${index + 1}. ${step}`).join('\n')}

## Track your submission
Open **My applications** (or **Grievance** for instant grievance-type services) and search by docket / reference number.

${digilocker}

${tenantNotes}

## Sahayak AI hints
- Always cite this article slug: \`help-services-${service.code}\`.
- Do not invent fees or timelines — use the **Fees** and **Processing time** sections above.
- If the citizen has an in-flight application, prefer status from **My applications** over generic guidance.`;
}

function buildServiceBodyBn(
  tenant: { code: string; name: string },
  service: EffectiveServiceSummary,
  fee: string,
  sla: string,
  documents: string,
  steps: string[],
  availability: string,
  digilocker: string,
  tenantNotes: string,
): string {
  return `# ${tenant.name}-তে ${service.name.bn}

**সেবা কোড:** \`${service.code}\` · **পৌরসভা:** \`${tenant.code}\`

${service.description.bn}

${availability}

## ফি
${fee}

## প্রয়োজনীয় নথি
${documents}

## প্রক্রিয়াকরণ সময়
${sla}

## আবেদনের ধাপ
${steps.map((step, index) => `${index + 1}. ${step}`).join('\n')}

${digilocker}

${tenantNotes}

**সাহায়ক:** এই নিবন্ধ \`help-services-${service.code}\` থেকে উত্তর দিন; ফি/সময়সীমা উদ্ভাবন করবেন না।`;
}

function buildServiceBodyHi(
  tenant: { code: string; name: string },
  service: EffectiveServiceSummary,
  fee: string,
  sla: string,
  documents: string,
  steps: string[],
  availability: string,
  digilocker: string,
  tenantNotes: string,
): string {
  return `# ${tenant.name} में ${service.name.hi}

**सेवा कोड:** \`${service.code}\` · **निकाय:** \`${tenant.code}\`

${service.description.hi}

${availability}

## शुल्क
${fee}

## आवश्यक दस्तावेज
${documents}

## समय सीमा
${sla}

## आवेदन के चरण
${steps.map((step, index) => `${index + 1}. ${step}`).join('\n')}

${digilocker}

${tenantNotes}

**सहायक:** उत्तर \`help-services-${service.code}\` से दें; शुल्क/समय का अनुमान न लगाएं।`;
}

function buildTenantSpecificNotes(tenantCode: string, service: EffectiveServiceSummary): LocaleMap {
  if (tenantCode === 'KMC' && service.code === 'birth-cert') {
    return label(
      '### Kolkata (KMC) notes\n- Standard fee ₹50; urgent processing ₹150 when offered.\n- Additional borough health review stage may apply.\n- Typical SLA **5 working days** (tenant override).',
      '### কলকাতা (KMC) নোট\n- সাধারণ ফি ₹৫০; জরুরি ₹১৫০ (উপলব্ধ হলে)।\n- বরো স্বাস্থ্য পর্যালোচনা পর্যায় থাকতে পারে।\n- সাধারণত **৫ কর্মদিবস**।',
      '### कोलकाता (KMC) नोट\n- मानक शुल्क ₹50; तत्काल ₹150।\n- बोरो स्वास्थ्य समीक्षा संभव।\n- **5 कार्यदिवस** SLA।',
    );
  }
  if (tenantCode === 'HMC' && service.code === 'community-hall' && !service.active) {
    return label(
      '### Howrah (HMC) notes\nCommunity hall online booking is **disabled** for Howrah in the reference catalogue. Contact HMC citizen services for manual booking.',
      '### হাওড়া (HMC)\nকমিউনিটি হল অনলাইন বুকিং **বন্ধ** — হাওড়া পৌরসভায় যোগাযোগ করুন।',
      '### हावड़ा (HMC)\nसामुदायिक भवन ऑनलाइन बुकिंग **अक्षम** — नगर निकाय से संपर्क करें।',
    );
  }
  if (tenantCode === 'KMC' && service.code === 'pet-licence') {
    return label(
      '### Kolkata-only service\nPet registration within KMC limits. Fee **₹200**; SLA **14 days**. Vaccination and address proofs required.',
      '### কলকাতা-নির্দিষ্ট\nপোষ্য নিবন্ধন। ফি **₹২০০**; **১৪ দিন**।',
      '### केवल कोलकाता\nपालतू पंजीकरण। शुल्क **₹200**; **14 दिन**।',
    );
  }
  return label('', '', '');
}

function formatFeeSummary(service: EffectiveServiceSummary): LocaleMap {
  const config = service.fee_config;
  if (
    service.fee_type === 'free' ||
    (config.amount_paise === 0 && service.fee_type !== 'computed')
  ) {
    return label('No fee (₹0).', 'কোনো ফি নেই (₹০)।', 'कोई शुल्क नहीं (₹0)।');
  }
  if (service.fee_type === 'fixed') {
    const amount = paiseToRupee(config.amount_paise);
    const deposit =
      typeof config.deposit_paise === 'number'
        ? ` Deposit: **₹${paiseToRupee(config.deposit_paise)}**.`
        : '';
    const urgent =
      typeof config.urgent_amount_paise === 'number'
        ? ` Urgent lane: **₹${paiseToRupee(config.urgent_amount_paise)}**.`
        : '';
    const bpl =
      typeof config.bpl_amount_paise === 'number'
        ? ` BPL applicants: **₹${paiseToRupee(config.bpl_amount_paise)}**.`
        : '';
    return label(
      `Fixed fee: **₹${amount}**.${deposit}${urgent}${bpl}`,
      `নির্ধারিত ফি: **₹${amount}**।${deposit}${urgent}${bpl}`,
      `निश्चित शुल्क: **₹${amount}**।${deposit}${urgent}${bpl}`,
    );
  }
  if (service.fee_type === 'slab') {
    const slab = String(config.slab_set ?? 'tenant slab table');
    return label(
      `Fee by slab (**${slab}**). Exact amount shown at payment step.`,
      `স্ল্যাব অনুযায়ী ফি (**${slab}**) — পরিশোধের সময় দেখাবে।`,
      `स्लैब के अनुसार शुल्क (**${slab}**) — भुगतान पर दिखेगा।`,
    );
  }
  if (service.fee_type === 'computed') {
    const calc = String(config.calculator ?? 'municipal calculator');
    return label(
      `Computed from **${calc}** (holding assessment / system rules). Amount shown before payment.`,
      `**${calc}** থেকে গণনা — পরিশোধের আগে দেখাবে।`,
      `**${calc}** से गणना — भुगतान से पहले दिखेगा।`,
    );
  }
  return label('See payment step on portal.', 'পোর্টালে ফি দেখুন।', 'पोर्टल पर शुल्क देखें।');
}

function formatSlaSummary(service: EffectiveServiceSummary): LocaleMap {
  if (service.sla_days == null) {
    return label(
      'Instant / same-session (payment or submission acknowledgement).',
      'তাৎক্ষণিক / একই সেশনে নিশ্চিতকরণ।',
      'तत्काल / उसी सत्र में पुष्टि।',
    );
  }
  return label(
    `Target: **${service.sla_days} working days** from complete submission (excluding citizen rework).`,
    `লক্ষ্য: সম্পূর্ণ জমার পর **${service.sla_days} কর্মদিবস** (নাগরিকের সংশোধন বাদে)।`,
    `लक्ष्य: पूर्ण जमा के बाद **${service.sla_days} कार्यदिवस**।`,
  );
}

function formatDocumentsList(service: EffectiveServiceSummary): LocaleMap {
  if (service.required_documents.length === 0) {
    return label(
      'No mandatory uploads for this service (identity may still be required at login).',
      'বাধ্যতামূলক আপলোড নেই (লগইনে পরিচয় লাগতে পারে)।',
      'कोई अनिवार्य अपलोड नहीं (लॉगिन पर पहचान आवश्यक हो सकती है)।',
    );
  }
  const lines = service.required_documents.map((code) => {
    const labelMap = DOCUMENT_LABELS[code];
    return labelMap ? `- ${labelMap.en} (\`${code}\`)` : `- \`${code}\``;
  });
  const linesBn = service.required_documents.map((code) => {
    const labelMap = DOCUMENT_LABELS[code];
    return labelMap ? `- ${labelMap.bn}` : `- \`${code}\``;
  });
  const linesHi = service.required_documents.map((code) => {
    const labelMap = DOCUMENT_LABELS[code];
    return labelMap ? `- ${labelMap.hi}` : `- \`${code}\``;
  });
  return label(lines.join('\n'), linesBn.join('\n'), linesHi.join('\n'));
}

function paiseToRupee(paise: unknown): string {
  const value = typeof paise === 'number' ? paise : Number(paise);
  if (!Number.isFinite(value)) {
    return '0';
  }
  return (value / 100).toLocaleString('en-IN');
}

function localeBlock(en: string, bn: string, hi: string): string {
  return [en, bn, hi].filter(Boolean).join('\n\n');
}

function label(en: string, bn: string, hi: string): LocaleMap {
  return { en, bn, hi };
}

/** Upsert all Sahayak service-help KB articles for operational ULBs. */
export async function seedSahayakServiceHelpArticles(prisma: PrismaClient): Promise<number> {
  const articles = buildAllSahayakServiceHelpArticles();
  const tenants = await prisma.tenant.findMany({
    where: { code: { not: CITIZEN_PORTAL_TENANT_CODE }, isActive: true },
    select: { id: true, code: true },
  });
  const tenantByCode = new Map(tenants.map((tenant) => [tenant.code, tenant.id]));
  let count = 0;

  for (const seed of articles) {
    const tenantId = tenantByCode.get(seed.tenant_code);
    if (!tenantId) {
      continue;
    }
    const publishedAt = seed.status === 'published' ? new Date() : null;
    const row = await prisma.kbArticle.upsert({
      where: { tenantId_slug: { tenantId, slug: seed.slug } },
      create: {
        tenantId,
        slug: seed.slug,
        title: seed.title as Prisma.InputJsonValue,
        body: seed.body as Prisma.InputJsonValue,
        tags: seed.tags,
        status: seed.status,
        publishedAt,
      },
      update: {
        title: seed.title as Prisma.InputJsonValue,
        body: seed.body as Prisma.InputJsonValue,
        tags: seed.tags,
        status: seed.status,
        publishedAt,
      },
    });

    if (seed.status === 'published') {
      const openJob = await prisma.kbIndexJob.findFirst({
        where: {
          tenantId,
          articleId: row.id,
          status: { in: ['queued', 'processing'] },
        },
      });
      if (!openJob) {
        await prisma.kbIndexJob.create({
          data: {
            tenantId,
            articleId: row.id,
            status: 'queued',
            trigger: 'nightly_reconcile',
            requestedBy: 'seed:sahayak-service-help',
          },
        });
      }
    }
    count += 1;
  }

  return count;
}

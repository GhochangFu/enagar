import type {
  ChoiceFormField,
  DateFormField,
  EnagarFormSchema,
  FileFormField,
  LocaleMap,
  NumberFormField,
  SectionFormField,
  TextFormField,
} from './index.js';

export const birthCertificateSchema: EnagarFormSchema = {
  schema_version: 1,
  service_code: 'birth-cert',
  version: 1,
  title: label('Birth Certificate', 'জন্ম সনদ', 'जन्म प्रमाणपत्र'),
  description: label(
    'Register and issue a municipal birth certificate.',
    'পৌর জন্ম সনদ নিবন্ধন ও ইস্যু করুন।',
    'नगरपालिका जन्म प्रमाणपत्र पंजीकृत और जारी करें।',
  ),
  fields: [
    section('applicant-section', 'Applicant Details', 'আবেদনকারীর বিবরণ', 'आवेदक विवरण'),
    text('applicant_name', 'Applicant name', 'আবেদনকারীর নাম', 'आवेदक का नाम', {
      required: true,
      min_length: 2,
      max_length: 120,
    }),
    text('mobile', 'Mobile number', 'মোবাইল নম্বর', 'मोबाइल नंबर', {
      required: true,
      pattern: '^[6-9][0-9]{9}$',
    }),
    section('child-section', 'Child Details', 'শিশুর বিবরণ', 'बच्चे का विवरण'),
    text('child_name', 'Child name', 'শিশুর নাম', 'बच्चे का नाम', {
      required: true,
      min_length: 1,
      max_length: 120,
    }),
    date('date_of_birth', 'Date of birth', 'জন্ম তারিখ', 'जन्म तिथि', { required: true }),
    select(
      'relationship',
      'Relationship to child',
      'শিশুর সঙ্গে সম্পর্ক',
      'बच्चे से संबंध',
      [
        option('parent', 'Parent', 'অভিভাবক', 'अभिभावक'),
        option('guardian', 'Guardian', 'অভিভাবক প্রতিনিধি', 'संरक्षक'),
      ],
      { required: true },
    ),
    file(
      'hospital_discharge',
      'Hospital discharge proof',
      'হাসপাতালের ছাড়পত্র',
      'अस्पताल डिस्चार्ज प्रमाण',
      {
        required: true,
        accept: ['application/pdf', 'image/jpeg'],
        max_size_mb: 10,
      },
    ),
  ],
};

export const tradeLicenceSchema: EnagarFormSchema = {
  schema_version: 1,
  service_code: 'trade-licence',
  version: 1,
  title: label('Trade Licence', 'ট্রেড লাইসেন্স', 'व्यापार लाइसेंस'),
  fields: [
    text('applicant_name', 'Applicant name', 'আবেদনকারীর নাম', 'आवेदक का नाम', {
      required: true,
      min_length: 2,
      max_length: 120,
    }),
    text('business_name', 'Business name', 'ব্যবসার নাম', 'व्यवसाय का नाम', {
      required: true,
      min_length: 2,
      max_length: 160,
    }),
    select(
      'trade_type',
      'Trade type',
      'ব্যবসার ধরন',
      'व्यापार का प्रकार',
      [
        option('food', 'Food', 'খাদ্য', 'खाद्य'),
        option('retail', 'Retail', 'খুচরা', 'खुदरा'),
        option('industrial', 'Industrial', 'শিল্প', 'औद्योगिक'),
      ],
      { required: true },
    ),
    file('premises_proof', 'Premises proof', 'প্রাঙ্গণের প্রমাণ', 'परिसर प्रमाण', {
      required: true,
      accept: ['application/pdf', 'image/jpeg'],
      max_size_mb: 10,
    }),
    file('fssai_certificate', 'FSSAI certificate', 'এফএসএসএআই সনদ', 'एफएसएसएआई प्रमाणपत्र', {
      accept: ['application/pdf'],
      max_size_mb: 10,
      show_if: { field: 'trade_type', equals: 'food' },
    }),
  ],
};

export const propertyTaxSchema: EnagarFormSchema = {
  schema_version: 1,
  service_code: 'prop-tax',
  version: 1,
  title: label('Property Tax Payment', 'সম্পত্তি কর প্রদান', 'संपत्ति कर भुगतान'),
  fields: [
    text('holding_number', 'Holding number', 'হোল্ডিং নম্বর', 'होल्डिंग नंबर', {
      required: true,
      min_length: 3,
      max_length: 50,
    }),
    radio(
      'payer_type',
      'Payer type',
      'প্রদানকারীর ধরন',
      'भुगतानकर्ता प्रकार',
      [
        option('owner', 'Owner', 'মালিক', 'स्वामी'),
        option('tenant', 'Tenant', 'ভাড়াটে', 'किरायेदार'),
      ],
      { required: true },
    ),
  ],
};

export const communityHallSchema: EnagarFormSchema = {
  schema_version: 1,
  service_code: 'community-hall',
  version: 1,
  title: label('Community Hall Booking', 'কমিউনিটি হল বুকিং', 'सामुदायिक भवन बुकिंग'),
  fields: [
    text('applicant_name', 'Applicant name', 'আবেদনকারীর নাম', 'आवेदक का नाम', { required: true }),
    date('event_date', 'Event date', 'অনুষ্ঠানের তারিখ', 'कार्यक्रम तिथि', { required: true }),
    numberField('guest_count', 'Guest count', 'অতিথির সংখ্যা', 'अतिथि संख्या', {
      required: true,
      min: 1,
      max: 500,
    }),
    textarea('event_details', 'Event details', 'অনুষ্ঠানের বিবরণ', 'कार्यक्रम विवरण', {
      required: true,
      min_length: 10,
      max_length: 1000,
    }),
  ],
};

export const rtiSchema: EnagarFormSchema = {
  schema_version: 1,
  service_code: 'rti',
  version: 1,
  title: label('RTI Application', 'আরটিআই আবেদন', 'आरटीआई आवेदन'),
  fields: [
    text('applicant_name', 'Applicant name', 'আবেদনকারীর নাম', 'आवेदक का नाम', { required: true }),
    textarea('information_requested', 'Information requested', 'চাওয়া তথ্য', 'मांगी गई सूचना', {
      required: true,
      min_length: 20,
      max_length: 2000,
    }),
    radio(
      'bpl_applicant',
      'BPL applicant?',
      'বিপিএল আবেদনকারী?',
      'बीपीएल आवेदक?',
      [option('yes', 'Yes', 'হ্যাঁ', 'हाँ'), option('no', 'No', 'না', 'नहीं')],
      { required: true },
    ),
    file('bpl_card', 'BPL card', 'বিপিএল কার্ড', 'बीपीएल कार्ड', {
      accept: ['application/pdf', 'image/jpeg'],
      max_size_mb: 10,
      show_if: { field: 'bpl_applicant', equals: 'yes' },
    }),
  ],
};

export const priorityServiceFormSchemas = [
  birthCertificateSchema,
  tradeLicenceSchema,
  propertyTaxSchema,
  communityHallSchema,
  rtiSchema,
] as const;

function section(id: string, en: string, bn: string, hi: string): SectionFormField {
  return { id, type: 'section', label: label(en, bn, hi) };
}

type TextFieldOptions = Partial<Omit<TextFormField, 'id' | 'type' | 'label'>>;

function text(
  id: string,
  en: string,
  bn: string,
  hi: string,
  options: TextFieldOptions = {},
): TextFormField {
  return { id, type: 'text', label: label(en, bn, hi), ...options };
}

function textarea(
  id: string,
  en: string,
  bn: string,
  hi: string,
  options: TextFieldOptions = {},
): TextFormField {
  return { id, type: 'textarea', label: label(en, bn, hi), ...options };
}

type NumberFieldOptions = Partial<Omit<NumberFormField, 'id' | 'type' | 'label'>>;

function numberField(
  id: string,
  en: string,
  bn: string,
  hi: string,
  options: NumberFieldOptions = {},
): NumberFormField {
  return { id, type: 'number', label: label(en, bn, hi), ...options };
}

type DateFieldOptions = Partial<Omit<DateFormField, 'id' | 'type' | 'label'>>;

function date(
  id: string,
  en: string,
  bn: string,
  hi: string,
  options: DateFieldOptions = {},
): DateFormField {
  return { id, type: 'date', label: label(en, bn, hi), ...options };
}

type ChoiceFieldOptions = Partial<Omit<ChoiceFormField, 'id' | 'type' | 'label' | 'options'>>;

function select(
  id: string,
  en: string,
  bn: string,
  hi: string,
  optionsList: Array<{ value: string; label: LocaleMap }>,
  options: ChoiceFieldOptions = {},
): ChoiceFormField {
  return { id, type: 'select', label: label(en, bn, hi), options: optionsList, ...options };
}

function radio(
  id: string,
  en: string,
  bn: string,
  hi: string,
  optionsList: Array<{ value: string; label: LocaleMap }>,
  options: ChoiceFieldOptions = {},
): ChoiceFormField {
  return { id, type: 'radio', label: label(en, bn, hi), options: optionsList, ...options };
}

type FileFieldOptions = Partial<
  Omit<FileFormField, 'id' | 'type' | 'label' | 'accept' | 'max_size_mb'>
> &
  Pick<FileFormField, 'accept' | 'max_size_mb'>;

function file(
  id: string,
  en: string,
  bn: string,
  hi: string,
  options: FileFieldOptions,
): FileFormField {
  return { id, type: 'file', label: label(en, bn, hi), ...options };
}

function option(
  value: string,
  en: string,
  bn: string,
  hi: string,
): { value: string; label: LocaleMap } {
  return { value, label: label(en, bn, hi) };
}

function label(en: string, bn: string, hi: string): LocaleMap {
  return { en, bn, hi };
}

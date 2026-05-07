export type Locale = 'en' | 'bn' | 'hi';

export const SUPPORTED_LOCALES: ReadonlyArray<Locale> = ['en', 'bn', 'hi'];
export const DEFAULT_LOCALE: Locale = 'en';

export const messages = {
  en: {
    'app.badge': 'Sprint 1.4 · Citizen onboarding',
    'splash.title': 'One app for your municipality',
    'splash.subtitle': 'Login, choose your municipality, and start municipal services in minutes.',
    'action.continue': 'Continue',
    'language.title': 'Choose language',
    'language.continue': 'Continue to login',
    'login.title': 'Login with mobile OTP',
    'login.mobile': 'Mobile number',
    'login.sendOtp': 'Send OTP',
    'otp.title': 'Verify OTP',
    'otp.submit': 'Verify and continue',
    'tenant.title': 'Choose your municipality',
    'home.label': 'Home',
    'home.empty':
      'Empty home is ready. Service catalogue, applications, and payments land in Phase 2.',
    'home.wards': 'Wards',
    'home.language': 'Language',
    'home.tokenStorage': 'Token storage',
    'home.tokenEncrypted': 'Encrypted',
    'status.ready': 'Ready',
    'status.sendingOtp': 'Sending OTP...',
    'status.otpSent': 'OTP sent. Use the code from the configured provider.',
    'status.apiUnreachable': 'API is unreachable. Start @enagar/api on port 3001 and try again.',
    'status.otpKeycloakRequired': 'OTP verification needs a running Keycloak OTP authenticator.',
    'status.loginVerified': 'Login verified. Choose your municipality.',
    'status.tenantSelectedLocal':
      'Tenant selected locally; API sync will retry after connectivity is available.',
  },
  bn: {
    'app.badge': 'স্প্রিন্ট ১.৪ · নাগরিক অনবোর্ডিং',
    'splash.title': 'আপনার পৌরসভার জন্য এক অ্যাপ',
    'splash.subtitle': 'লগইন করুন, পৌরসভা বেছে নিন, তারপর কয়েক মিনিটে পরিষেবা শুরু করুন।',
    'action.continue': 'চালিয়ে যান',
    'language.title': 'ভাষা বেছে নিন',
    'language.continue': 'লগইনে যান',
    'login.title': 'মোবাইল OTP দিয়ে লগইন',
    'login.mobile': 'মোবাইল নম্বর',
    'login.sendOtp': 'OTP পাঠান',
    'otp.title': 'OTP যাচাই করুন',
    'otp.submit': 'যাচাই করে এগিয়ে যান',
    'tenant.title': 'আপনার পৌরসভা বেছে নিন',
    'home.label': 'হোম',
    'home.empty': 'খালি হোম প্রস্তুত। পরিষেবা তালিকা, আবেদন এবং পেমেন্ট Phase 2-তে আসবে।',
    'home.wards': 'ওয়ার্ড',
    'home.language': 'ভাষা',
    'home.tokenStorage': 'টোকেন সংরক্ষণ',
    'home.tokenEncrypted': 'এনক্রিপ্টেড',
    'status.ready': 'প্রস্তুত',
    'status.sendingOtp': 'OTP পাঠানো হচ্ছে...',
    'status.otpSent': 'OTP পাঠানো হয়েছে। কনফিগার করা প্রদানকারীর কোড ব্যবহার করুন।',
    'status.apiUnreachable':
      'API পাওয়া যাচ্ছে না। পোর্ট 3001-এ @enagar/api চালু করে আবার চেষ্টা করুন।',
    'status.otpKeycloakRequired': 'OTP যাচাইয়ের জন্য চলমান Keycloak OTP authenticator দরকার।',
    'status.loginVerified': 'লগইন যাচাই হয়েছে। আপনার পৌরসভা বেছে নিন।',
    'status.tenantSelectedLocal': 'পৌরসভা স্থানীয়ভাবে নির্বাচিত; সংযোগ এলে API sync আবার হবে।',
  },
  hi: {
    'app.badge': 'स्प्रिंट 1.4 · नागरिक ऑनबोर्डिंग',
    'splash.title': 'आपकी नगरपालिका के लिए एक ऐप',
    'splash.subtitle': 'लॉगिन करें, नगरपालिका चुनें, और कुछ ही मिनटों में सेवाएं शुरू करें।',
    'action.continue': 'जारी रखें',
    'language.title': 'भाषा चुनें',
    'language.continue': 'लॉगिन पर जाएं',
    'login.title': 'मोबाइल OTP से लॉगिन',
    'login.mobile': 'मोबाइल नंबर',
    'login.sendOtp': 'OTP भेजें',
    'otp.title': 'OTP सत्यापित करें',
    'otp.submit': 'सत्यापित करें और आगे बढ़ें',
    'tenant.title': 'अपनी नगरपालिका चुनें',
    'home.label': 'होम',
    'home.empty': 'खाली होम तैयार है। सेवा सूची, आवेदन और भुगतान Phase 2 में आएंगे।',
    'home.wards': 'वार्ड',
    'home.language': 'भाषा',
    'home.tokenStorage': 'टोकन स्टोरेज',
    'home.tokenEncrypted': 'एन्क्रिप्टेड',
    'status.ready': 'तैयार',
    'status.sendingOtp': 'OTP भेजा जा रहा है...',
    'status.otpSent': 'OTP भेजा गया। कॉन्फिगर किए गए प्रदाता का कोड इस्तेमाल करें।',
    'status.apiUnreachable':
      'API उपलब्ध नहीं है। पोर्ट 3001 पर @enagar/api शुरू करके फिर कोशिश करें।',
    'status.otpKeycloakRequired': 'OTP सत्यापन के लिए चल रहा Keycloak OTP authenticator चाहिए।',
    'status.loginVerified': 'लॉगिन सत्यापित हुआ। अपनी नगरपालिका चुनें।',
    'status.tenantSelectedLocal':
      'नगरपालिका स्थानीय रूप से चुनी गई; कनेक्टिविटी आने पर API sync दोबारा होगा।',
  },
} as const;

export type MessageKey = keyof (typeof messages)['en'];

export function isLocale(value: string | null | undefined): value is Locale {
  return SUPPORTED_LOCALES.includes(value as Locale);
}

export function resolveLocale(
  locale: string | null | undefined,
  tenantDefault = DEFAULT_LOCALE,
): Locale {
  if (isLocale(locale)) {
    return locale;
  }
  return isLocale(tenantDefault) ? tenantDefault : DEFAULT_LOCALE;
}

export function t(
  key: MessageKey,
  locale: string | null | undefined,
  tenantDefault?: Locale,
): string {
  const resolvedLocale = resolveLocale(locale, tenantDefault);
  return messages[resolvedLocale][key] ?? messages[DEFAULT_LOCALE][key];
}

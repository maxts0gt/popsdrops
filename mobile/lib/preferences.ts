import { MOBILE_TRANSLATION_LOCALES } from "./generated/mobile-translation-locales";

const RTL_LOCALES = new Set([
  "ar",
  "he",
  "fa",
  "ur",
  "ps",
  "sd",
  "yi",
  "dv",
  "ku",
  "ckb",
  "ug",
]);

const SUPPORTED_MOBILE_LOCALE_CODES = [
  ...MOBILE_TRANSLATION_LOCALES,
] as const;
const SUPPORTED_MOBILE_LOCALE_SET = new Set<string>(SUPPORTED_MOBILE_LOCALE_CODES);

export type LanguageOption = {
  code: string;
  nativeLabel: string;
  englishLabel: string;
  isRTL: boolean;
};

function dedupe(values: Array<string | null | undefined>) {
  return Array.from(
    new Set(
      values
        .map((value) => normalizeLocaleCode(value))
        .filter((value): value is string => value != null),
    ),
  );
}

export function normalizeLocaleCode(code: string | null | undefined) {
  if (!code) {
    return null;
  }

  const normalized = code.trim().toLowerCase();

  if (!/^[a-z]{2,3}(-([a-z]{4}|[a-z]{2}|[0-9]{3}))?$/.test(normalized)) {
    return null;
  }

  return normalized.split("-")[0] ?? null;
}

export function isRTLLocale(locale: string) {
  const normalized = normalizeLocaleCode(locale);

  if (!normalized) {
    return false;
  }

  if (RTL_LOCALES.has(normalized)) {
    return true;
  }

  try {
    const intlLocale = new Intl.Locale(normalized) as Intl.Locale & {
      getTextInfo?: () => { direction: string };
    };

    if (typeof intlLocale.getTextInfo === "function") {
      return intlLocale.getTextInfo().direction === "rtl";
    }
  } catch {
    return false;
  }

  return false;
}

/** Fallback display names — Hermes has limited Intl.DisplayNames support. */
const NATIVE_NAMES: Record<string, string> = {
  en: "English", ar: "العربية", bn: "বাংলা", de: "Deutsch", el: "Ελληνικά",
  es: "Español", fa: "فارسی", fr: "Français", he: "עברית", hi: "हिन्दी",
  id: "Bahasa Indonesia", it: "Italiano", ja: "日本語", kk: "Қазақ тілі",
  ko: "한국어", ms: "Bahasa Melayu", nl: "Nederlands", pl: "Polski",
  pt: "Português", ro: "Română", ru: "Русский", sv: "Svenska", sw: "Kiswahili",
  th: "ไทย", tl: "Filipino", tr: "Türkçe", uk: "Українська", uz: "Oʻzbekcha",
  vi: "Tiếng Việt", zh: "中文", am: "አማርኛ", az: "Azərbaycan", bg: "Български",
  cs: "Čeština", da: "Dansk", et: "Eesti", fi: "Suomi", fil: "Filipino",
  gu: "ગુજરાતી", hr: "Hrvatski", hu: "Magyar", hy: "Հայերեն", ka: "ქართული",
  km: "ខ្មែរ", kn: "ಕನ್ನಡ", ky: "Кыргызча", lo: "ລາວ", lt: "Lietuvių",
  lv: "Latviešu", mk: "Македонски", ml: "മലയാളം", mn: "Монгол", mr: "मराठी",
  my: "မြန်မာ", ne: "नेपाली", no: "Norsk", om: "Oromoo", pa: "ਪੰਜਾਬੀ",
  si: "සිංහල", sk: "Slovenčina", sl: "Slovenščina", so: "Soomaali",
  sq: "Shqip", sr: "Српски", ta: "தமிழ்", te: "తెలుగు", tg: "Тоҷикӣ",
  tk: "Türkmen", yo: "Yorùbá",
};

const ENGLISH_NAMES: Record<string, string> = {
  en: "English", ar: "Arabic", bn: "Bengali", de: "German", el: "Greek",
  es: "Spanish", fa: "Persian", fr: "French", he: "Hebrew", hi: "Hindi",
  id: "Indonesian", it: "Italian", ja: "Japanese", kk: "Kazakh", ko: "Korean",
  ms: "Malay", nl: "Dutch", pl: "Polish", pt: "Portuguese", ro: "Romanian",
  ru: "Russian", sv: "Swedish", sw: "Swahili", th: "Thai", tl: "Filipino",
  tr: "Turkish", uk: "Ukrainian", uz: "Uzbek", vi: "Vietnamese", zh: "Chinese",
  am: "Amharic", az: "Azerbaijani", bg: "Bulgarian", cs: "Czech", da: "Danish",
  et: "Estonian", fi: "Finnish", fil: "Filipino", gu: "Gujarati", hr: "Croatian",
  hu: "Hungarian", hy: "Armenian", ka: "Georgian", km: "Khmer", kn: "Kannada",
  ky: "Kyrgyz", lo: "Lao", lt: "Lithuanian", lv: "Latvian", mk: "Macedonian",
  ml: "Malayalam", mn: "Mongolian", mr: "Marathi", my: "Burmese", ne: "Nepali",
  no: "Norwegian", om: "Oromo", pa: "Punjabi", si: "Sinhala", sk: "Slovak",
  sl: "Slovenian", so: "Somali", sq: "Albanian", sr: "Serbian", ta: "Tamil",
  te: "Telugu", tg: "Tajik", tk: "Turkmen", yo: "Yoruba",
};

function getDisplayName(code: string, displayLocale: string) {
  // Use hardcoded names first (Hermes Intl.DisplayNames is unreliable)
  if (displayLocale === code || displayLocale === "self") {
    if (NATIVE_NAMES[code]) return NATIVE_NAMES[code];
  }
  if (displayLocale === "en") {
    if (ENGLISH_NAMES[code]) return ENGLISH_NAMES[code];
  }

  try {
    const displayNames = new Intl.DisplayNames([displayLocale], {
      type: "language",
    });
    const result = displayNames.of(code);
    // If Intl returns the code itself, fall back to our maps
    if (result && result !== code) return result;
  } catch {
    // fall through
  }

  return NATIVE_NAMES[code] ?? ENGLISH_NAMES[code] ?? code;
}

export function buildLanguageOption(code: string): LanguageOption {
  return {
    code,
    nativeLabel: getDisplayName(code, code),
    englishLabel: getDisplayName(code, "en"),
    isRTL: isRTLLocale(code),
  };
}

function matchesQuery(option: LanguageOption, query: string) {
  const normalizedQuery = query.trim().toLowerCase();

  if (!normalizedQuery) {
    return true;
  }

  return [
    option.code,
    option.nativeLabel,
    option.englishLabel,
  ].some((value) => value.toLowerCase().includes(normalizedQuery));
}

function byNativeLabel(a: LanguageOption, b: LanguageOption) {
  return a.nativeLabel.localeCompare(b.nativeLabel, undefined, {
    sensitivity: "base",
  });
}

export function resolvePreferredLocale(input: {
  storedLocale: string | null;
  profileLocale: string | null;
  deviceLocales: string[];
}) {
  const storedLocale = normalizeLocaleCode(input.storedLocale);
  if (storedLocale && SUPPORTED_MOBILE_LOCALE_SET.has(storedLocale)) {
    return storedLocale;
  }

  const profileLocale = normalizeLocaleCode(input.profileLocale);
  if (profileLocale && SUPPORTED_MOBILE_LOCALE_SET.has(profileLocale)) {
    return profileLocale;
  }

  const firstDeviceLocale = dedupe(input.deviceLocales).find((code) =>
    SUPPORTED_MOBILE_LOCALE_SET.has(code),
  );
  return firstDeviceLocale ?? "en";
}

export function buildLanguagePickerModel(input: {
  currentLocale: string;
  deviceLocales: string[];
  query: string;
}) {
  const currentLocale = normalizeLocaleCode(input.currentLocale) ?? "en";
  const query = input.query.trim().toLowerCase();
  const pinnedCodes = dedupe([currentLocale, "en"]);
  const suggestedCodes = dedupe(input.deviceLocales).filter(
    (code) =>
      SUPPORTED_MOBILE_LOCALE_SET.has(code) &&
      !pinnedCodes.includes(code),
  );
  const restCodes = dedupe([...SUPPORTED_MOBILE_LOCALE_CODES]).filter(
    (code) => !pinnedCodes.includes(code) && !suggestedCodes.includes(code),
  );

  const pinned = pinnedCodes.map(buildLanguageOption);
  const suggested = suggestedCodes
    .map(buildLanguageOption)
    .filter((option) => matchesQuery(option, query))
    .sort(byNativeLabel);
  const rest = restCodes
    .map(buildLanguageOption)
    .filter((option) => matchesQuery(option, query))
    .sort(byNativeLabel);

  return {
    pinned,
    suggested,
    rest,
  };
}

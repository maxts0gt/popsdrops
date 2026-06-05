export const PLATFORMS = [
  "tiktok",
  "instagram",
  "snapchat",
  "youtube",
  "facebook",
] as const;

export type Platform = (typeof PLATFORMS)[number];

export const PLATFORM_LABELS: Record<Platform, string> = {
  tiktok: "TikTok",
  instagram: "Instagram",
  snapchat: "Snapchat",
  youtube: "YouTube",
  facebook: "Facebook",
};

export function getPlatformLabel(platform: string): string {
  if (platform in PLATFORM_LABELS) {
    return PLATFORM_LABELS[platform as Platform];
  }

  return platform
    .split(/[-_\s]+/)
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

export const PLATFORM_COLORS: Record<Platform, string> = {
  tiktok: "bg-black text-white",
  instagram:
    "bg-gradient-to-r from-purple-500 to-pink-500 text-white",
  snapchat: "bg-yellow-400 text-black",
  youtube: "bg-red-600 text-white",
  facebook: "bg-blue-600 text-white",
};

export const NICHES = [
  "beauty",
  "fashion",
  "food",
  "travel",
  "tech",
  "fitness",
  "gaming",
  "lifestyle",
  "education",
  "entertainment",
  "parenting",
  "automotive",
  "home",
  "health",
  "finance",
] as const;

export type Niche = (typeof NICHES)[number];

export const NICHE_LABELS: Record<Niche, string> = {
  beauty: "Beauty & Skincare",
  fashion: "Fashion & Apparel",
  food: "Food & Drink",
  travel: "Travel",
  tech: "Tech & Gaming",
  fitness: "Fitness",
  gaming: "Gaming",
  lifestyle: "Lifestyle",
  education: "Education",
  entertainment: "Entertainment",
  parenting: "Parenting",
  automotive: "Automotive",
  home: "Home & Decor",
  health: "Health & Wellness",
  finance: "Finance",
};

export const MARKETS = [
  "af",
  "ax",
  "al",
  "dz",
  "as",
  "ad",
  "ao",
  "ai",
  "aq",
  "ag",
  "ar",
  "am",
  "aw",
  "au",
  "at",
  "az",
  "bs",
  "bh",
  "bd",
  "bb",
  "by",
  "be",
  "bz",
  "bj",
  "bm",
  "bt",
  "bo",
  "bq",
  "ba",
  "bw",
  "bv",
  "br",
  "io",
  "bn",
  "bg",
  "bf",
  "bi",
  "kh",
  "cm",
  "ca",
  "cv",
  "ky",
  "cf",
  "td",
  "cl",
  "cn",
  "cx",
  "cc",
  "co",
  "km",
  "cg",
  "cd",
  "ck",
  "cr",
  "ci",
  "hr",
  "cu",
  "cw",
  "cy",
  "cz",
  "dk",
  "dj",
  "dm",
  "do",
  "ec",
  "eg",
  "sv",
  "gq",
  "er",
  "ee",
  "sz",
  "et",
  "fk",
  "fo",
  "fj",
  "fi",
  "fr",
  "gf",
  "pf",
  "tf",
  "ga",
  "gm",
  "ge",
  "de",
  "gh",
  "gi",
  "gr",
  "gl",
  "gd",
  "gp",
  "gu",
  "gt",
  "gg",
  "gn",
  "gw",
  "gy",
  "ht",
  "hm",
  "va",
  "hn",
  "hk",
  "hu",
  "is",
  "in",
  "id",
  "ir",
  "iq",
  "ie",
  "im",
  "il",
  "it",
  "jm",
  "jp",
  "je",
  "jo",
  "kz",
  "ke",
  "ki",
  "kp",
  "kr",
  "kw",
  "kg",
  "la",
  "lv",
  "lb",
  "ls",
  "lr",
  "ly",
  "li",
  "lt",
  "lu",
  "mo",
  "mg",
  "mw",
  "my",
  "mv",
  "ml",
  "mt",
  "mh",
  "mq",
  "mr",
  "mu",
  "yt",
  "mx",
  "fm",
  "md",
  "mc",
  "mn",
  "me",
  "ms",
  "ma",
  "mz",
  "mm",
  "na",
  "nr",
  "np",
  "nl",
  "nc",
  "nz",
  "ni",
  "ne",
  "ng",
  "nu",
  "nf",
  "mk",
  "mp",
  "no",
  "om",
  "pk",
  "pw",
  "ps",
  "pa",
  "pg",
  "py",
  "pe",
  "ph",
  "pn",
  "pl",
  "pt",
  "pr",
  "qa",
  "re",
  "ro",
  "ru",
  "rw",
  "bl",
  "sh",
  "kn",
  "lc",
  "mf",
  "pm",
  "vc",
  "ws",
  "sm",
  "st",
  "sa",
  "sn",
  "rs",
  "sc",
  "sl",
  "sg",
  "sx",
  "sk",
  "si",
  "sb",
  "so",
  "za",
  "gs",
  "ss",
  "es",
  "lk",
  "sd",
  "sr",
  "sj",
  "se",
  "ch",
  "sy",
  "tw",
  "tj",
  "tz",
  "th",
  "tl",
  "tg",
  "tk",
  "to",
  "tt",
  "tn",
  "tr",
  "tm",
  "tc",
  "tv",
  "ug",
  "ua",
  "ae",
  "gb",
  "us",
  "um",
  "uy",
  "uz",
  "vu",
  "ve",
  "vn",
  "vg",
  "vi",
  "wf",
  "eh",
  "ye",
  "zm",
  "zw",
] as const;

export type Market = (typeof MARKETS)[number];

export const MARKET_SCOPES = [
  "global",
  "region:apac",
  "region:emea",
  "region:americas",
  "region:latam",
] as const;

export type MarketScope = (typeof MARKET_SCOPES)[number];
export type CampaignMarket = Market | MarketScope;

export const CAMPAIGN_MARKETS = [...MARKET_SCOPES, ...MARKETS] as const;

export const MARKET_SCOPE_LABELS: Record<MarketScope, string> = {
  global: "Global",
  "region:apac": "APAC",
  "region:emea": "EMEA",
  "region:americas": "Americas",
  "region:latam": "LATAM",
};

export const MARKET_SCOPE_OPTIONS = MARKET_SCOPES.map((scope) => ({
  value: scope,
  label: MARKET_SCOPE_LABELS[scope],
}));

const APAC_MARKETS = [
  "as",
  "au",
  "bd",
  "bn",
  "bt",
  "cc",
  "ck",
  "cn",
  "cx",
  "fj",
  "fm",
  "gu",
  "hk",
  "id",
  "in",
  "io",
  "jp",
  "kh",
  "ki",
  "kp",
  "kr",
  "la",
  "lk",
  "mh",
  "mm",
  "mn",
  "mo",
  "mp",
  "mv",
  "my",
  "nc",
  "nf",
  "np",
  "nr",
  "nu",
  "nz",
  "pf",
  "pg",
  "ph",
  "pn",
  "pw",
  "sb",
  "sg",
  "th",
  "tk",
  "tl",
  "to",
  "tv",
  "tw",
  "um",
  "vn",
  "vu",
  "wf",
  "ws",
] as const satisfies readonly Market[];

const EMEA_MARKETS = [
  "ad",
  "ae",
  "af",
  "al",
  "am",
  "ao",
  "at",
  "ax",
  "az",
  "ba",
  "be",
  "bf",
  "bg",
  "bh",
  "bi",
  "bj",
  "bv",
  "bw",
  "by",
  "cd",
  "cf",
  "cg",
  "ch",
  "ci",
  "cm",
  "cv",
  "cy",
  "cz",
  "de",
  "dj",
  "dk",
  "dz",
  "ee",
  "eg",
  "eh",
  "er",
  "es",
  "et",
  "fi",
  "fo",
  "fr",
  "ga",
  "gb",
  "ge",
  "gg",
  "gh",
  "gi",
  "gm",
  "gn",
  "gq",
  "gr",
  "gw",
  "hr",
  "hu",
  "ie",
  "il",
  "im",
  "iq",
  "ir",
  "is",
  "it",
  "je",
  "jo",
  "ke",
  "kg",
  "km",
  "kw",
  "kz",
  "lb",
  "li",
  "lr",
  "ls",
  "lt",
  "lu",
  "lv",
  "ly",
  "ma",
  "mc",
  "md",
  "me",
  "mf",
  "mg",
  "mk",
  "ml",
  "mr",
  "mt",
  "mu",
  "mw",
  "mz",
  "na",
  "ne",
  "ng",
  "nl",
  "no",
  "om",
  "ps",
  "pl",
  "pt",
  "qa",
  "re",
  "ro",
  "rs",
  "ru",
  "rw",
  "sa",
  "sc",
  "sd",
  "se",
  "sh",
  "si",
  "sj",
  "sk",
  "sl",
  "sm",
  "sn",
  "so",
  "ss",
  "st",
  "sy",
  "sz",
  "td",
  "tf",
  "tg",
  "tj",
  "tm",
  "tn",
  "tr",
  "tz",
  "ua",
  "ug",
  "uz",
  "va",
  "yt",
  "za",
  "zm",
  "zw",
] as const satisfies readonly Market[];

const LATAM_MARKETS = [
  "ag",
  "ai",
  "ar",
  "aw",
  "bb",
  "bl",
  "bm",
  "bo",
  "bq",
  "br",
  "bs",
  "bz",
  "cl",
  "co",
  "cr",
  "cu",
  "cw",
  "dm",
  "do",
  "ec",
  "fk",
  "gf",
  "gd",
  "gl",
  "gp",
  "gs",
  "gt",
  "gy",
  "hn",
  "ht",
  "jm",
  "kn",
  "ky",
  "lc",
  "ms",
  "mq",
  "mx",
  "ni",
  "pa",
  "pe",
  "pr",
  "pm",
  "py",
  "sr",
  "sv",
  "sx",
  "tc",
  "tt",
  "uy",
  "vc",
  "ve",
  "vg",
  "vi",
] as const satisfies readonly Market[];

const AMERICAS_MARKETS = [
  "ca",
  "pm",
  "us",
  ...LATAM_MARKETS,
] as const satisfies readonly Market[];

const MARKET_SCOPE_MEMBERS: Record<
  Exclude<MarketScope, "global">,
  readonly Market[]
> = {
  "region:apac": APAC_MARKETS,
  "region:emea": EMEA_MARKETS,
  "region:americas": AMERICAS_MARKETS,
  "region:latam": LATAM_MARKETS,
};

export function isMarketScope(market: string): market is MarketScope {
  return MARKET_SCOPES.includes(market as MarketScope);
}

export function isCampaignMarket(market: string): market is CampaignMarket {
  return (CAMPAIGN_MARKETS as readonly string[]).includes(
    market.toLowerCase(),
  );
}

export function sanitizeCampaignMarkets(
  markets: readonly string[] | null | undefined,
): CampaignMarket[] {
  const cleanMarkets: CampaignMarket[] = [];

  for (const market of markets ?? []) {
    const normalized = market.trim().toLowerCase();
    if (!isCampaignMarket(normalized)) continue;
    if (normalized === "global") return ["global"];
    if (!cleanMarkets.includes(normalized)) {
      cleanMarkets.push(normalized);
    }
  }

  return cleanMarkets;
}

const ENGLISH_REGION_NAMES = new Intl.DisplayNames(["en"], { type: "region" });
const ENGLISH_REGION_NAME_OVERRIDES: Record<string, string> = {
  FK: "Falkland Islands",
  HK: "Hong Kong",
  MO: "Macao",
  PS: "Palestine",
};

export function normalizeEnglishRegionName(code: string, label: string): string {
  return ENGLISH_REGION_NAME_OVERRIDES[code.toUpperCase()] ?? label;
}

export const MARKET_REGION_CODES = Object.fromEntries(
  MARKETS.map((market) => [market, market.toUpperCase()]),
) as Record<Market, string>;

export const MARKET_LABELS = Object.fromEntries(
  MARKETS.map((market) => {
    const code = MARKET_REGION_CODES[market];
    const label = ENGLISH_REGION_NAMES.of(code) || code;
    return [market, normalizeEnglishRegionName(code, label)];
  }),
) as Record<Market, string>;

export const LANGUAGES = [
  "arabic",
  "bengali",
  "chinese",
  "english",
  "french",
  "german",
  "hindi",
  "indonesian",
  "italian",
  "japanese",
  "kazakh",
  "korean",
  "malay",
  "polish",
  "portuguese",
  "russian",
  "spanish",
  "swedish",
  "thai",
  "turkish",
  "urdu",
  "uzbek",
  "vietnamese",
] as const;

export type Language = (typeof LANGUAGES)[number];

export const LANGUAGE_LABELS: Record<Language, string> = {
  arabic: "Arabic",
  bengali: "Bengali",
  chinese: "Chinese",
  english: "English",
  french: "French",
  german: "German",
  hindi: "Hindi",
  indonesian: "Indonesian",
  italian: "Italian",
  japanese: "Japanese",
  kazakh: "Kazakh",
  korean: "Korean",
  malay: "Malay",
  polish: "Polish",
  portuguese: "Portuguese",
  russian: "Russian",
  spanish: "Spanish",
  swedish: "Swedish",
  thai: "Thai",
  turkish: "Turkish",
  urdu: "Urdu",
  uzbek: "Uzbek",
  vietnamese: "Vietnamese",
};

export const INDUSTRIES = [
  "beauty_skincare",
  "fashion_apparel",
  "food_beverage",
  "technology",
  "health_wellness",
  "travel_hospitality",
  "education",
  "finance",
  "entertainment",
  "automotive",
  "home_living",
  "other",
] as const;

export type Industry = (typeof INDUSTRIES)[number];

export const INDUSTRY_LABELS: Record<Industry, string> = {
  beauty_skincare: "Beauty & Skincare",
  fashion_apparel: "Fashion & Apparel",
  food_beverage: "Food & Beverage",
  technology: "Technology",
  health_wellness: "Health & Wellness",
  travel_hospitality: "Travel & Hospitality",
  education: "Education",
  finance: "Finance",
  entertainment: "Entertainment",
  automotive: "Automotive",
  home_living: "Home & Living",
  other: "Other",
};

export const CONTENT_FORMATS = [
  "short_video",
  "long_video",
  "story",
  "photo_post",
  "reel",
  "carousel",
  "live",
] as const;

export type ContentFormat = (typeof CONTENT_FORMATS)[number];

export const CONTENT_FORMAT_LABELS: Record<ContentFormat, string> = {
  short_video: "Short Video",
  long_video: "Long Video",
  story: "Story",
  photo_post: "Photo Post",
  reel: "Reel",
  carousel: "Carousel",
  live: "Live Stream",
};

export const CAMPAIGN_STATUSES = [
  "draft",
  "recruiting",
  "in_progress",
  "publishing",
  "monitoring",
  "completed",
  "paused",
  "cancelled",
] as const;

export type CampaignStatus = (typeof CAMPAIGN_STATUSES)[number];

export const CAMPAIGN_STATUS_LABELS: Record<CampaignStatus, string> = {
  draft: "Draft",
  recruiting: "Recruiting",
  in_progress: "In Progress",
  publishing: "Publishing",
  monitoring: "Monitoring",
  completed: "Completed",
  paused: "Paused",
  cancelled: "Cancelled",
};

export const CAMPAIGN_STATUS_COLORS: Record<CampaignStatus, string> = {
  draft: "bg-slate-100 text-slate-700",
  recruiting: "bg-blue-100 text-blue-700",
  in_progress: "bg-blue-100 text-blue-700",
  publishing: "bg-amber-100 text-amber-700",
  monitoring: "bg-purple-100 text-purple-700",
  completed: "bg-emerald-100 text-emerald-700",
  paused: "bg-orange-100 text-orange-700",
  cancelled: "bg-red-100 text-red-700",
};

export const CAMPAIGN_STATUS_TEXT_COLORS: Record<CampaignStatus, string> = {
  draft: "text-muted-foreground",
  recruiting: "text-blue-600",
  in_progress: "text-blue-600",
  publishing: "text-amber-600",
  monitoring: "text-purple-600",
  completed: "text-emerald-600",
  paused: "text-orange-600",
  cancelled: "text-red-600",
};

export const PROFILE_STATUS_COLORS: Record<string, string> = {
  approved: "text-emerald-600 dark:text-emerald-400",
  pending: "text-amber-600 dark:text-amber-400",
  suspended: "text-red-600 dark:text-red-400",
  rejected: "text-muted-foreground",
};

export const ROLE_COLORS: Record<string, string> = {
  creator: "text-foreground",
  brand: "text-foreground",
  admin: "text-foreground font-semibold",
};

export const CREATOR_TIERS = ["new", "rising", "established", "top"] as const;

export type CreatorTier = (typeof CREATOR_TIERS)[number];

export const CREATOR_TIER_LABELS: Record<CreatorTier, string> = {
  new: "New Creator",
  rising: "Rising Creator",
  established: "Established Creator",
  top: "Top Creator",
};

export const CREATOR_TIER_COLORS: Record<CreatorTier, string> = {
  new: "bg-neutral-100 text-neutral-700 dark:bg-neutral-800 dark:text-neutral-300",
  rising: "bg-amber-100 text-amber-700 dark:bg-amber-950 dark:text-amber-300",
  established: "bg-neutral-200 text-neutral-800 dark:bg-neutral-800 dark:text-neutral-200",
  top: "bg-amber-200 text-amber-800 dark:bg-amber-900 dark:text-amber-200",
};

const LEGACY_MARKET_REGION_CODES: Record<string, string> = {
  argentina: "AR",
  australia: "AU",
  bahrain: "BH",
  bangladesh: "BD",
  brazil: "BR",
  canada: "CA",
  chile: "CL",
  china: "CN",
  colombia: "CO",
  egypt: "EG",
  france: "FR",
  germany: "DE",
  india: "IN",
  indonesia: "ID",
  iraq: "IQ",
  italy: "IT",
  japan: "JP",
  jordan: "JO",
  kazakhstan: "KZ",
  kenya: "KE",
  kuwait: "KW",
  malaysia: "MY",
  mexico: "MX",
  morocco: "MA",
  netherlands: "NL",
  nigeria: "NG",
  oman: "OM",
  pakistan: "PK",
  philippines: "PH",
  poland: "PL",
  qatar: "QA",
  russia: "RU",
  saudi_arabia: "SA",
  singapore: "SG",
  south_africa: "ZA",
  south_korea: "KR",
  spain: "ES",
  sweden: "SE",
  thailand: "TH",
  turkey: "TR",
  uae: "AE",
  uk: "GB",
  us: "US",
  uzbekistan: "UZ",
  vietnam: "VN",
};

function getMarketRegionCode(market: string): string | undefined {
  const normalized = market.toLowerCase();

  if (normalized in MARKET_REGION_CODES) {
    return MARKET_REGION_CODES[normalized as Market];
  }

  if (/^[a-z]{2}$/.test(normalized)) {
    return normalized.toUpperCase();
  }

  return LEGACY_MARKET_REGION_CODES[normalized];
}

function getNormalizedMarket(market: string): Market | undefined {
  const code = getMarketRegionCode(market);
  if (!code) return undefined;

  const normalized = code.toLowerCase();
  return MARKETS.includes(normalized as Market) ? (normalized as Market) : undefined;
}

/**
 * Get market name in the user's locale. Falls back to English label.
 * Uses Intl.DisplayNames for locale-specific country names.
 */
export function getMarketLabel(market: string, locale = "en"): string {
  if (isMarketScope(market)) {
    return MARKET_SCOPE_LABELS[market];
  }

  const code = getMarketRegionCode(market);
  if (!code) return market;

  try {
    const dn = new Intl.DisplayNames([locale], { type: "region" });
    const label = dn.of(code) || MARKET_LABELS[market as Market] || market;
    return locale === "en" ? normalizeEnglishRegionName(code, label) : label;
  } catch {
    return MARKET_LABELS[market as Market] || market;
  }
}

export function campaignMarketsIncludeCreatorMarket(
  campaignMarkets: readonly string[],
  creatorMarket: string,
): boolean {
  const normalizedCreatorMarket = getNormalizedMarket(creatorMarket);
  if (!normalizedCreatorMarket) return false;

  const normalizedCampaignMarkets = new Set(
    campaignMarkets.map((market) => market.toLowerCase()),
  );

  if (normalizedCampaignMarkets.has("global")) return true;
  if (normalizedCampaignMarkets.has(normalizedCreatorMarket)) return true;

  return (Object.entries(MARKET_SCOPE_MEMBERS) as Array<
    [Exclude<MarketScope, "global">, readonly Market[]]
  >).some(
    ([scope, scopeMarkets]) =>
      normalizedCampaignMarkets.has(scope) &&
      scopeMarkets.includes(normalizedCreatorMarket),
  );
}

// ---------------------------------------------------------------------------
// Currency formatting
// ---------------------------------------------------------------------------

/** Locale-aware currency formatting (e.g. "$1,500" for en, "1 500 $US" for fr) */
export function formatCurrency(
  amount: number,
  locale = "en",
  currency = "USD",
  maximumFractionDigits = 0,
): string {
  return new Intl.NumberFormat(locale, {
    style: "currency",
    currency,
    maximumFractionDigits,
  }).format(amount);
}

/** Locale-aware budget range string */
export function formatBudgetRange(
  min: number | null,
  max: number | null,
  locale = "en",
  currency = "USD",
): string {
  const fmt = (n: number) => formatCurrency(n, locale, currency);
  if (min != null && max != null) {
    if (min === max) return fmt(min);
    return `${fmt(min)} - ${fmt(max)}`;
  }
  if (min != null) return fmt(min) + "+";
  if (max != null) return `<= ${fmt(max)}`;
  return "-";
}

/** Divide total creator cash by planned creator count for creator-facing pay. */
export function getBudgetPerCreatorAmount(
  amount: number | null,
  maxCreators: number | null | undefined,
): number | null {
  if (amount == null) return null;
  const creatorCount = maxCreators && maxCreators > 0 ? maxCreators : 1;
  return amount / creatorCount;
}

/** Locale-aware per-creator pay range derived from total campaign creator cash. */
export function formatBudgetPerCreatorRange(
  min: number | null,
  max: number | null,
  maxCreators: number | null | undefined,
  locale = "en",
  currency = "USD",
): string {
  return formatBudgetRange(
    getBudgetPerCreatorAmount(min, maxCreators),
    getBudgetPerCreatorAmount(max, maxCreators),
    locale,
    currency,
  );
}

// Niche and content format string keys for i18n (resolved via t())
export const NICHE_KEYS: Record<Niche, string> = {
  beauty: "niche.beauty", fashion: "niche.fashion", food: "niche.food",
  travel: "niche.travel", tech: "niche.tech", fitness: "niche.fitness",
  gaming: "niche.gaming", lifestyle: "niche.lifestyle", education: "niche.education",
  entertainment: "niche.entertainment", parenting: "niche.parenting",
  automotive: "niche.automotive", home: "niche.home", health: "niche.health",
  finance: "niche.finance",
};

export const FORMAT_KEYS: Record<ContentFormat, string> = {
  short_video: "format.shortVideo", long_video: "format.longVideo",
  story: "format.story", photo_post: "format.photoPost",
  reel: "format.reel", carousel: "format.carousel", live: "format.live",
};

// Market rate multiplier (vs US rates) - used for rate benchmarking
export const MARKET_RATE_MULTIPLIER: Record<string, number> = {
  us: 1.0,
  uk: 0.85,
  canada: 0.8,
  australia: 0.75,
  germany: 0.7,
  france: 0.65,
  netherlands: 0.65,
  sweden: 0.65,
  italy: 0.6,
  spain: 0.55,
  japan: 0.7,
  south_korea: 0.6,
  singapore: 0.6,
  uae: 0.6,
  saudi_arabia: 0.5,
  kuwait: 0.5,
  qatar: 0.5,
  bahrain: 0.45,
  oman: 0.4,
  brazil: 0.35,
  mexico: 0.35,
  turkey: 0.35,
  jordan: 0.35,
  poland: 0.35,
  russia: 0.35,
  chile: 0.35,
  argentina: 0.3,
  malaysia: 0.3,
  thailand: 0.3,
  china: 0.3,
  colombia: 0.3,
  egypt: 0.3,
  morocco: 0.3,
  kazakhstan: 0.3,
  south_africa: 0.25,
  india: 0.2,
  indonesia: 0.2,
  philippines: 0.2,
  vietnam: 0.2,
  nigeria: 0.2,
  kenya: 0.2,
  uzbekistan: 0.2,
  iraq: 0.25,
  bangladesh: 0.15,
  pakistan: 0.15,
};

// Engagement rate benchmarks by platform and tier
export const ER_BENCHMARKS: Record<
  string,
  Record<string, { min: number; max: number }>
> = {
  tiktok: {
    nano: { min: 8, max: 15 },
    micro: { min: 5, max: 10 },
    mid: { min: 3, max: 6 },
    macro: { min: 1, max: 4 },
  },
  instagram: {
    nano: { min: 5, max: 10 },
    micro: { min: 3, max: 6 },
    mid: { min: 1, max: 3 },
    macro: { min: 0.5, max: 1.5 },
  },
  youtube: {
    nano: { min: 3, max: 8 },
    micro: { min: 2, max: 5 },
    mid: { min: 1, max: 3 },
    macro: { min: 0.5, max: 2 },
  },
  snapchat: {
    nano: { min: 3, max: 8 },
    micro: { min: 2, max: 5 },
    mid: { min: 1, max: 3 },
    macro: { min: 0.5, max: 2 },
  },
  facebook: {
    nano: { min: 3, max: 8 },
    micro: { min: 2, max: 5 },
    mid: { min: 1, max: 3 },
    macro: { min: 0.5, max: 1.5 },
  },
};

// Follower tier definitions
export function getFollowerTier(
  followers: number
): "nano" | "micro" | "mid" | "macro" | "mega" {
  if (followers < 10_000) return "nano";
  if (followers < 100_000) return "micro";
  if (followers < 500_000) return "mid";
  if (followers < 1_000_000) return "macro";
  return "mega";
}

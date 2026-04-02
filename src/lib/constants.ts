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

/** Platforms that support OAuth connection (MVP — no Facebook) */
export const OAUTH_PLATFORMS: Platform[] = [
  "instagram",
  "tiktok",
  "youtube",
  "snapchat",
];

/** Branded button labels for OAuth connect */
export const PLATFORM_CONNECT_LABELS: Partial<Record<Platform, string>> = {
  instagram: "Connect Instagram",
  tiktok: "Connect TikTok",
  youtube: "Connect YouTube",
  snapchat: "Connect Snapchat",
};

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
  "argentina",
  "australia",
  "bahrain",
  "bangladesh",
  "brazil",
  "canada",
  "chile",
  "china",
  "colombia",
  "egypt",
  "france",
  "germany",
  "india",
  "indonesia",
  "iraq",
  "italy",
  "japan",
  "jordan",
  "kazakhstan",
  "kenya",
  "kuwait",
  "malaysia",
  "mexico",
  "morocco",
  "netherlands",
  "nigeria",
  "oman",
  "pakistan",
  "philippines",
  "poland",
  "qatar",
  "russia",
  "saudi_arabia",
  "singapore",
  "south_africa",
  "south_korea",
  "spain",
  "sweden",
  "thailand",
  "turkey",
  "uae",
  "uk",
  "us",
  "uzbekistan",
  "vietnam",
] as const;

export type Market = (typeof MARKETS)[number];

export const MARKET_LABELS: Record<Market, string> = {
  argentina: "Argentina",
  australia: "Australia",
  bahrain: "Bahrain",
  bangladesh: "Bangladesh",
  brazil: "Brazil",
  canada: "Canada",
  chile: "Chile",
  china: "China",
  colombia: "Colombia",
  egypt: "Egypt",
  france: "France",
  germany: "Germany",
  india: "India",
  indonesia: "Indonesia",
  iraq: "Iraq",
  italy: "Italy",
  japan: "Japan",
  jordan: "Jordan",
  kazakhstan: "Kazakhstan",
  kenya: "Kenya",
  kuwait: "Kuwait",
  malaysia: "Malaysia",
  mexico: "Mexico",
  morocco: "Morocco",
  netherlands: "Netherlands",
  nigeria: "Nigeria",
  oman: "Oman",
  pakistan: "Pakistan",
  philippines: "Philippines",
  poland: "Poland",
  qatar: "Qatar",
  russia: "Russia",
  saudi_arabia: "Saudi Arabia",
  singapore: "Singapore",
  south_africa: "South Africa",
  south_korea: "South Korea",
  spain: "Spain",
  sweden: "Sweden",
  thailand: "Thailand",
  turkey: "Turkey",
  uae: "UAE",
  uk: "United Kingdom",
  us: "United States",
  uzbekistan: "Uzbekistan",
  vietnam: "Vietnam",
};

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
  draft: "bg-neutral-100 text-neutral-700 dark:bg-neutral-800 dark:text-neutral-300",
  recruiting: "bg-blue-100 text-blue-700 dark:bg-blue-950 dark:text-blue-300",
  in_progress: "bg-blue-100 text-blue-700 dark:bg-blue-950 dark:text-blue-300",
  publishing: "bg-amber-100 text-amber-700 dark:bg-amber-950 dark:text-amber-300",
  monitoring: "bg-purple-100 text-purple-700 dark:bg-purple-950 dark:text-purple-300",
  completed: "bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300",
  paused: "bg-orange-100 text-orange-700 dark:bg-orange-950 dark:text-orange-300",
  cancelled: "bg-red-100 text-red-700 dark:bg-red-950 dark:text-red-300",
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

// ISO 3166-1 alpha-2 codes for Intl.DisplayNames translation
const MARKET_REGION_CODES: Record<Market, string> = {
  argentina: "AR", australia: "AU", bahrain: "BH", bangladesh: "BD",
  brazil: "BR", canada: "CA", chile: "CL", china: "CN",
  colombia: "CO", egypt: "EG", france: "FR", germany: "DE",
  india: "IN", indonesia: "ID", iraq: "IQ", italy: "IT",
  japan: "JP", jordan: "JO", kazakhstan: "KZ", kenya: "KE",
  kuwait: "KW", malaysia: "MY", mexico: "MX", morocco: "MA",
  netherlands: "NL", nigeria: "NG", oman: "OM", pakistan: "PK",
  philippines: "PH", poland: "PL", qatar: "QA", russia: "RU", saudi_arabia: "SA",
  singapore: "SG", south_africa: "ZA", south_korea: "KR", spain: "ES",
  sweden: "SE", thailand: "TH", turkey: "TR", uae: "AE",
  uk: "GB", us: "US", uzbekistan: "UZ", vietnam: "VN",
};

/**
 * Get market name in the user's locale. Falls back to English label.
 * Uses Intl.DisplayNames — translates "japan" → "日本" for ja locale.
 */
export function getMarketLabel(market: string, locale = "en"): string {
  const code = MARKET_REGION_CODES[market as Market];
  if (!code) return MARKET_LABELS[market as Market] || market;
  try {
    const dn = new Intl.DisplayNames([locale], { type: "region" });
    return dn.of(code) || MARKET_LABELS[market as Market] || market;
  } catch {
    return MARKET_LABELS[market as Market] || market;
  }
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
  if (min && max) return `${fmt(min)} – ${fmt(max)}`;
  if (min) return fmt(min) + "+";
  if (max) return `≤ ${fmt(max)}`;
  return "—";
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

// Market rate multiplier (vs US rates) — used for rate benchmarking
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

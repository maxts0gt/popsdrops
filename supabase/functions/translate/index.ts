import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { crypto } from "https://deno.land/std@0.208.0/crypto/mod.ts";

const GEMINI_API_KEY = Deno.env.get("GEMINI_API_KEY")!;
const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const TRANSLATION_MODEL =
  Deno.env.get("TRANSLATION_MODEL") ?? "gemini-3-flash-preview";

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

/** Known locale → English name mapping for Gemini prompt context. */
const LOCALE_NAMES: Record<string, string> = {
  ar: "Arabic", bn: "Bengali", de: "German", el: "Greek",
  es: "Spanish", fa: "Persian (Farsi)", fr: "French", he: "Hebrew",
  hi: "Hindi", id: "Indonesian", it: "Italian", ja: "Japanese",
  kk: "Kazakh", ko: "Korean", ms: "Malay", nl: "Dutch",
  pl: "Polish", pt: "Portuguese", ro: "Romanian", ru: "Russian",
  sv: "Swedish", sw: "Swahili", th: "Thai", tl: "Filipino",
  tr: "Turkish", uk: "Ukrainian", uz: "Uzbek", vi: "Vietnamese",
  zh: "Chinese (Simplified)",
};

/**
 * Get the English name for any locale code.
 * Uses our known map first, falls back to Intl.DisplayNames.
 */
function getLocaleName(code: string): string {
  if (LOCALE_NAMES[code]) return LOCALE_NAMES[code];
  try {
    const dn = new Intl.DisplayNames(["en"], { type: "language" });
    return dn.of(code) || code;
  } catch {
    return code;
  }
}

/** Validate that a string is a plausible ISO 639-1 locale code. */
function isValidLocaleCode(code: string): boolean {
  return /^[a-z]{2,3}$/.test(code);
}

interface TranslateRequest {
  locale: string;
  pages: Record<string, Record<string, string>>; // { "marketing.landing": {...}, "ui.common": {...} }
  force?: boolean;
}

async function hashStrings(strings: Record<string, string>): Promise<string> {
  const sorted = JSON.stringify(strings, Object.keys(strings).sort());
  const encoded = new TextEncoder().encode(sorted);
  const hash = await crypto.subtle.digest("SHA-256", encoded);
  return Array.from(new Uint8Array(hash)).map(b => b.toString(16).padStart(2, "0")).join("");
}

async function getGlossary(locale: string): Promise<Record<string, string>> {
  const { data } = await supabase
    .from("translation_glossary")
    .select("term, translation")
    .eq("locale", locale);

  if (!data) return {};
  return Object.fromEntries(data.map((row) => [row.term, row.translation]));
}

async function translateWithGemini(
  strings: Record<string, string>,
  locale: string,
  glossary: Record<string, string>,
): Promise<Record<string, string>> {
  const glossaryText = Object.entries(glossary)
    .map(([en, translated]) => `  "${en}" → "${translated}"`)
    .join("\n");

  const prompt = `You are a native ${getLocaleName(locale)} copywriter working on a global influencer marketing platform called PopsDrops. Your job is to adapt the following English UI strings into natural, fluent ${getLocaleName(locale)}.

CRITICAL: Do NOT translate word-for-word. Write how a native ${getLocaleName(locale)} speaker would naturally say this in a professional tech/marketing context. Think about how top platforms like Instagram, TikTok, or LinkedIn localize their UI in ${getLocaleName(locale)} — match that level of naturalness.

CONTEXT: These strings appear on a website where brands hire content creators for influencer campaigns across different countries. The tone is confident, modern, and professional — like a premium SaaS product, not a government form.

RULES:
- Return ONLY valid JSON — no markdown, no code fences, no explanation
- Keep the exact same keys (in English), only translate the values
- Use CONSISTENT terminology throughout — the same English concept must always map to the same ${getLocaleName(locale)} word (e.g. "campaign" should be the same word everywhere)
- Adapt idioms and expressions to what sounds natural in ${getLocaleName(locale)}, do not translate them literally
- Short strings (buttons, labels, nav items) should be concise — match or beat the English length
- Headlines should be punchy and compelling, not just accurate
- Descriptions can be slightly rephrased for flow and clarity in ${getLocaleName(locale)}
- Keep brand names untranslated: "PopsDrops" stays "PopsDrops"
- Keep platform names in English: TikTok, Instagram, Snapchat, YouTube
- Keep technical metrics in English where commonly used: CPM, CPE, ROI
- For Arabic: use Modern Standard Arabic, not dialect. Formal but not stiff.
- For Korean/Japanese: use polite/formal register (존댓말 / 敬語) appropriate for B2B marketing
- For Chinese: use Simplified Chinese (简体中文)

${glossaryText ? `GLOSSARY (use these exact translations for consistency):\n${glossaryText}\n` : ""}
STRINGS TO ADAPT (not translate — adapt naturally):
${JSON.stringify(strings, null, 2)}`;

  const response = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/${TRANSLATION_MODEL}:generateContent?key=${GEMINI_API_KEY}`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        contents: [{ parts: [{ text: prompt }] }],
        generationConfig: {
          temperature: 0.1,
          responseMimeType: "application/json",
        },
      }),
    },
  );

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Gemini API error: ${response.status} — ${error}`);
  }

  const data = await response.json();
  const text = data.candidates?.[0]?.content?.parts?.[0]?.text;

  if (!text) {
    throw new Error("Empty response from Gemini");
  }

  return JSON.parse(text);
}

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, apikey, x-client-info",
};

const jsonHeaders = { ...corsHeaders, "Content-Type": "application/json" };

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  if (req.method !== "POST") {
    return new Response(JSON.stringify({ error: "Method not allowed" }), { status: 405, headers: jsonHeaders });
  }

  try {
    const { locale, pages, force = false }: TranslateRequest = await req.json();

    // Validate
    if (!locale || !pages || Object.keys(pages).length === 0) {
      return new Response(
        JSON.stringify({ error: "Missing required fields: locale, pages" }),
        { status: 400, headers: jsonHeaders },
      );
    }

    if (!isValidLocaleCode(locale)) {
      return new Response(
        JSON.stringify({ error: `Invalid locale code: ${locale}` }),
        { status: 400, headers: jsonHeaders },
      );
    }

    const pageKeys = Object.keys(pages);
    const result: Record<string, { strings: Record<string, string>; cached: boolean }> = {};

    // Check which pages are already cached
    const uncachedPages: Record<string, Record<string, string>> = {};
    const sourceHashes: Record<string, string> = {};

    for (const pageKey of pageKeys) {
      const sourceHash = await hashStrings(pages[pageKey]);
      sourceHashes[pageKey] = sourceHash;

      if (!force) {
        const { data: cached } = await supabase
          .from("translations")
          .select("strings, overrides, source_hash")
          .eq("page_key", pageKey)
          .eq("locale", locale)
          .single();

        if (cached && cached.source_hash === sourceHash) {
          result[pageKey] = {
            strings: { ...cached.strings, ...cached.overrides },
            cached: true,
          };
          continue;
        }
      }

      uncachedPages[pageKey] = pages[pageKey];
    }

    // If everything was cached, return immediately
    if (Object.keys(uncachedPages).length === 0) {
      return new Response(
        JSON.stringify({ pages: result, cached: true }),
        { headers: jsonHeaders },
      );
    }

    // Merge ALL uncached strings into one flat object for a single Gemini call.
    // Prefix keys with page_key so we can split them back after translation.
    const mergedStrings: Record<string, string> = {};
    for (const [pageKey, strings] of Object.entries(uncachedPages)) {
      for (const [key, value] of Object.entries(strings)) {
        mergedStrings[`${pageKey}::${key}`] = value;
      }
    }

    // One Gemini call — consistent terminology across ALL pages
    const glossary = await getGlossary(locale);
    const translated = await translateWithGemini(mergedStrings, locale, glossary);

    // Split translated strings back into per-page objects
    const perPage: Record<string, Record<string, string>> = {};
    for (const [prefixedKey, value] of Object.entries(translated)) {
      const sepIdx = prefixedKey.indexOf("::");
      if (sepIdx === -1) continue;
      const pageKey = prefixedKey.substring(0, sepIdx);
      const key = prefixedKey.substring(sepIdx + 2);
      if (!perPage[pageKey]) perPage[pageKey] = {};
      perPage[pageKey][key] = value;
    }

    // Upsert each page into DB cache + merge overrides
    for (const pageKey of Object.keys(uncachedPages)) {
      const translatedStrings = perPage[pageKey] || {};

      const { error: upsertError } = await supabase
        .from("translations")
        .upsert(
          {
            page_key: pageKey,
            locale,
            strings: translatedStrings,
            source_hash: sourceHashes[pageKey],
            generated_by: TRANSLATION_MODEL,
            updated_at: new Date().toISOString(),
          },
          { onConflict: "page_key,locale" },
        );

      if (upsertError) console.error(`Upsert error for ${pageKey}:`, upsertError);

      // Merge overrides
      const { data: existing } = await supabase
        .from("translations")
        .select("overrides")
        .eq("page_key", pageKey)
        .eq("locale", locale)
        .single();

      const overrides = existing?.overrides || {};
      result[pageKey] = {
        strings: { ...translatedStrings, ...overrides },
        cached: false,
      };
    }

    return new Response(
      JSON.stringify({ pages: result, cached: false }),
      { headers: jsonHeaders },
    );
  } catch (err) {
    console.error("Translation error:", err);
    return new Response(
      JSON.stringify({ error: err.message }),
      { status: 500, headers: jsonHeaders },
    );
  }
});

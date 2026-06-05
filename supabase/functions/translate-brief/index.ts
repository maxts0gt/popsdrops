import { z } from "npm:zod@4.3.6";
import type { SupabaseClient } from "npm:@supabase/supabase-js@2.100.1";
import { requireUser } from "../_shared/auth.ts";
import { corsHeaders, json, methodNotAllowed } from "../_shared/json.ts";

const uuidLike = z
  .string()
  .regex(
    /^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/,
    "Invalid campaign ID format",
  );

const campaignRequestSchema = z.object({
  campaignId: uuidLike,
});

const briefFieldsSchema = z.object({
  description: z.string().optional(),
  requirements: z.string().optional(),
  dos: z.string().optional(),
  donts: z.string().optional(),
});

const previewRequestSchema = z.object({
  targetLocale: z
    .string()
    .regex(/^[a-z]{2}(?:-[A-Z]{2})?$/, "Invalid target locale"),
  briefFields: briefFieldsSchema,
});

const marketLocales: Record<string, string> = {
  ae: "ar",
  ar: "es",
  bh: "ar",
  br: "pt",
  cn: "zh",
  co: "es",
  de: "de",
  eg: "ar",
  es: "es",
  fr: "fr",
  hk: "zh",
  id: "id",
  in: "hi",
  iq: "ar",
  it: "it",
  jo: "ar",
  jp: "ja",
  ke: "sw",
  kr: "ko",
  kw: "ar",
  kz: "kk",
  ma: "fr",
  mx: "es",
  my: "ms",
  ng: "en",
  nl: "nl",
  om: "ar",
  ph: "tl",
  pl: "pl",
  qa: "ar",
  ro: "ro",
  ru: "ru",
  sa: "ar",
  th: "th",
  tr: "tr",
  tw: "zh",
  ua: "uk",
  uz: "uz",
  vn: "vi",
  za: "en",
};

function getTargetLocales(markets: string[] | null) {
  const locales = new Set<string>();

  for (const market of markets ?? []) {
    const locale = marketLocales[market.toLowerCase()];
    if (locale && locale !== "en") locales.add(locale);
  }

  return [...locales].sort();
}

function getBriefFields(campaign: {
  brief_description: string | null;
  brief_requirements: string | null;
  brief_dos: string | null;
  brief_donts: string | null;
}) {
  const fields: Record<string, string> = {};

  if (campaign.brief_description) fields.description = campaign.brief_description;
  if (campaign.brief_requirements) fields.requirements = campaign.brief_requirements;
  if (campaign.brief_dos) fields.dos = campaign.brief_dos;
  if (campaign.brief_donts) fields.donts = campaign.brief_donts;

  return fields;
}

function normalizeBriefFields(
  fields: Record<string, string | undefined>,
): Record<string, string> {
  return Object.fromEntries(
    Object.entries(fields).flatMap(([key, value]) => {
      const trimmedValue = value?.trim();
      return trimmedValue ? [[key, trimmedValue]] : [];
    }),
  );
}

function getExistingTranslations(value: unknown): Record<string, Record<string, string>> {
  if (!value || typeof value !== "object" || Array.isArray(value)) return {};

  return Object.fromEntries(
    Object.entries(value as Record<string, unknown>).flatMap(
      ([locale, translation]) => {
        if (!translation || typeof translation !== "object" || Array.isArray(translation)) {
          return [];
        }

        const fields = Object.fromEntries(
          Object.entries(translation as Record<string, unknown>).flatMap(
            ([field, fieldValue]) =>
              typeof fieldValue === "string" ? [[field, fieldValue]] : [],
          ),
        );

        return Object.keys(fields).length > 0 ? [[locale, fields]] : [];
      },
    ),
  );
}

function hasCompleteExistingTranslation(
  translation: Record<string, string> | undefined,
  briefFields: Record<string, string>,
): boolean {
  if (!translation) return false;

  return Object.keys(briefFields).every((field) =>
    Boolean(translation[field]?.trim()),
  );
}

function getReviewedTranslationFields(
  translation: Record<string, string> | undefined,
): Record<string, string> {
  if (!translation) return {};

  return Object.fromEntries(
    Object.entries(translation).filter(([, value]) => Boolean(value.trim())),
  );
}

async function getBrandWorkspaceForUser(client: SupabaseClient, userId: string) {
  const { data: profile, error: profileError } = await client
    .from("profiles")
    .select("role, status")
    .eq("id", userId)
    .maybeSingle();

  if (profileError) throw new Error(profileError.message);
  if (profile?.role !== "brand" || profile.status !== "approved") {
    throw new Error("Only brands can generate campaign language drafts");
  }

  const { data: ownedBrand, error: ownedBrandError } = await client
    .from("brand_profiles")
    .select("profile_id")
    .eq("profile_id", userId)
    .maybeSingle();

  if (ownedBrandError) throw new Error(ownedBrandError.message);
  if (ownedBrand) return { brandId: userId, role: "owner" };

  const { data: member, error: memberError } = await client
    .from("brand_team_members")
    .select("brand_id, role, accepted_at")
    .eq("user_id", userId)
    .not("accepted_at", "is", null)
    .order("created_at", { ascending: true })
    .limit(1)
    .maybeSingle();

  if (memberError) throw new Error(memberError.message);
  if (!member || !["owner", "admin", "manager"].includes(String(member.role))) {
    throw new Error("Only brands can generate campaign language drafts");
  }

  return { brandId: member.brand_id as string, role: member.role as string };
}

function stripJsonFence(text: string): string {
  return text
    .trim()
    .replace(/^```(?:json)?/i, "")
    .replace(/```$/i, "")
    .trim();
}

function parseTranslationPayload(text: string): Record<string, string> | null {
  try {
    const parsed = JSON.parse(stripJsonFence(text));
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) return null;

    return Object.fromEntries(
      Object.entries(parsed as Record<string, unknown>).flatMap(([key, value]) =>
        typeof value === "string" ? [[key, value]] : [],
      ),
    );
  } catch {
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (!jsonMatch) return null;

    try {
      const parsed = JSON.parse(jsonMatch[0]);
      if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) return null;

      return Object.fromEntries(
        Object.entries(parsed as Record<string, unknown>).flatMap(([key, value]) =>
          typeof value === "string" ? [[key, value]] : [],
        ),
      );
    } catch {
      return null;
    }
  }
}

async function translateFields(
  apiKey: string,
  locale: string,
  briefFields: Record<string, string>,
) {
  const localeName = new Intl.DisplayNames(["en"], { type: "language" }).of(locale) ?? locale;
  const prompt = [
    `Translate the following campaign brief fields to ${localeName}.`,
    "Return only a JSON object with the same keys and translated values.",
    "Keep brand names, platform names like TikTok and Instagram, and technical terms in English.",
    "Maintain original line breaks and bullet structure.",
    JSON.stringify(briefFields, null, 2),
  ].join("\n\n");

  const response = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${apiKey}`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        contents: [
          {
            role: "user",
            parts: [{ text: prompt }],
          },
        ],
        generationConfig: {
          response_mime_type: "application/json",
          temperature: 0.1,
        },
      }),
    },
  );

  if (!response.ok) {
    throw new Error(`Gemini translation failed with ${response.status}`);
  }

  const payload = (await response.json()) as {
    candidates?: Array<{
      content?: { parts?: Array<{ text?: string }> };
    }>;
  };
  const text =
    payload.candidates?.[0]?.content?.parts
      ?.map((part) => part.text)
      .filter(Boolean)
      .join("\n") ?? "";

  return parseTranslationPayload(text);
}

async function handlePreviewTranslation({
  targetLocale,
  briefFields,
  userId,
}: {
  targetLocale: string;
  briefFields: Record<string, string>;
  userId: string;
}) {
  if (targetLocale === "en") {
    return json({
      status: "skipped",
      reason: "English source does not require translation.",
      userId,
    });
  }

  if (Object.keys(briefFields).length === 0) {
    return json(
      { error: "Add at least one brief field before generating a draft.", userId },
      { status: 400 },
    );
  }

  const apiKey = Deno.env.get("GEMINI_API_KEY");
  if (!apiKey) {
    return json({
      status: "skipped",
      reason: "GEMINI_API_KEY is not configured.",
      userId,
    });
  }

  const translatedFields = await translateFields(apiKey, targetLocale, briefFields);
  if (!translatedFields || Object.keys(translatedFields).length === 0) {
    return json(
      { error: "No translation was returned.", userId },
      { status: 502 },
    );
  }

  return json({
    status: "preview_translated",
    locale: targetLocale,
    translation: translatedFields,
    userId,
  });
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  if (req.method !== "POST") {
    return methodNotAllowed();
  }

  let userId: string | null = null;

  try {
    const { client, user } = await requireUser(req);
    userId = user.id;
    const requestBody = await req.json();

    const previewParsed = previewRequestSchema.safeParse(requestBody);
    if (previewParsed.success) {
      await getBrandWorkspaceForUser(client, user.id);
      return await handlePreviewTranslation({
        targetLocale: previewParsed.data.targetLocale,
        briefFields: normalizeBriefFields(previewParsed.data.briefFields),
        userId,
      });
    }

    const parsed = campaignRequestSchema.safeParse(requestBody);
    if (!parsed.success) {
      return json(
        { error: parsed.error.issues[0]?.message ?? "Invalid request", userId },
        { status: 400 },
      );
    }

    const workspace = await getBrandWorkspaceForUser(client, user.id);

    const { data: campaign, error: campaignError } = await client
      .from("campaigns")
      .select(
        "id, brief_description, brief_requirements, brief_dos, brief_donts, brief_translated, markets",
      )
      .eq("id", parsed.data.campaignId)
      .eq("brand_id", workspace.brandId)
      .single();

    if (campaignError || !campaign) {
      return json({ error: "Campaign not found", userId }, { status: 404 });
    }

    const briefFields = getBriefFields(campaign);
    if (Object.keys(briefFields).length === 0) {
      return json({
        status: "skipped",
        reason: "Campaign has no brief fields to translate.",
        userId,
      });
    }

    const targetLocales = getTargetLocales(campaign.markets);
    const existingTranslations = getExistingTranslations(campaign.brief_translated);
    const missingTargetLocales = targetLocales.filter(
      (locale) => !hasCompleteExistingTranslation(existingTranslations[locale], briefFields),
    );

    if (targetLocales.length === 0) {
      return json({
        status: "skipped",
        reason: "Campaign target markets do not require dynamic translation.",
        userId,
      });
    }

    if (missingTargetLocales.length === 0) {
      return json({
        status: "already_translated",
        campaignId: campaign.id,
        locales: Object.keys(existingTranslations),
        failedLocales: [],
        userId,
      });
    }

    const apiKey = Deno.env.get("GEMINI_API_KEY");
    if (!apiKey) {
      return json({
        status: "skipped",
        reason: "GEMINI_API_KEY is not configured.",
        userId,
      });
    }

    const translated: Record<string, Record<string, string>> = {};
    const failedLocales: string[] = [];

    for (const locale of missingTargetLocales) {
      try {
        const translatedFields = await translateFields(apiKey, locale, briefFields);
        if (translatedFields && Object.keys(translatedFields).length > 0) {
          translated[locale] = translatedFields;
        } else {
          failedLocales.push(locale);
        }
      } catch (error) {
        failedLocales.push(locale);
        console.error(`[translate-brief] Failed for locale ${locale}:`, error);
      }
    }

    const translatedLocales = Object.keys(translated);
    if (translatedLocales.length === 0) {
      return json({
        status: "skipped",
        reason: "No translations were returned.",
        failedLocales,
        userId,
      });
    }

    const mergedTranslations = { ...existingTranslations };
    for (const [locale, translatedFields] of Object.entries(translated)) {
      mergedTranslations[locale] = {
        ...translatedFields,
        ...getReviewedTranslationFields(existingTranslations[locale]),
      };
    }

    const { error: updateError } = await client
      .from("campaigns")
      .update({ brief_translated: mergedTranslations })
      .eq("id", campaign.id)
      .eq("brand_id", workspace.brandId);

    if (updateError) throw new Error(updateError.message);

    return json({
      status: "translated",
      campaignId: campaign.id,
      locales: Object.keys(mergedTranslations),
      translatedLocales,
      failedLocales,
      userId,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Brief translation failed";
    const status =
      message === "Unauthorized"
        ? 401
        : message === "Only brands can generate campaign language drafts"
          ? 403
          : 500;

    return json({ error: message, userId }, { status });
  }
});

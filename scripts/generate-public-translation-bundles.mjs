#!/usr/bin/env node

import fs from "node:fs";
import path from "node:path";
import { createRequire } from "node:module";
import ts from "typescript";
import vm from "node:vm";
import { createClient } from "@supabase/supabase-js";

const repoRoot = process.cwd();
const require = createRequire(import.meta.url);
const generatedDir = path.join(
  repoRoot,
  "src/lib/i18n/generated/public-bundles",
);
const manifestPath = path.join(
  repoRoot,
  "src/lib/i18n/generated/public-translation-manifest.ts",
);
const localesPath = path.join(
  repoRoot,
  "src/lib/i18n/generated/public-translation-locales.ts",
);

function readDotEnvLocal() {
  const envPath = path.join(repoRoot, ".env.local");
  if (!fs.existsSync(envPath)) {
    return "";
  }

  return fs.readFileSync(envPath, "utf8");
}

function readEnv(name, envText) {
  const fromProcess = process.env[name];
  if (fromProcess) {
    return fromProcess;
  }

  const match = envText.match(new RegExp(`^${name}=(.*)$`, "m"));
  if (!match) {
    return null;
  }

  return match[1].replace(/^['"]|['"]$/g, "");
}

function loadTsModule(relativePath) {
  const fullPath = path.join(repoRoot, relativePath);
  const source = fs.readFileSync(fullPath, "utf8");
  const compiled = ts.transpileModule(source, {
    compilerOptions: {
      module: ts.ModuleKind.CommonJS,
      target: ts.ScriptTarget.ES2020,
    },
  }).outputText;
  const sandbox = {
    module: { exports: {} },
    require,
    console,
  };
  sandbox.exports = sandbox.module.exports;

  vm.createContext(sandbox);
  vm.runInContext(compiled, sandbox);

  return sandbox.module.exports;
}

function parseArgs(argv) {
  const options = {
    locales: null,
    model: null,
  };

  for (const arg of argv) {
    if (arg.startsWith("--locales=")) {
      options.locales = arg
        .slice("--locales=".length)
        .split(",")
        .map((value) => value.trim())
        .filter(Boolean);
    } else if (arg.startsWith("--model=")) {
      options.model = arg.slice("--model=".length).trim();
    }
  }

  return options;
}

async function loadGlossary(url, key, locale) {
  if (!url || !key) {
    return {};
  }

  const supabase = createClient(url, key, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });

  const { data, error } = await supabase
    .from("translation_glossary")
    .select("term, translation")
    .eq("locale", locale);

  if (error || !data) {
    return {};
  }

  return Object.fromEntries(data.map((row) => [row.term, row.translation]));
}

function buildPrompt(localeName, glossary, bundle) {
  const glossaryText = Object.entries(glossary)
    .map(([en, translated]) => `  "${en}" -> "${translated}"`)
    .join("\n");

  return `You are a native ${localeName} copywriter localizing the public marketing surface of a premium global influencer marketing platform called PopsDrops.

Translate the following UI copy into natural, fluent ${localeName}. Do not translate literally. Write how a high-end B2B SaaS product would sound to a native speaker.

Rules:
- Return valid JSON only
- Preserve the exact object shape and keys
- Keep brand and platform names in English: PopsDrops, TikTok, Instagram, Snapchat, YouTube
- Keep technical acronyms in English when common: CPM, CPE, ROI
- Be concise on buttons and labels
- Headlines should feel premium, not generic
- Keep terminology consistent across every page

${glossaryText ? `Glossary:\n${glossaryText}\n` : ""}JSON TO LOCALIZE:
${JSON.stringify(bundle, null, 2)}`;
}

function validateBundleShape(bundle, candidate) {
  if (!candidate || typeof candidate !== "object" || Array.isArray(candidate)) {
    throw new Error("Generated bundle is not a JSON object");
  }

  const expectedPageKeys = Object.keys(bundle).sort();
  const actualPageKeys = Object.keys(candidate).sort();

  if (
    expectedPageKeys.length !== actualPageKeys.length ||
    expectedPageKeys.some((pageKey, index) => pageKey !== actualPageKeys[index])
  ) {
    throw new Error("Generated bundle page keys do not match the source bundle");
  }

  for (const pageKey of expectedPageKeys) {
    const expectedStrings = bundle[pageKey];
    const actualStrings = candidate[pageKey];

    if (!actualStrings || typeof actualStrings !== "object" || Array.isArray(actualStrings)) {
      throw new Error(`Generated page "${pageKey}" is not an object`);
    }

    const expectedKeys = Object.keys(expectedStrings).sort();
    const actualKeys = Object.keys(actualStrings).sort();

    if (
      expectedKeys.length !== actualKeys.length ||
      expectedKeys.some((key, index) => key !== actualKeys[index])
    ) {
      throw new Error(`Generated page "${pageKey}" keys do not match the source page`);
    }

    for (const key of actualKeys) {
      if (typeof actualStrings[key] !== "string") {
        throw new Error(`Generated value for "${pageKey}.${key}" is not a string`);
      }
    }
  }
}

async function translateBundle({ apiKey, model, locale, localeName, glossary, bundle }) {
  let lastError = null;

  for (let attempt = 1; attempt <= 3; attempt += 1) {
    try {
      const response = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            contents: [{ parts: [{ text: buildPrompt(localeName, glossary, bundle) }] }],
            generationConfig: {
              temperature: 0,
              responseMimeType: "application/json",
            },
          }),
        },
      );

      if (!response.ok) {
        const error = await response.text();
        throw new Error(`Gemini API error for ${locale}: ${response.status} ${error}`);
      }

      const data = await response.json();
      const text = data.candidates?.[0]?.content?.parts?.[0]?.text;
      if (!text) {
        throw new Error(`Empty Gemini response for ${locale}`);
      }

      try {
        const parsed = JSON.parse(text);
        validateBundleShape(bundle, parsed);
        return parsed;
      } catch (parseError) {
        const jsonStart = text.indexOf("{");
        const jsonEnd = text.lastIndexOf("}");
        if (jsonStart !== -1 && jsonEnd !== -1 && jsonEnd > jsonStart) {
          const parsed = JSON.parse(text.slice(jsonStart, jsonEnd + 1));
          validateBundleShape(bundle, parsed);
          return parsed;
        }
        throw parseError;
      }
    } catch (error) {
      lastError = error;
      console.warn(
        `Gemini bundle generation attempt ${attempt} failed for ${locale}: ${
          error instanceof Error ? error.message : String(error)
        }`,
      );
    }
  }

  throw lastError;
}

function writeBundleJson(locale, bundle) {
  fs.mkdirSync(generatedDir, { recursive: true });
  const outputPath = path.join(generatedDir, `${locale}.json`);
  fs.writeFileSync(outputPath, `${JSON.stringify(bundle, null, 2)}\n`);
}

function writeManifest(locales) {
  const importLines = locales.map(
    (locale) =>
      `import ${locale.replace(/[^a-z0-9]/gi, "_")} from "./public-bundles/${locale}.json";`,
  );
  const bundleLines = locales.map(
    (locale) =>
      `  "${locale}": ${locale.replace(/[^a-z0-9]/gi, "_")},`,
  );

  const output = `import type { PageKey } from "../strings";

export type PublicTranslationBundle = Partial<
  Record<PageKey, Record<string, string>>
>;

${importLines.join("\n")}

export const PUBLIC_TRANSLATION_BUNDLES: Partial<
  Record<string, PublicTranslationBundle>
> = {
${bundleLines.join("\n")}
};
`;

  fs.writeFileSync(manifestPath, output);

  const localesOutput = `export const PUBLIC_TRANSLATION_LOCALES = [
${locales.map((locale) => `  "${locale}",`).join("\n")}
] as const;

export type PublicTranslationLocale =
  (typeof PUBLIC_TRANSLATION_LOCALES)[number];
`;

  fs.writeFileSync(localesPath, localesOutput);
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const envText = readDotEnvLocal();
  const apiKey = readEnv("GEMINI_API_KEY", envText);
  const serviceRoleKey = readEnv("SUPABASE_SERVICE_ROLE_KEY", envText);
  const supabaseUrl = readEnv("NEXT_PUBLIC_SUPABASE_URL", envText);
  const model =
    args.model ||
    readEnv("PUBLIC_TRANSLATION_MODEL", envText) ||
    "gemini-3.1-pro-preview";

  const stringsModule = loadTsModule("src/lib/i18n/strings.ts");
  const configModule = loadTsModule("src/lib/i18n/public-bundle-config.ts");
  const strings = stringsModule.strings;
  const localeDisplayNames = stringsModule.LOCALE_DISPLAY_NAMES;
  const supportedLocales = stringsModule.SUPPORTED_LOCALES;
  const pageKeys = configModule.PUBLIC_BUNDLE_PAGE_KEYS;

  const sourceBundle = Object.fromEntries(
    pageKeys.map((pageKey) => [pageKey, strings[pageKey]]),
  );

  const locales = args.locales ?? supportedLocales;
  const requiresGemini = locales.some((locale) => locale !== "en");

  if (requiresGemini && !apiKey) {
    throw new Error(
      "Missing GEMINI_API_KEY. Add it to .env.local or the process environment before generating non-English bundles.",
    );
  }

  const generatedLocales = [];

  for (const locale of locales) {
    if (locale === "en") {
      writeBundleJson(locale, sourceBundle);
      generatedLocales.push(locale);
      continue;
    }

    const localeName = localeDisplayNames[locale] ?? locale;
    const glossary = await loadGlossary(supabaseUrl, serviceRoleKey, locale);
    const translated = await translateBundle({
      apiKey,
      model,
      locale,
      localeName,
      glossary,
      bundle: sourceBundle,
    });

    writeBundleJson(locale, translated);
    generatedLocales.push(locale);
    console.log(`Generated public bundle for ${locale}`);
  }

  writeManifest(generatedLocales);
  console.log(
    `Wrote ${generatedLocales.length} public locale bundles with model ${model}.`,
  );
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});

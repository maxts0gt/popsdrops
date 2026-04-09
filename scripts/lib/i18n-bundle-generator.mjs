import fs from "node:fs";
import path from "node:path";
import { execFileSync } from "node:child_process";
import ts from "typescript";
import vm from "node:vm";
import { createClient } from "@supabase/supabase-js";

let cachedGeminiHostIp = null;

export function parseArgs(argv) {
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

function readDotEnvLocal(repoRoot) {
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

function loadTsModule(repoRoot, relativePath) {
  const fullPath = path.join(repoRoot, relativePath);
  const source = fs.readFileSync(fullPath, "utf8");
  const compiled = ts.transpileModule(source, {
    compilerOptions: {
      module: ts.ModuleKind.CommonJS,
      target: ts.ScriptTarget.ES2020,
    },
  }).outputText;
  const localRequire = createRequire(fullPath);
  const sandbox = {
    module: { exports: {} },
    require: localRequire,
    console,
  };
  sandbox.exports = sandbox.module.exports;

  vm.createContext(sandbox);
  vm.runInContext(compiled, sandbox);

  return sandbox.module.exports;
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

async function resolveGeminiHostIp() {
  if (cachedGeminiHostIp) {
    return cachedGeminiHostIp;
  }

  const response = await fetch(
    "https://dns.google/resolve?name=generativelanguage.googleapis.com&type=A",
  );
  if (!response.ok) {
    throw new Error(`DNS-over-HTTPS lookup failed: ${response.status}`);
  }

  const data = await response.json();
  const ip = data.Answer?.find((answer) => typeof answer.data === "string")?.data;

  if (!ip) {
    throw new Error("DNS-over-HTTPS lookup returned no A records for Gemini");
  }

  cachedGeminiHostIp = ip;
  return ip;
}

async function postGeminiRequest(url, payload) {
  try {
    return await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(payload),
    });
  } catch (error) {
    const cause = error instanceof Error && "cause" in error ? error.cause : null;
    const code = typeof cause === "object" && cause && "code" in cause ? cause.code : null;

    if (code !== "ENOTFOUND") {
      throw error;
    }

    const ip = await resolveGeminiHostIp();
    const body = execFileSync(
      "curl",
      [
        "--silent",
        "--show-error",
        "--fail",
        "--resolve",
        `generativelanguage.googleapis.com:443:${ip}`,
        "-H",
        "Content-Type: application/json",
        "-X",
        "POST",
        "-d",
        JSON.stringify(payload),
        url,
      ],
      { encoding: "utf8" },
    );

    return new Response(body, {
      status: 200,
      headers: {
        "Content-Type": "application/json",
      },
    });
  }
}

function validateObjectBundleShape(bundle, candidate) {
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

function validateFlatBundleShape(bundle, candidate) {
  if (!candidate || typeof candidate !== "object" || Array.isArray(candidate)) {
    throw new Error("Generated mobile bundle is not a JSON object");
  }

  const expectedKeys = Object.keys(bundle).sort();
  const actualKeys = Object.keys(candidate).sort();

  if (
    expectedKeys.length !== actualKeys.length ||
    expectedKeys.some((key, index) => key !== actualKeys[index])
  ) {
    throw new Error("Generated mobile bundle keys do not match the source bundle");
  }

  for (const key of actualKeys) {
    if (typeof candidate[key] !== "string") {
      throw new Error(`Generated mobile value for "${key}" is not a string`);
    }
  }
}

function chunkBundle(bundle, chunkSize) {
  if (!chunkSize || chunkSize <= 0) {
    return [bundle];
  }

  const entries = Object.entries(bundle);
  const chunks = [];

  for (let index = 0; index < entries.length; index += chunkSize) {
    chunks.push(Object.fromEntries(entries.slice(index, index + chunkSize)));
  }

  return chunks;
}

function buildPrompt(target, localeName, glossary, bundle) {
  const glossaryText = Object.entries(glossary)
    .map(([en, translated]) => `  "${en}" -> "${translated}"`)
    .join("\n");

  const targetPrompts = {
    public:
      "You are a native copywriter localizing the public marketing surface of a premium global influencer marketing platform called PopsDrops.",
    platform:
      "You are a native product copywriter localizing the signed-in web interface of PopsDrops, a premium global influencer marketing platform used by brands and vetted creators.",
    mobile:
      "You are a native mobile product copywriter localizing the creator app for PopsDrops, a premium global influencer marketing platform.",
  };

  const toneRules = {
    public: [
      "Write how a high-end B2B SaaS product would sound to a native speaker.",
      "Headlines should feel premium, not generic.",
      "Marketing copy should stay polished and concise.",
    ],
    platform: [
      "Prefer clear, calm product language over literal translation.",
      "Buttons, toasts, forms, and empty states should read like a polished production app.",
      "Keep terminology consistent across brand and creator workflows.",
    ],
    mobile: [
      "Prefer short, natural mobile UI copy.",
      "Buttons, tabs, and alerts should feel crisp and native.",
      "Keep the tone premium and clear, never robotic.",
    ],
  };

  return `${targetPrompts[target]}

Translate the following UI copy into natural, fluent ${localeName}. Do not translate literally.

Rules:
- Return valid JSON only
- Preserve the exact object shape and keys
- Keep brand and platform names in English: PopsDrops, TikTok, Instagram, Snapchat, YouTube, Facebook
- Keep technical acronyms in English when common: CPM, CPE, ROI
- Be concise on buttons and labels
- Numbers, variables, and placeholders must stay intact
- ${toneRules[target].join("\n- ")}

${glossaryText ? `Glossary:\n${glossaryText}\n` : ""}JSON TO LOCALIZE:
${JSON.stringify(bundle, null, 2)}`;
}

async function translateBundle({ apiKey, model, locale, localeName, glossary, bundle, target }) {
  let lastError = null;
  const fallbackModel =
    model === "gemini-3.1-pro-preview" ? null : "gemini-3.1-pro-preview";
  const modelsToTry = [model, fallbackModel].filter(Boolean);

  for (const modelName of modelsToTry) {
    const maxAttempts =
      modelName === model
        ? (fallbackModel ? 1 : 3)
        : 1;

    for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
      try {
        const response = await postGeminiRequest(
          `https://generativelanguage.googleapis.com/v1beta/models/${modelName}:generateContent?key=${apiKey}`,
          {
            contents: [{ parts: [{ text: buildPrompt(target, localeName, glossary, bundle) }] }],
            generationConfig: {
              temperature: 0,
              responseMimeType: "application/json",
            },
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
          if (target === "mobile") {
            validateFlatBundleShape(bundle, parsed);
          } else {
            validateObjectBundleShape(bundle, parsed);
          }
          return parsed;
        } catch (parseError) {
          const jsonStart = text.indexOf("{");
          const jsonEnd = text.lastIndexOf("}");
          if (jsonStart !== -1 && jsonEnd !== -1 && jsonEnd > jsonStart) {
            const parsed = JSON.parse(text.slice(jsonStart, jsonEnd + 1));
            if (target === "mobile") {
              validateFlatBundleShape(bundle, parsed);
            } else {
              validateObjectBundleShape(bundle, parsed);
            }
            return parsed;
          }
          throw parseError;
        }
      } catch (error) {
        lastError = error;
        console.warn(
          `Gemini bundle generation attempt ${attempt} failed for ${target}:${locale} with ${modelName}: ${
            error instanceof Error ? error.message : String(error)
          }`,
        );
      }
    }
  }

  throw lastError;
}

function writeBundleJson(outputDir, locale, bundle) {
  fs.mkdirSync(outputDir, { recursive: true });
  const outputPath = path.join(outputDir, `${locale}.json`);
  fs.writeFileSync(outputPath, `${JSON.stringify(bundle, null, 2)}\n`);
}

function buildTargetConfig(repoRoot, target) {
  const stringsModule = loadTsModule(repoRoot, "src/lib/i18n/strings.ts");
  const localeDisplayNames = stringsModule.LOCALE_DISPLAY_NAMES;
  const supportedLocales = stringsModule.SUPPORTED_LOCALES;

  if (target === "public") {
    const configModule = loadTsModule(repoRoot, "src/lib/i18n/public-bundle-config.ts");
    const sourceStrings = stringsModule.strings;
    const pageKeys = configModule.PUBLIC_BUNDLE_PAGE_KEYS;

    return {
      localeDisplayNames,
      supportedLocales,
      sourceBundle: Object.fromEntries(
        pageKeys.map((pageKey) => [pageKey, sourceStrings[pageKey]]),
      ),
      generatedDir: path.join(repoRoot, "src/lib/i18n/generated/public-bundles"),
      manifestPath: path.join(repoRoot, "src/lib/i18n/generated/public-translation-manifest.ts"),
      localesPath: path.join(repoRoot, "src/lib/i18n/generated/public-translation-locales.ts"),
      typeName: "PublicTranslationBundle",
      typeImportPath: "../strings",
      manifestImportPrefix: "./public-bundles",
      bundleVarName: "PUBLIC_TRANSLATION_BUNDLES",
      localesVarName: "PUBLIC_TRANSLATION_LOCALES",
      defaultModelEnv: "PUBLIC_TRANSLATION_MODEL",
      includePageKeyType: true,
      chunkSize: 8,
    };
  }

  if (target === "platform") {
    const sourceStrings = stringsModule.strings;
    const pageKeys = Object.keys(sourceStrings);

    return {
      localeDisplayNames,
      supportedLocales,
      sourceBundle: Object.fromEntries(
        pageKeys.map((pageKey) => [pageKey, sourceStrings[pageKey]]),
      ),
      generatedDir: path.join(repoRoot, "src/lib/i18n/generated/platform-bundles"),
      manifestPath: path.join(repoRoot, "src/lib/i18n/generated/platform-translation-manifest.ts"),
      localesPath: path.join(repoRoot, "src/lib/i18n/generated/platform-translation-locales.ts"),
      typeName: "PlatformTranslationBundle",
      typeImportPath: "../strings",
      manifestImportPrefix: "./platform-bundles",
      bundleVarName: "PLATFORM_TRANSLATION_BUNDLES",
      localesVarName: "PLATFORM_TRANSLATION_LOCALES",
      defaultModelEnv: "PLATFORM_TRANSLATION_MODEL",
      includePageKeyType: true,
      chunkSize: 5,
    };
  }

  if (target === "mobile") {
    const mobileStringsModule = loadTsModule(repoRoot, "mobile/lib/strings.ts");
    const sourceBundle = {};

    for (const section of Object.values(mobileStringsModule.strings)) {
      Object.assign(sourceBundle, section);
    }

    return {
      localeDisplayNames,
      supportedLocales,
      sourceBundle,
      generatedDir: path.join(repoRoot, "mobile/lib/generated/mobile-bundles"),
      manifestPath: path.join(repoRoot, "mobile/lib/generated/mobile-translation-manifest.ts"),
      localesPath: path.join(repoRoot, "mobile/lib/generated/mobile-translation-locales.ts"),
      typeName: "MobileTranslationBundle",
      typeImportPath: null,
      manifestImportPrefix: "./mobile-bundles",
      bundleVarName: "MOBILE_TRANSLATION_BUNDLES",
      localesVarName: "MOBILE_TRANSLATION_LOCALES",
      defaultModelEnv: "MOBILE_TRANSLATION_MODEL",
      includePageKeyType: false,
      chunkSize: 120,
    };
  }

  throw new Error(`Unsupported translation bundle target: ${target}`);
}

function writeManifest(targetConfig, locales) {
  const importLines = locales.map(
    (locale) =>
      `import ${locale.replace(/[^a-z0-9]/gi, "_")} from "${targetConfig.manifestImportPrefix}/${locale}.json";`,
  );
  const bundleLines = locales.map(
    (locale) =>
      `  "${locale}": ${locale.replace(/[^a-z0-9]/gi, "_")},`,
  );

  const typeBlock = targetConfig.includePageKeyType
    ? `import type { PageKey } from "${targetConfig.typeImportPath}";

export type ${targetConfig.typeName} = Partial<
  Record<PageKey, Record<string, string>>
>;
`
    : `export type ${targetConfig.typeName} = Record<string, string>;
`;

  const output = `${typeBlock}
${importLines.join("\n")}

export const ${targetConfig.bundleVarName}: Partial<
  Record<string, ${targetConfig.typeName}>
> = {
${bundleLines.join("\n")}
};
`;

  fs.writeFileSync(targetConfig.manifestPath, output);

  const localesOutput = `export const ${targetConfig.localesVarName} = [
${locales.map((locale) => `  "${locale}",`).join("\n")}
] as const;

export type ${targetConfig.typeName.replace("Bundle", "Locale")} =
  (typeof ${targetConfig.localesVarName})[number];
`;

  fs.writeFileSync(targetConfig.localesPath, localesOutput);
}

function listGeneratedLocales(outputDir) {
  if (!fs.existsSync(outputDir)) {
    return [];
  }

  return fs
    .readdirSync(outputDir)
    .filter((filename) => filename.endsWith(".json"))
    .map((filename) => filename.replace(/\.json$/u, ""))
    .sort();
}

export async function generateBundles({ repoRoot, target, argv }) {
  const args = parseArgs(argv);
  const envText = readDotEnvLocal(repoRoot);
  const apiKey = readEnv("GEMINI_API_KEY", envText);
  const serviceRoleKey = readEnv("SUPABASE_SERVICE_ROLE_KEY", envText);
  const supabaseUrl = readEnv("NEXT_PUBLIC_SUPABASE_URL", envText);
  const targetConfig = buildTargetConfig(repoRoot, target);
  const model =
    args.model ||
    readEnv(targetConfig.defaultModelEnv, envText) ||
    readEnv("PUBLIC_TRANSLATION_MODEL", envText) ||
    "gemini-3.1-pro-preview";

  const locales = args.locales ?? targetConfig.supportedLocales;
  const requiresGemini = locales.some((locale) => locale !== "en");

  if (requiresGemini && !apiKey) {
    throw new Error(
      "Missing GEMINI_API_KEY. Add it to .env.local or the process environment before generating non-English bundles.",
    );
  }

  const generatedLocales = [];

  for (const locale of locales) {
    if (locale === "en") {
      writeBundleJson(targetConfig.generatedDir, locale, targetConfig.sourceBundle);
      generatedLocales.push(locale);
      continue;
    }

    const localeName = targetConfig.localeDisplayNames[locale] ?? locale;
    const glossary = await loadGlossary(supabaseUrl, serviceRoleKey, locale);
    const sourceChunks = chunkBundle(targetConfig.sourceBundle, targetConfig.chunkSize);
    console.log(`Generating ${target} bundle for ${locale} in ${sourceChunks.length} chunk(s)`);
    const translatedChunks = await Promise.all(
      sourceChunks.map((bundleChunk) =>
        translateBundle({
          apiKey,
          model,
          locale,
          localeName,
          glossary,
          bundle: bundleChunk,
          target,
        }),
      ),
    );
    const translated = Object.assign({}, ...translatedChunks);

    writeBundleJson(targetConfig.generatedDir, locale, translated);
    generatedLocales.push(locale);
    console.log(`Generated ${target} bundle for ${locale}`);
  }

  writeManifest(targetConfig, listGeneratedLocales(targetConfig.generatedDir));
  console.log(
    `Wrote ${generatedLocales.length} ${target} locale bundles with model ${model}.`,
  );
}

import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const requiredEnvVars = [
  "EXPO_PUBLIC_SUPABASE_URL",
  "EXPO_PUBLIC_SUPABASE_ANON_KEY",
];

function readMetadataSection(source, heading) {
  const pattern = new RegExp(
    `## ${heading.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\n([\\s\\S]*?)(?=\\n## |$)`,
  );
  const match = source.match(pattern);

  return match?.[1].trim() ?? "";
}

function validateStoreMetadata(source) {
  const issues = [];
  const subtitle = readMetadataSection(source, "Subtitle (iOS, 30 chars max)");
  const shortDescription = readMetadataSection(
    source,
    "Short Description (Android, 80 chars max)",
  );
  const fullDescription = readMetadataSection(
    source,
    "Full Description (Both Stores)",
  );
  const keywords = readMetadataSection(source, "Keywords (iOS, 100 chars max)");
  const bannedPublicClaims = [
    { pattern: /\bMVP\b/i, label: "MVP" },
    { pattern: /\bbeta\b/i, label: "beta" },
    { pattern: /\bAI-powered\b/i, label: "AI-powered" },
    { pattern: /\bmarketplace\b/i, label: "marketplace" },
    { pattern: /\bMENA\b/i, label: "MENA" },
    { pattern: /\bHermes\b/i, label: "Hermes" },
    { pattern: /\bChanel\b/i, label: "Chanel" },
    { pattern: /\bBLACKPINK\b/i, label: "BLACKPINK" },
    { pattern: /\bBlackPink\b/i, label: "BlackPink" },
    { pattern: /\bMessi\b/i, label: "Messi" },
    { pattern: /\bRonaldo\b/i, label: "Ronaldo" },
    { pattern: /\bAnna Hathaway\b/i, label: "Anna Hathaway" },
    { pattern: /\bNatalie Portman\b/i, label: "Natalie Portman" },
    { pattern: /\bDior\b/i, label: "Dior" },
  ];
  const requiredSignals = [
    { pattern: /private campaign/i, label: "private campaign" },
    { pattern: /translated briefs/i, label: "translated briefs" },
    { pattern: /performance proof/i, label: "performance proof" },
    { pattern: /payment status/i, label: "payment status" },
    { pattern: /free for creators/i, label: "free for creators" },
  ];

  if (subtitle.length === 0 || subtitle.length > 30) {
    issues.push("Subtitle must be present and 30 characters or fewer.");
  }

  if (shortDescription.length === 0 || shortDescription.length > 80) {
    issues.push("Android short description must be present and 80 characters or fewer.");
  }

  if (keywords.length === 0 || keywords.length > 100) {
    issues.push("iOS keywords must be present and 100 characters or fewer.");
  }

  for (const claim of bannedPublicClaims) {
    if (claim.pattern.test(source)) {
      issues.push(`Public store metadata must not include "${claim.label}".`);
    }
  }

  for (const signal of requiredSignals) {
    if (!signal.pattern.test(fullDescription)) {
      issues.push(`Full description must include "${signal.label}".`);
    }
  }

  return issues;
}

function validateStoreUrls(source) {
  const issues = [];
  const expectedUrls = {
    "Privacy Policy URL": "https://popsdrops.com/privacy",
    "Terms of Service URL": "https://popsdrops.com/terms",
    "Support URL": "https://popsdrops.com/support",
    "Marketing URL": "https://popsdrops.com",
  };

  for (const [heading, expectedUrl] of Object.entries(expectedUrls)) {
    const actualUrl = readMetadataSection(source, heading);

    if (actualUrl !== expectedUrl) {
      issues.push(`${heading} must be ${expectedUrl}.`);
      continue;
    }

    try {
      const parsedUrl = new URL(actualUrl);

      if (parsedUrl.protocol !== "https:") {
        issues.push(`${heading} must use HTTPS.`);
      }
    } catch {
      issues.push(`${heading} must be a valid URL.`);
    }
  }

  return issues;
}

function validateStoreScreenshotManifest(
  manifest,
  { outputDirectory = "output/android/store-screenshots" } = {},
) {
  const issues = [];
  const expectedIds = [
    "01-login",
    "02-home",
    "03-invites",
    "04-campaign-detail",
    "05-profile",
  ];

  if (manifest?.outputDirectory !== outputDirectory) {
    issues.push(`Screenshot output directory must be ${outputDirectory}.`);
  }

  if (!Array.isArray(manifest?.screens) || manifest.screens.length !== 5) {
    issues.push("Screenshot manifest must include exactly five screens.");
  }

  const actualIds = manifest.screens.map((screen) => screen.id);
  if (actualIds.join(",") !== expectedIds.join(",")) {
    issues.push("Screenshot manifest screen order must match the store story.");
  }

  for (const screen of manifest.screens) {
    if (!/^\d{2}-[a-z-]+\.png$/.test(screen.file ?? "")) {
      issues.push(`Screen ${screen.id ?? "(missing id)"} file must be a numbered png.`);
    }

    if (!String(screen.route ?? "").startsWith("/")) {
      issues.push(`Screen ${screen.id ?? "(missing id)"} route must start with /.`);
    }

    if (!existsSync(path.join(mobileRoot, screen.routeFile ?? ""))) {
      issues.push(`Screen ${screen.id ?? "(missing id)"} route file does not exist.`);
    }

    if (
      !Array.isArray(screen.requiredText) ||
      screen.requiredText.length < 2
    ) {
      issues.push(`Screen ${screen.id ?? "(missing id)"} needs at least two proof labels.`);
    }
  }

  return issues;
}

function parseEnvFile(filePath) {
  if (!existsSync(filePath)) {
    return {};
  }

  return readFileSync(filePath, "utf8")
    .split(/\r?\n/)
    .reduce((accumulator, line) => {
      const trimmed = line.trim();

      if (!trimmed || trimmed.startsWith("#")) {
        return accumulator;
      }

      const separatorIndex = trimmed.indexOf("=");

      if (separatorIndex === -1) {
        return accumulator;
      }

      const key = trimmed.slice(0, separatorIndex).trim();
      const rawValue = trimmed.slice(separatorIndex + 1).trim();
      const value = rawValue.replace(/^['"]|['"]$/g, "");

      accumulator[key] = value;
      return accumulator;
    }, {});
}

const scriptDirectory = path.dirname(fileURLToPath(import.meta.url));
const mobileRoot = path.resolve(scriptDirectory, "..");

const envFiles = [
  ".env",
  ".env.local",
  ".env.production",
  ".env.production.local",
];

const fileEnvironment = envFiles.reduce((accumulator, filename) => {
  const filePath = path.join(mobileRoot, filename);

  return {
    ...accumulator,
    ...parseEnvFile(filePath),
  };
}, {});

const resolvedEnvironment = {
  ...fileEnvironment,
  ...process.env,
};

const missing = requiredEnvVars.filter((key) => {
  const value = resolvedEnvironment[key];

  return typeof value !== "string" || value.trim().length === 0;
});

if (missing.length > 0) {
  console.error(
    [
      "Mobile release check failed.",
      "Missing required environment variables:",
      ...missing.map((key) => `- ${key}`),
    ].join("\n"),
  );
  process.exit(1);
}

const appConfigPath = path.join(mobileRoot, "app.json");
const appConfig = JSON.parse(readFileSync(appConfigPath, "utf8"));
const storeMetadataPath = path.join(mobileRoot, "store-metadata.md");
const storeMetadata = readFileSync(storeMetadataPath, "utf8");
const storeMetadataIssues = validateStoreMetadata(
  storeMetadata,
);
const storeUrlIssues = validateStoreUrls(storeMetadata);
const storeScreenshotManifestPath = path.join(
  mobileRoot,
  "store-screenshot-manifest.json",
);
const storeScreenshotManifestIssues = validateStoreScreenshotManifest(
  JSON.parse(readFileSync(storeScreenshotManifestPath, "utf8")),
);
const iosStoreScreenshotManifestPath = path.join(
  mobileRoot,
  "store-screenshot-manifest.ios.json",
);
const iosStoreScreenshotManifestIssues = validateStoreScreenshotManifest(
  JSON.parse(readFileSync(iosStoreScreenshotManifestPath, "utf8")),
  { outputDirectory: "output/ios/store-screenshots" },
);

const missingFields = [];

if (!appConfig?.expo?.scheme) {
  missingFields.push("expo.scheme");
}

if (!appConfig?.expo?.ios?.bundleIdentifier) {
  missingFields.push("expo.ios.bundleIdentifier");
}

if (!appConfig?.expo?.android?.package) {
  missingFields.push("expo.android.package");
}

if (missingFields.length > 0) {
  console.error(
    [
      "Mobile release check failed.",
      "Missing required app metadata:",
      ...missingFields.map((key) => `- ${key}`),
    ].join("\n"),
  );
  process.exit(1);
}

if (storeMetadataIssues.length > 0) {
  console.error(
    [
      "Mobile release check failed.",
      "Store metadata is not release-ready:",
      ...storeMetadataIssues.map((issue) => `- ${issue}`),
    ].join("\n"),
  );
  process.exit(1);
}

if (storeUrlIssues.length > 0) {
  console.error(
    [
      "Mobile release check failed.",
      "Store URLs are not release-ready:",
      ...storeUrlIssues.map((issue) => `- ${issue}`),
    ].join("\n"),
  );
  process.exit(1);
}

if (storeScreenshotManifestIssues.length > 0) {
  console.error(
    [
      "Mobile release check failed.",
      "Store screenshot manifest is not release-ready:",
      ...storeScreenshotManifestIssues.map((issue) => `- ${issue}`),
    ].join("\n"),
  );
  process.exit(1);
}

if (iosStoreScreenshotManifestIssues.length > 0) {
  console.error(
    [
      "Mobile release check failed.",
      "iOS store screenshot manifest is not release-ready:",
      ...iosStoreScreenshotManifestIssues.map((issue) => `- ${issue}`),
    ].join("\n"),
  );
  process.exit(1);
}

console.log("Mobile release check passed.");

import { createSign } from "node:crypto";
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

import { readLocalSubmitEnvironment } from "./production-submit-check.mjs";
import { readProductionBuildArtifactStatus } from "./production-build-artifact-check.mjs";

const APPLE_PROCESSING_STATES = new Set(["PROCESSING"]);
const APPLE_FAILED_STATES = new Set(["FAILED", "INVALID"]);
const ANDROID_PUBLISHER_SCOPE = "https://www.googleapis.com/auth/androidpublisher";

function readJson(filePath) {
  return JSON.parse(readFileSync(filePath, "utf8"));
}

function base64Url(value) {
  return Buffer.from(value).toString("base64url");
}

function signJwt({ header, payload, privateKey, algorithm, dsaEncoding }) {
  const signingInput = `${base64Url(JSON.stringify(header))}.${base64Url(
    JSON.stringify(payload),
  )}`;
  const signer = createSign(algorithm);

  signer.update(signingInput);
  signer.end();

  const signature = signer.sign(
    dsaEncoding ? { key: privateKey, dsaEncoding } : privateKey,
  );

  return `${signingInput}.${signature.toString("base64url")}`;
}

function createAppStoreConnectToken({
  issuerId,
  keyId,
  privateKey,
  nowSeconds = Math.floor(Date.now() / 1000),
}) {
  return signJwt({
    header: {
      alg: "ES256",
      kid: keyId,
      typ: "JWT",
    },
    payload: {
      aud: "appstoreconnect-v1",
      exp: nowSeconds + 20 * 60,
      iat: nowSeconds,
      iss: issuerId,
    },
    privateKey,
    algorithm: "SHA256",
    dsaEncoding: "ieee-p1363",
  });
}

function createGoogleServiceAccountAssertion({
  clientEmail,
  privateKey,
  nowSeconds = Math.floor(Date.now() / 1000),
}) {
  return signJwt({
    header: {
      alg: "RS256",
      typ: "JWT",
    },
    payload: {
      aud: "https://oauth2.googleapis.com/token",
      exp: nowSeconds + 60 * 60,
      iat: nowSeconds,
      iss: clientEmail,
      scope: ANDROID_PUBLISHER_SCOPE,
    },
    privateKey,
    algorithm: "RSA-SHA256",
  });
}

async function fetchJson(url, options, label) {
  const response = await fetch(url, options);
  const text = await response.text();
  let body = null;

  if (text) {
    try {
      body = JSON.parse(text);
    } catch {
      body = { raw: text };
    }
  }

  if (!response.ok) {
    const message =
      body?.error?.message ??
      body?.errors?.[0]?.detail ??
      body?.raw ??
      response.statusText;

    throw new Error(`${label} failed (${response.status}): ${message}`);
  }

  return body ?? {};
}

function findAppleBuild(builds, buildNumber) {
  return builds.find((build) => {
    const attributes = build?.attributes ?? {};

    return (
      String(attributes.version ?? "") === String(buildNumber) ||
      String(attributes.buildNumber ?? "") === String(buildNumber)
    );
  });
}

export function buildAppleBuildVisibilityReport({
  appVersion,
  buildNumber,
  builds,
}) {
  const build = findAppleBuild(builds, buildNumber);

  if (!build) {
    return {
      ok: false,
      state: "missing",
      buildId: null,
      issues: [
        `iOS: ${appVersion} (${buildNumber}) is not visible in App Store Connect.`,
      ],
      nextSteps: [
        "Confirm the iOS upload completed, then rerun npm --prefix mobile run release:store-visibility:check.",
      ],
      summary: "",
    };
  }

  const state = build.attributes?.processingState ?? "UNKNOWN";

  if (APPLE_PROCESSING_STATES.has(state)) {
    return {
      ok: false,
      state,
      buildId: build.id,
      issues: [
        `iOS: ${appVersion} (${buildNumber}) is still ${state} in App Store Connect.`,
      ],
      nextSteps: [
        "Wait for Apple processing to finish, then rerun npm --prefix mobile run release:store-visibility:check.",
      ],
      summary: "",
    };
  }

  if (APPLE_FAILED_STATES.has(state) || state === "UNKNOWN") {
    return {
      ok: false,
      state,
      buildId: build.id,
      issues: [`iOS: ${appVersion} (${buildNumber}) processing state is ${state}.`],
      nextSteps: [
        "Open App Store Connect build processing details, fix the Apple issue, rebuild, and resubmit.",
      ],
      summary: "",
    };
  }

  return {
    ok: true,
    state,
    buildId: build.id,
    issues: [],
    nextSteps: [],
    summary: `iOS: ${appVersion} (${buildNumber}) is ${state} in App Store Connect.`,
  };
}

export function buildGoogleInternalTrackVisibilityReport({
  versionCode,
  track,
}) {
  const release = (track?.releases ?? []).find((candidate) =>
    (candidate.versionCodes ?? []).map(String).includes(String(versionCode)),
  );

  if (!release) {
    return {
      ok: false,
      releaseStatus: "missing",
      issues: [
        `Android: version code ${versionCode} is not visible on Play internal track.`,
      ],
      nextSteps: [
        "Check Google Play internal testing, then rerun npm --prefix mobile run release:store-visibility:check.",
      ],
      summary: "",
    };
  }

  if (release.status !== "completed") {
    return {
      ok: false,
      releaseStatus: release.status,
      issues: [
        `Android: version code ${versionCode} is on Play internal track with status ${release.status}.`,
      ],
      nextSteps: [
        "Complete the Play internal testing release, then rerun npm --prefix mobile run release:store-visibility:check.",
      ],
      summary: "",
    };
  }

  return {
    ok: true,
    releaseStatus: release.status,
    issues: [],
    nextSteps: [],
    summary: `Android: version code ${versionCode} is completed on Play internal track.`,
  };
}

export function buildStoreReleaseVisibilityReport({ apple, google }) {
  return {
    ok: apple.ok && google.ok,
    summaries: [apple.summary, google.summary].filter(Boolean),
    issues: [...apple.issues, ...google.issues],
    nextSteps: [...apple.nextSteps, ...google.nextSteps],
  };
}

function isDeletedGooglePlayEditError(error) {
  return /Google Play internal track lookup failed \(400\): This Edit has been deleted\./.test(
    error?.message ?? "",
  );
}

export async function withGooglePlayEditRetry(operation, { maxAttempts = 2 } = {}) {
  let lastError;

  for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
    try {
      return await operation();
    } catch (error) {
      lastError = error;

      if (!isDeletedGooglePlayEditError(error) || attempt >= maxAttempts) {
        throw error;
      }
    }
  }

  throw lastError;
}

async function readAppleBuildVisibility({
  appId,
  appVersion,
  buildNumber,
  keyId,
  issuerId,
  privateKey,
}) {
  const token = createAppStoreConnectToken({
    issuerId,
    keyId,
    privateKey,
  });
  const url = new URL("https://api.appstoreconnect.apple.com/v1/builds");

  url.searchParams.set("filter[app]", appId);
  url.searchParams.set("filter[version]", buildNumber);
  url.searchParams.set("fields[builds]", "version,processingState,uploadedDate");
  url.searchParams.set("limit", "10");
  url.searchParams.set("sort", "-uploadedDate");

  const response = await fetchJson(
    url,
    {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    },
    "App Store Connect build lookup",
  );

  return buildAppleBuildVisibilityReport({
    appVersion,
    buildNumber,
    builds: response.data ?? [],
  });
}

async function readGoogleAccessToken(serviceAccount) {
  const assertion = createGoogleServiceAccountAssertion({
    clientEmail: serviceAccount.client_email,
    privateKey: serviceAccount.private_key,
  });
  const response = await fetchJson(
    "https://oauth2.googleapis.com/token",
    {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: new URLSearchParams({
        assertion,
        grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer",
      }),
    },
    "Google OAuth token request",
  );

  return response.access_token;
}

async function readGoogleInternalTrackVisibility({
  packageName,
  serviceAccount,
  versionCode,
}) {
  const accessToken = await readGoogleAccessToken(serviceAccount);
  const baseUrl = `https://androidpublisher.googleapis.com/androidpublisher/v3/applications/${encodeURIComponent(
    packageName,
  )}`;

  return withGooglePlayEditRetry(async () => {
    const edit = await fetchJson(
      `${baseUrl}/edits`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${accessToken}`,
        },
      },
      "Google Play edit creation",
    );
    const editId = edit.id;

    try {
      const track = await fetchJson(
        `${baseUrl}/edits/${encodeURIComponent(editId)}/tracks/internal`,
        {
          headers: {
            Authorization: `Bearer ${accessToken}`,
          },
        },
        "Google Play internal track lookup",
      );

      return buildGoogleInternalTrackVisibilityReport({
        versionCode,
        track,
      });
    } finally {
      if (editId) {
        await fetch(`${baseUrl}/edits/${encodeURIComponent(editId)}`, {
          method: "DELETE",
          headers: {
            Authorization: `Bearer ${accessToken}`,
          },
        }).catch(() => {});
      }
    }
  });
}

function resolveLocalPath(mobileRoot, value) {
  return path.resolve(mobileRoot, value);
}

function readAppleCredentials({ easConfig, mobileRoot, environment }) {
  const ios = easConfig?.submit?.production?.ios ?? {};
  const appId = environment.EXPO_ASC_APP_ID ?? ios.ascAppId;
  const keyPath = environment.EXPO_ASC_API_KEY_PATH ?? ios.ascApiKeyPath;
  const keyId = environment.EXPO_ASC_API_KEY_ID ?? ios.ascApiKeyId;
  const issuerId =
    environment.EXPO_ASC_API_KEY_ISSUER_ID ?? ios.ascApiKeyIssuerId;

  if (!appId || !keyPath || !keyId || !issuerId || keyPath.startsWith("@secret:")) {
    throw new Error("Local App Store Connect API key credentials are required.");
  }

  const resolvedKeyPath = resolveLocalPath(mobileRoot, keyPath);

  if (!existsSync(resolvedKeyPath)) {
    throw new Error(`App Store Connect API key file is missing: ${keyPath}`);
  }

  return {
    appId,
    issuerId,
    keyId,
    privateKey: readFileSync(resolvedKeyPath, "utf8"),
  };
}

function readGoogleServiceAccount({ easConfig, mobileRoot }) {
  const keyPath =
    easConfig?.submit?.production?.android?.serviceAccountKeyPath;

  if (!keyPath || keyPath.startsWith("@secret:")) {
    throw new Error("Local Google Play service account JSON is required.");
  }

  const resolvedKeyPath = resolveLocalPath(mobileRoot, keyPath);

  if (!existsSync(resolvedKeyPath)) {
    throw new Error(`Google Play service account JSON is missing: ${keyPath}`);
  }

  return readJson(resolvedKeyPath);
}

export async function readStoreReleaseVisibilityStatus({
  mobileRoot,
  environment = process.env,
} = {}) {
  const easConfig = readJson(path.join(mobileRoot, "eas.json"));
  const appConfig = readJson(path.join(mobileRoot, "app.json"));
  const artifactReport = readProductionBuildArtifactStatus(
    mobileRoot,
    environment,
  );

  if (!artifactReport.ok) {
    return {
      ok: false,
      summaries: [],
      issues: artifactReport.issues,
      nextSteps: artifactReport.nextSteps,
    };
  }

  const iosArtifact = artifactReport.artifacts.find(
    (artifact) => artifact.platform === "iOS",
  );
  const androidArtifact = artifactReport.artifacts.find(
    (artifact) => artifact.platform === "Android",
  );
  const appVersion = appConfig.expo?.version;
  const packageName = appConfig.expo?.android?.package;
  const localEnvironment = {
    ...readLocalSubmitEnvironment(mobileRoot, environment),
    ...environment,
  };

  try {
    const apple = await readAppleBuildVisibility({
      ...readAppleCredentials({
        easConfig,
        mobileRoot,
        environment: localEnvironment,
      }),
      appVersion,
      buildNumber: iosArtifact.appBuildVersion,
    });
    const google = await readGoogleInternalTrackVisibility({
      packageName,
      serviceAccount: readGoogleServiceAccount({ easConfig, mobileRoot }),
      versionCode: androidArtifact.appBuildVersion,
    });

    return buildStoreReleaseVisibilityReport({ apple, google });
  } catch (error) {
    return {
      ok: false,
      summaries: [],
      issues: [error.message],
      nextSteps: [
        "Fix the store visibility lookup, then rerun npm --prefix mobile run release:store-visibility:check.",
      ],
    };
  }
}

export function formatStoreReleaseVisibilityReport(report) {
  if (report.ok) {
    return [
      "Store release visibility check passed.",
      ...report.summaries.map((summary) => `- ${summary}`),
    ].join("\n");
  }

  return [
    "Store release visibility check blocked.",
    ...report.summaries.map((summary) => `- ${summary}`),
    ...report.issues.map((issue) => `- ${issue}`),
    "",
    "Next steps:",
    ...report.nextSteps.map((step) => `- ${step}`),
  ].join("\n");
}

async function run() {
  const scriptDirectory = path.dirname(fileURLToPath(import.meta.url));
  const mobileRoot = path.resolve(scriptDirectory, "..");
  const report = await readStoreReleaseVisibilityStatus({ mobileRoot });
  const output = formatStoreReleaseVisibilityReport(report);

  if (!report.ok) {
    console.error(output);
    process.exit(1);
  }

  console.log(output);
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  run();
}

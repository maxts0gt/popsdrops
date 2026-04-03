import { describe, expect, it } from "vitest";
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";

import {
  REQUIRED_RELEASE_ENV_VARS,
  validateReleaseEnvironment,
} from "./release-readiness";

const mobileRoot = path.resolve(__dirname, "..");

describe("validateReleaseEnvironment", () => {
  it("returns missing public mobile env vars for incomplete release config", () => {
    const result = validateReleaseEnvironment({
      EXPO_PUBLIC_SUPABASE_URL: "https://example.supabase.co",
    });

    expect(result.ok).toBe(false);
    expect(result.missing).toEqual(["EXPO_PUBLIC_SUPABASE_ANON_KEY"]);
    expect(result.required).toEqual(REQUIRED_RELEASE_ENV_VARS);
  });

  it("accepts release config when required public mobile env vars are present", () => {
    const result = validateReleaseEnvironment({
      EXPO_PUBLIC_SUPABASE_URL: "https://example.supabase.co",
      EXPO_PUBLIC_SUPABASE_ANON_KEY: "anon-key",
    });

    expect(result.ok).toBe(true);
    expect(result.missing).toEqual([]);
  });
});

describe("mobile release contract", () => {
  it("exposes mobile-local quality and release scripts", () => {
    const packageJson = JSON.parse(
      readFileSync(path.join(mobileRoot, "package.json"), "utf8"),
    ) as {
      scripts?: Record<string, string>;
    };

    expect(packageJson.scripts).toMatchObject({
      lint: "npm --prefix .. run lint -- 'mobile/**/*.{ts,tsx}'",
      doctor: "npx expo-doctor",
      quality: "npm run lint && npm run typecheck && npm run test && npm run doctor && npm run release:check",
      "release:check": "node ./scripts/release-check.mjs",
      "build:preview": "npx eas-cli build --platform all --profile preview",
      "build:production:ios": "npx eas-cli build --platform ios --profile production",
      "build:production:android": "npx eas-cli build --platform android --profile production",
    });
  });

  it("defines explicit expo application service build profiles", () => {
    const easPath = path.join(mobileRoot, "eas.json");

    expect(existsSync(easPath)).toBe(true);

    const easConfig = JSON.parse(readFileSync(easPath, "utf8")) as {
      build?: Record<string, Record<string, unknown>>;
      submit?: Record<string, Record<string, unknown>>;
    };

    expect(easConfig.build?.development).toMatchObject({
      developmentClient: true,
      distribution: "internal",
    });
    expect(easConfig.build?.preview).toMatchObject({
      distribution: "internal",
    });
    expect(easConfig.build?.production).toMatchObject({
      autoIncrement: true,
    });
    expect(easConfig.submit?.production).toMatchObject({});
  });
});

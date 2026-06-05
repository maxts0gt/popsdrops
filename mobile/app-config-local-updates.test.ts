import { afterEach, describe, expect, it } from "vitest";

import getExpoConfig from "./app.config";

function getEasProjectId(extra: ReturnType<typeof getExpoConfig>["expo"]["extra"]) {
  if (!extra || !("eas" in extra)) return undefined;
  return extra.eas.projectId;
}

const originalEasBuild = process.env.EAS_BUILD;
const originalEnableUpdates = process.env.EXPO_PUBLIC_ENABLE_EAS_UPDATES;

afterEach(() => {
  process.env.EAS_BUILD = originalEasBuild;
  process.env.EXPO_PUBLIC_ENABLE_EAS_UPDATES = originalEnableUpdates;
});

describe("mobile app config update boundary", () => {
  it("removes EAS update identity from local Expo Go config", () => {
    delete process.env.EAS_BUILD;
    delete process.env.EXPO_PUBLIC_ENABLE_EAS_UPDATES;

    const { expo } = getExpoConfig();

    expect(expo.plugins).not.toContain("expo-updates");
    expect(expo).not.toHaveProperty("updates");
    expect(expo).not.toHaveProperty("runtimeVersion");
    expect(expo).not.toHaveProperty("owner");
    expect(getEasProjectId(expo.extra)).toBeUndefined();
  });

  it("keeps EAS update identity for production EAS builds", () => {
    process.env.EAS_BUILD = "true";
    delete process.env.EXPO_PUBLIC_ENABLE_EAS_UPDATES;

    const { expo } = getExpoConfig();

    expect(expo.plugins).toContain("expo-updates");
    expect(expo).toHaveProperty("updates");
    expect(expo).toHaveProperty("runtimeVersion");
    expect("owner" in expo ? expo.owner : undefined).toBe("maxtsogt");
    expect(getEasProjectId(expo.extra)).toBe(
      "cd22a581-5b93-432b-a9cf-fdd8ee6c5012",
    );
  });
});

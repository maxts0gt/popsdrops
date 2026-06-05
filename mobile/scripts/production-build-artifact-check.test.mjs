import { describe, expect, it } from "vitest";

import {
  buildProductionBuildArtifactReport,
  parseEasBuildListOutput,
} from "./production-build-artifact-check.mjs";

const finishedIosBuild = {
  id: "ios-build-1",
  status: "FINISHED",
  platform: "IOS",
  distribution: "STORE",
  buildProfile: "production",
  channel: "production",
  artifacts: {
    buildUrl: "https://expo.dev/artifacts/eas/popsdrops.ipa",
  },
  appBuildVersion: "11",
  completedAt: "2026-05-26T16:03:37.074Z",
  isForIosSimulator: false,
};

const finishedAndroidBuild = {
  id: "android-build-1",
  status: "FINISHED",
  platform: "ANDROID",
  distribution: "STORE",
  buildProfile: "production",
  channel: "production",
  artifacts: {
    buildUrl: "https://expo.dev/artifacts/eas/popsdrops.aab",
  },
  appBuildVersion: "2",
  completedAt: "2026-05-25T18:22:00.953Z",
};

describe("production build artifact check", () => {
  it("accepts finished production store artifacts for both app stores", () => {
    const report = buildProductionBuildArtifactReport([
      finishedIosBuild,
      finishedAndroidBuild,
    ]);

    expect(report).toMatchObject({
      ok: true,
      issues: [],
      artifacts: [
        {
          platform: "iOS",
          buildId: "ios-build-1",
          appBuildVersion: "11",
        },
        {
          platform: "Android",
          buildId: "android-build-1",
          appBuildVersion: "2",
        },
      ],
    });
  });

  it("blocks submit when a platform is missing a finished production artifact", () => {
    const report = buildProductionBuildArtifactReport([
      {
        ...finishedIosBuild,
        status: "ERRORED",
      },
      {
        ...finishedAndroidBuild,
        distribution: "INTERNAL",
      },
    ]);

    expect(report.ok).toBe(false);
    expect(report.issues).toEqual([
      "iOS: No finished production store build artifact found.",
      "Android: No finished production store build artifact found.",
    ]);
    expect(report.nextSteps).toEqual([
      "Run npm --prefix mobile run build:production:ios and npm --prefix mobile run build:production:android, then rerun npm --prefix mobile run release:production-artifacts:check.",
    ]);
  });

  it("requires store artifact URLs with the correct native archive type", () => {
    const report = buildProductionBuildArtifactReport([
      {
        ...finishedIosBuild,
        artifacts: {},
      },
      {
        ...finishedAndroidBuild,
        artifacts: {
          buildUrl: "https://expo.dev/artifacts/eas/popsdrops.apk",
        },
      },
    ]);

    expect(report.ok).toBe(false);
    expect(report.issues).toEqual([
      "iOS: Finished production build is missing an artifact URL.",
      "Android: Production artifact must be an .aab archive for Play internal testing.",
    ]);
  });

  it("parses EAS JSON output without reading stderr warnings", () => {
    expect(parseEasBuildListOutput(JSON.stringify([finishedIosBuild]))).toEqual([
      finishedIosBuild,
    ]);
    expect(parseEasBuildListOutput("")).toEqual([]);
  });
});

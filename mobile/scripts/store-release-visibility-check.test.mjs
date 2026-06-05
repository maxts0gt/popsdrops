import { describe, expect, it } from "vitest";

import {
  buildAppleBuildVisibilityReport,
  buildGoogleInternalTrackVisibilityReport,
  buildStoreReleaseVisibilityReport,
  withGooglePlayEditRetry,
} from "./store-release-visibility-check.mjs";

describe("store release visibility check", () => {
  it("accepts a processed App Store Connect build", () => {
    const report = buildAppleBuildVisibilityReport({
      appVersion: "1.0.0",
      buildNumber: "12",
      builds: [
        {
          id: "apple-build-12",
          attributes: {
            version: "12",
            processingState: "VALID",
            uploadedDate: "2026-05-27T02:12:00Z",
          },
        },
      ],
    });

    expect(report).toEqual({
      ok: true,
      state: "VALID",
      buildId: "apple-build-12",
      issues: [],
      nextSteps: [],
      summary: "iOS: 1.0.0 (12) is VALID in App Store Connect.",
    });
  });

  it("blocks while Apple is still processing the uploaded build", () => {
    const report = buildAppleBuildVisibilityReport({
      appVersion: "1.0.0",
      buildNumber: "12",
      builds: [
        {
          id: "apple-build-12",
          attributes: {
            version: "12",
            processingState: "PROCESSING",
          },
        },
      ],
    });

    expect(report).toMatchObject({
      ok: false,
      state: "PROCESSING",
      issues: [
        "iOS: 1.0.0 (12) is still PROCESSING in App Store Connect.",
      ],
      nextSteps: [
        "Wait for Apple processing to finish, then rerun npm --prefix mobile run release:store-visibility:check.",
      ],
    });
  });

  it("surfaces failed or missing Apple builds", () => {
    expect(
      buildAppleBuildVisibilityReport({
        appVersion: "1.0.0",
        buildNumber: "12",
        builds: [],
      }).issues,
    ).toEqual(["iOS: 1.0.0 (12) is not visible in App Store Connect."]);

    expect(
      buildAppleBuildVisibilityReport({
        appVersion: "1.0.0",
        buildNumber: "12",
        builds: [
          {
            id: "apple-build-12",
            attributes: {
              version: "12",
              processingState: "FAILED",
            },
          },
        ],
      }).issues,
    ).toEqual(["iOS: 1.0.0 (12) processing state is FAILED."]);
  });

  it("accepts a completed Google Play internal track release", () => {
    const report = buildGoogleInternalTrackVisibilityReport({
      versionCode: "3",
      track: {
        track: "internal",
        releases: [
          {
            name: "1.0.0",
            versionCodes: ["3"],
            status: "completed",
          },
        ],
      },
    });

    expect(report).toEqual({
      ok: true,
      releaseStatus: "completed",
      issues: [],
      nextSteps: [],
      summary: "Android: version code 3 is completed on Play internal track.",
    });
  });

  it("blocks missing or non-completed Google Play internal releases", () => {
    expect(
      buildGoogleInternalTrackVisibilityReport({
        versionCode: "3",
        track: {
          track: "internal",
          releases: [],
        },
      }).issues,
    ).toEqual(["Android: version code 3 is not visible on Play internal track."]);

    expect(
      buildGoogleInternalTrackVisibilityReport({
        versionCode: "3",
        track: {
          track: "internal",
          releases: [
            {
              versionCodes: ["3"],
              status: "draft",
            },
          ],
        },
      }).issues,
    ).toEqual(["Android: version code 3 is on Play internal track with status draft."]);
  });

  it("combines iOS and Android visibility into one post-submit report", () => {
    const report = buildStoreReleaseVisibilityReport({
      apple: {
        ok: true,
        summary: "iOS: 1.0.0 (12) is VALID in App Store Connect.",
        issues: [],
        nextSteps: [],
      },
      google: {
        ok: false,
        summary: "",
        issues: ["Android: version code 3 is not visible on Play internal track."],
        nextSteps: [
          "Check Google Play internal testing, then rerun npm --prefix mobile run release:store-visibility:check.",
        ],
      },
    });

    expect(report).toEqual({
      ok: false,
      summaries: ["iOS: 1.0.0 (12) is VALID in App Store Connect."],
      issues: ["Android: version code 3 is not visible on Play internal track."],
      nextSteps: [
        "Check Google Play internal testing, then rerun npm --prefix mobile run release:store-visibility:check.",
      ],
    });
  });

  it("retries a transient deleted Google Play edit with a fresh lookup", async () => {
    const attempts = [];

    const result = await withGooglePlayEditRetry(async () => {
      attempts.push(attempts.length + 1);

      if (attempts.length === 1) {
        throw new Error(
          "Google Play internal track lookup failed (400): This Edit has been deleted.",
        );
      }

      return {
        ok: true,
        summary: "Android: version code 3 is completed on Play internal track.",
      };
    });

    expect(attempts).toEqual([1, 2]);
    expect(result).toEqual({
      ok: true,
      summary: "Android: version code 3 is completed on Play internal track.",
    });
  });

  it("does not retry non-transient Google Play visibility failures", async () => {
    const attempts = [];

    await expect(
      withGooglePlayEditRetry(async () => {
        attempts.push(attempts.length + 1);
        throw new Error(
          "Google Play internal track lookup failed (403): Permission denied.",
        );
      }),
    ).rejects.toThrow("Permission denied");

    expect(attempts).toEqual([1]);
  });
});

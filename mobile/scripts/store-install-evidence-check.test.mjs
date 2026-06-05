import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import os from "node:os";
import path from "node:path";

import { describe, expect, it } from "vitest";

import { buildStoreInstallEvidenceReport } from "./store-install-evidence-check.mjs";

function writePngLikeFile(filePath, { width, height, bytes = 24000 }) {
  const buffer = Buffer.alloc(bytes);

  Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]).copy(buffer, 0);
  buffer.writeUInt32BE(13, 8);
  buffer.write("IHDR", 12, "ascii");
  buffer.writeUInt32BE(width, 16);
  buffer.writeUInt32BE(height, 20);

  writeFileSync(filePath, buffer);
}

describe("store install evidence check", () => {
  it("accepts real-device TestFlight and Play internal screenshots for the submitted builds", () => {
    const tempRoot = mkdtempSync(path.join(os.tmpdir(), "popsdrops-install-"));

    try {
      writePngLikeFile(path.join(tempRoot, "ios-testflight.png"), {
        width: 1170,
        height: 2532,
      });
      writePngLikeFile(path.join(tempRoot, "android-play-internal.png"), {
        width: 1080,
        height: 2400,
      });

      const report = buildStoreInstallEvidenceReport({
        manifest: {
          outputDirectory: tempRoot,
          capturedAt: "2026-05-27T03:20:00.000Z",
          evidence: [
            {
              platform: "ios",
              source: "testflight",
              appBuildVersion: "12",
              file: "ios-testflight.png",
              tester: "redacted Apple tester",
            },
            {
              platform: "android",
              source: "play-internal",
              appBuildVersion: "3",
              file: "android-play-internal.png",
              tester: "redacted Google tester",
            },
          ],
        },
        expectedArtifacts: [
          {
            platform: "iOS",
            appBuildVersion: "12",
          },
          {
            platform: "Android",
            appBuildVersion: "3",
          },
        ],
        minFileBytes: 20000,
      });

      expect(report).toEqual({
        ok: true,
        issues: [],
        nextSteps: [],
        summaries: [
          "iOS: TestFlight install evidence matches build 12.",
          "Android: Play internal install evidence matches build 3.",
        ],
      });
    } finally {
      rmSync(tempRoot, { recursive: true, force: true });
    }
  });

  it("blocks missing sources, wrong builds, and screenshots that do not prove a real device install", () => {
    const tempRoot = mkdtempSync(path.join(os.tmpdir(), "popsdrops-install-"));

    try {
      writePngLikeFile(path.join(tempRoot, "android-play-internal.png"), {
        width: 800,
        height: 600,
        bytes: 800,
      });

      const report = buildStoreInstallEvidenceReport({
        manifest: {
          outputDirectory: tempRoot,
          capturedAt: "not-a-date",
          evidence: [
            {
              platform: "android",
              source: "browser",
              appBuildVersion: "2",
              file: "android-play-internal.png",
              tester: "",
            },
          ],
        },
        expectedArtifacts: [
          {
            platform: "iOS",
            appBuildVersion: "12",
          },
          {
            platform: "Android",
            appBuildVersion: "3",
          },
        ],
        minFileBytes: 20000,
      });

      expect(report).toEqual({
        ok: false,
        summaries: [],
        issues: [
          "Install evidence capturedAt must be an ISO timestamp.",
          "iOS: Missing TestFlight install evidence.",
          "Android: Install evidence source must be play-internal.",
          "Android: Install evidence must match submitted build 3.",
          "Android: Store install screenshot must be portrait.",
          "Android: Store install screenshot must be at least 1080x1920.",
          "Android: Store install screenshot file is too small to prove a real device install.",
          "Android: Store install tester label is required.",
        ],
        nextSteps: [
          "Install the iOS build from TestFlight on a real tester device, capture the creator app screen, and add it to mobile/store-install-evidence-manifest.local.json.",
          "Install the Android build from Play internal testing on a real tester device, capture the creator app screen, and add it to mobile/store-install-evidence-manifest.local.json.",
          "Rerun npm --prefix mobile run release:store-install-evidence:check.",
        ],
      });
    } finally {
      rmSync(tempRoot, { recursive: true, force: true });
    }
  });
});

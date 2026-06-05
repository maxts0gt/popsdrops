import {
  existsSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import os from "node:os";
import path from "node:path";

import { describe, expect, it } from "vitest";

import { createStoreInstallEvidenceManifest } from "./create-store-install-evidence-manifest.mjs";

function writePngLikeFile(filePath, { width, height, bytes = 24000 }) {
  const buffer = Buffer.alloc(bytes);

  Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]).copy(buffer, 0);
  buffer.writeUInt32BE(13, 8);
  buffer.write("IHDR", 12, "ascii");
  buffer.writeUInt32BE(width, 16);
  buffer.writeUInt32BE(height, 20);

  writeFileSync(filePath, buffer);
}

describe("create store install evidence manifest", () => {
  it("copies real-device screenshots and writes the local evidence manifest", () => {
    const tempRoot = mkdtempSync(path.join(os.tmpdir(), "popsdrops-create-install-"));

    try {
      const iosSource = path.join(tempRoot, "iphone.png");
      const androidSource = path.join(tempRoot, "android.png");
      const outputDirectory = path.join(tempRoot, "install-evidence");
      const manifestPath = path.join(tempRoot, "store-install-evidence-manifest.local.json");

      writePngLikeFile(iosSource, {
        width: 1170,
        height: 2532,
      });
      writePngLikeFile(androidSource, {
        width: 1080,
        height: 2400,
      });

      const result = createStoreInstallEvidenceManifest({
        iosScreenshot: iosSource,
        androidScreenshot: androidSource,
        outputDirectory,
        manifestPath,
        capturedAt: "2026-05-27T03:45:00.000Z",
        iosBuildVersion: "12",
        androidBuildVersion: "3",
        iosTester: "redacted Apple tester",
        androidTester: "redacted Google tester",
      });

      expect(result).toEqual({
        ok: true,
        manifestPath,
        outputDirectory,
        files: [
          path.join(outputDirectory, "ios-testflight.png"),
          path.join(outputDirectory, "android-play-internal.png"),
        ],
      });
      expect(existsSync(path.join(outputDirectory, "ios-testflight.png"))).toBe(true);
      expect(existsSync(path.join(outputDirectory, "android-play-internal.png"))).toBe(true);
      expect(JSON.parse(readFileSync(manifestPath, "utf8"))).toEqual({
        outputDirectory,
        capturedAt: "2026-05-27T03:45:00.000Z",
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
      });
    } finally {
      rmSync(tempRoot, { recursive: true, force: true });
    }
  });

  it("refuses to write a manifest when either real-device screenshot is missing", () => {
    const tempRoot = mkdtempSync(path.join(os.tmpdir(), "popsdrops-create-install-"));

    try {
      const result = createStoreInstallEvidenceManifest({
        iosScreenshot: path.join(tempRoot, "missing-ios.png"),
        androidScreenshot: path.join(tempRoot, "missing-android.png"),
        outputDirectory: path.join(tempRoot, "install-evidence"),
        manifestPath: path.join(tempRoot, "store-install-evidence-manifest.local.json"),
        capturedAt: "2026-05-27T03:45:00.000Z",
        iosBuildVersion: "12",
        androidBuildVersion: "3",
        iosTester: "redacted Apple tester",
        androidTester: "redacted Google tester",
      });

      expect(result).toEqual({
        ok: false,
        issues: [
          `iOS TestFlight screenshot is missing: ${path.join(tempRoot, "missing-ios.png")}.`,
          `Android Play internal screenshot is missing: ${path.join(tempRoot, "missing-android.png")}.`,
        ],
      });
    } finally {
      rmSync(tempRoot, { recursive: true, force: true });
    }
  });

  it("refuses to write a manifest when screenshots cannot prove store-installed devices", () => {
    const tempRoot = mkdtempSync(path.join(os.tmpdir(), "popsdrops-create-install-"));

    try {
      const iosSource = path.join(tempRoot, "iphone.png");
      const androidSource = path.join(tempRoot, "android.png");
      const outputDirectory = path.join(tempRoot, "install-evidence");
      const manifestPath = path.join(tempRoot, "store-install-evidence-manifest.local.json");

      writePngLikeFile(iosSource, {
        width: 900,
        height: 1600,
        bytes: 800,
      });
      writeFileSync(androidSource, "not a png");

      const result = createStoreInstallEvidenceManifest({
        iosScreenshot: iosSource,
        androidScreenshot: androidSource,
        outputDirectory,
        manifestPath,
        capturedAt: "2026-05-27T03:45:00.000Z",
        iosBuildVersion: "12",
        androidBuildVersion: "3",
        iosTester: "redacted Apple tester",
        androidTester: "redacted Google tester",
      });

      expect(result).toEqual({
        ok: false,
        issues: [
          "iOS TestFlight screenshot must be at least 1170x2532.",
          "iOS TestFlight screenshot file is too small to prove a real device install.",
          "Android Play internal screenshot must be a valid PNG.",
        ],
      });
      expect(existsSync(manifestPath)).toBe(false);
    } finally {
      rmSync(tempRoot, { recursive: true, force: true });
    }
  });

  it("refuses to write a manifest with invalid proof metadata", () => {
    const tempRoot = mkdtempSync(path.join(os.tmpdir(), "popsdrops-create-install-"));

    try {
      const iosSource = path.join(tempRoot, "iphone.png");
      const androidSource = path.join(tempRoot, "android.png");
      const outputDirectory = path.join(tempRoot, "install-evidence");
      const manifestPath = path.join(tempRoot, "store-install-evidence-manifest.local.json");

      writePngLikeFile(iosSource, {
        width: 1170,
        height: 2532,
      });
      writePngLikeFile(androidSource, {
        width: 1080,
        height: 2400,
      });

      const result = createStoreInstallEvidenceManifest({
        iosScreenshot: iosSource,
        androidScreenshot: androidSource,
        outputDirectory,
        manifestPath,
        capturedAt: "May 27",
        iosBuildVersion: "",
        androidBuildVersion: "   ",
        iosTester: "",
        androidTester: "   ",
      });

      expect(result).toEqual({
        ok: false,
        issues: [
          "Install evidence capturedAt must be an ISO timestamp.",
          "iOS TestFlight build version is required.",
          "iOS TestFlight tester label is required.",
          "Android Play internal build version is required.",
          "Android Play internal tester label is required.",
        ],
      });
      expect(existsSync(manifestPath)).toBe(false);
    } finally {
      rmSync(tempRoot, { recursive: true, force: true });
    }
  });
});

import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import os from "node:os";
import path from "node:path";

import { describe, expect, it } from "vitest";

import {
  readPngSize,
  validateStoreScreenshotArtifacts,
} from "./store-screenshot-artifact-check.mjs";

function writePngLikeFile(filePath, { width, height, bytes = 24000 }) {
  const buffer = Buffer.alloc(bytes);

  Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]).copy(buffer, 0);
  buffer.writeUInt32BE(13, 8);
  buffer.write("IHDR", 12, "ascii");
  buffer.writeUInt32BE(width, 16);
  buffer.writeUInt32BE(height, 20);

  writeFileSync(filePath, buffer);
}

describe("store screenshot artifact check", () => {
  it("validates generated portrait PNG artifacts for every manifest screen", () => {
    const tempRoot = mkdtempSync(path.join(os.tmpdir(), "popsdrops-shots-"));

    try {
      writePngLikeFile(path.join(tempRoot, "01-login.png"), {
        width: 1320,
        height: 2868,
      });

      const manifest = {
        outputDirectory: tempRoot,
        screens: [
          {
            id: "01-login",
            file: "01-login.png",
          },
        ],
      };

      expect(readPngSize(path.join(tempRoot, "01-login.png"))).toEqual({
        width: 1320,
        height: 2868,
      });
      expect(
        validateStoreScreenshotArtifacts(manifest, {
          minWidth: 1170,
          minHeight: 2532,
          minFileBytes: 20000,
        }),
      ).toEqual([]);
    } finally {
      rmSync(tempRoot, { recursive: true, force: true });
    }
  });

  it("reports missing, tiny, and landscape screenshot artifacts", () => {
    const tempRoot = mkdtempSync(path.join(os.tmpdir(), "popsdrops-shots-"));

    try {
      writePngLikeFile(path.join(tempRoot, "01-login.png"), {
        width: 900,
        height: 700,
        bytes: 800,
      });

      const manifest = {
        outputDirectory: tempRoot,
        screens: [
          {
            id: "01-login",
            file: "01-login.png",
          },
          {
            id: "02-home",
            file: "02-home.png",
          },
        ],
      };

      expect(
        validateStoreScreenshotArtifacts(manifest, {
          minWidth: 1080,
          minHeight: 1920,
          minFileBytes: 20000,
        }),
      ).toEqual([
        "Screen 01-login screenshot must be portrait.",
        "Screen 01-login screenshot must be at least 1080x1920.",
        "Screen 01-login screenshot file is too small to be a real store image.",
        "Screen 02-home screenshot is missing: 02-home.png.",
      ]);
    } finally {
      rmSync(tempRoot, { recursive: true, force: true });
    }
  });
});

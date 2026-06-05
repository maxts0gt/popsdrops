import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative } from "node:path";
import { describe, expect, it } from "vitest";

const ignoredDirectories = new Set([
  ".git",
  ".next",
  ".expo",
  ".playwright-cli",
  "coverage",
  "node_modules",
  "output",
]);

const scannedExtensions = new Set([
  ".css",
  ".js",
  ".json",
  ".jsx",
  ".md",
  ".mjs",
  ".sql",
  ".toml",
  ".ts",
  ".tsx",
  ".yaml",
  ".yml",
]);

function listProjectFiles(directory: string, root = directory): string[] {
  return readdirSync(directory).flatMap((entry) => {
    if (ignoredDirectories.has(entry)) {
      return [];
    }

    const absolutePath = join(directory, entry);
    const stat = statSync(absolutePath);

    if (stat.isDirectory()) {
      return listProjectFiles(absolutePath, root);
    }

    if (!stat.isFile() || !scannedExtensions.has(entry.slice(entry.lastIndexOf(".")))) {
      return [];
    }

    return [relative(root, absolutePath)];
  });
}

function readProjectFile(path: string) {
  return readFileSync(join(process.cwd(), path), "utf8");
}

describe("PopsDrops design contract", () => {
  it("keeps canonical strategy docs aligned with the current product stance", () => {
    const canonicalDocs = [
      "AGENTS.md",
      "CLAUDE.md",
      "DESIGN.md",
      "docs/SPEC.md",
    ].map((file) => ({
      file,
      source: readProjectFile(file),
    }));

    for (const { file, source } of canonicalDocs) {
      expect(source, `${file} should not frame the product as MVP`).not.toContain("MVP");
      expect(source, `${file} should not preserve social OAuth as a default path`).not.toMatch(
        /social OAuth|social account connection|optional future verification infrastructure/i,
      );
      expect(source, `${file} should not treat Supabase dashboard as the admin product`).not.toMatch(
        /initially via Supabase dashboard/i,
      );
      expect(source, `${file} should not preserve fixed month-based mobile timing`).not.toMatch(
        /month 3-4/i,
      );
      expect(source, `${file} should not make scheduled jobs a default backend pattern`).not.toMatch(
        /database-backed scheduled jobs/i,
      );
      expect(source, `${file} should document evidence-first reporting`).toMatch(
        /evidence-first|proof-first/i,
      );
    }
  });

  it("documents report helper actions as secondary controls", () => {
    const design = readProjectFile("DESIGN.md");

    expect(design).toContain("helper-action");
    expect(design).toContain("Report helper actions");
    expect(design).toContain("must never compete with the report story");
    expect(design).toContain("small outline buttons");
    expect(design).toContain("36px height");
    expect(design).toContain("the trigger itself should feel like a utility control");
  });

  it("does not use decorative magic icons", () => {
    const forbiddenIconNames = [
      ["Spark", "les"].join(""),
      ["Spark", "le"].join(""),
      ["Wand", "Spark", "les"].join(""),
      ["Sta", "rs"].join(""),
      ["Za", "p"].join(""),
      ["Bo", "lt"].join(""),
      ["Light", "ning"].join(""),
      ["Fla", "sh"].join(""),
    ];

    const pattern = new RegExp(`\\b(${forbiddenIconNames.join("|")})\\b`);
    const matches = listProjectFiles(process.cwd()).filter((file) => {
      if (file === "DESIGN.md") {
        return false;
      }

      return pattern.test(readProjectFile(file));
    });

    expect(matches).toEqual([]);
  });

  it("does not contain em dash characters", () => {
    const emDash = String.fromCharCode(8212);
    const matches = listProjectFiles(process.cwd()).filter((file) =>
      readProjectFile(file).includes(emDash)
    );

    expect(matches).toEqual([]);
  });
});

#!/usr/bin/env node

import { generateBundles } from "./lib/i18n-bundle-generator.mjs";

await generateBundles({
  repoRoot: process.cwd(),
  target: "public",
  argv: process.argv.slice(2),
});

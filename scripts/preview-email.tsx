/**
 * Render all production email templates to a local preview document.
 * Run: npm exec -- tsx scripts/preview-email.tsx
 */
import { mkdirSync, writeFileSync } from "node:fs";
import { dirname } from "node:path";

import {
  buildEmailPreviewDocument,
  EMAIL_PREVIEW_OUTPUT_PATH,
} from "../src/lib/email/email-template-gallery";

async function main() {
  const html = await buildEmailPreviewDocument();
  mkdirSync(dirname(EMAIL_PREVIEW_OUTPUT_PATH), { recursive: true });
  writeFileSync(EMAIL_PREVIEW_OUTPUT_PATH, html);
  console.log(`Preview written to ${EMAIL_PREVIEW_OUTPUT_PATH}`);
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
});

/**
 * Generate all app icon and splash screen assets for PopsDrops mobile.
 *
 * Brand: Pure black background, white "P" lettermark.
 * Premium, minimal — the kind of icon Chanel or Hermès would respect.
 *
 * Usage: node mobile/scripts/generate-icons.mjs
 * Requires: sharp (available via next in the root workspace)
 */

import sharp from "sharp";
import { join, dirname } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ASSETS = join(__dirname, "..", "assets");

const BLACK = "#000000";
const WHITE = "#FFFFFF";

/**
 * App icon — 1024x1024.
 * Pure black with a clean white "P" lettermark centered.
 * Inter Bold style, generous weight, optically centered.
 */
async function generateAppIcon() {
  const size = 1024;
  // The "P" is rendered via SVG text for crisp vector quality
  const svg = `<svg width="${size}" height="${size}" xmlns="http://www.w3.org/2000/svg">
    <rect width="${size}" height="${size}" fill="${BLACK}"/>
    <text
      x="50%" y="54%"
      text-anchor="middle"
      dominant-baseline="central"
      font-family="Inter, Helvetica Neue, Arial, sans-serif"
      font-weight="700"
      font-size="580"
      fill="${WHITE}"
      letter-spacing="-10"
    >P</text>
  </svg>`;

  await sharp(Buffer.from(svg))
    .resize(size, size)
    .png()
    .toFile(join(ASSETS, "icon.png"));

  console.log("✓ icon.png (1024x1024)");
}

/**
 * Adaptive icon foreground (Android) — 1024x1024 with padding.
 * Android adaptive icons need the content within the safe zone (66% of canvas).
 * Pure black bg is set via backgroundColor in app.json.
 */
async function generateAdaptiveIcon() {
  const size = 1024;
  const svg = `<svg width="${size}" height="${size}" xmlns="http://www.w3.org/2000/svg">
    <rect width="${size}" height="${size}" fill="${BLACK}"/>
    <text
      x="50%" y="54%"
      text-anchor="middle"
      dominant-baseline="central"
      font-family="Inter, Helvetica Neue, Arial, sans-serif"
      font-weight="700"
      font-size="420"
      fill="${WHITE}"
      letter-spacing="-8"
    >P</text>
  </svg>`;

  await sharp(Buffer.from(svg))
    .resize(size, size)
    .png()
    .toFile(join(ASSETS, "adaptive-icon.png"));

  console.log("✓ adaptive-icon.png (1024x1024)");
}

/**
 * Splash screen icon — centered "PopsDrops" wordmark.
 * Displayed on black background during app launch.
 */
async function generateSplashIcon() {
  const width = 512;
  const height = 512;
  const svg = `<svg width="${width}" height="${height}" xmlns="http://www.w3.org/2000/svg">
    <text
      x="50%" y="50%"
      text-anchor="middle"
      dominant-baseline="central"
      font-family="Inter, Helvetica Neue, Arial, sans-serif"
      font-weight="700"
      font-size="64"
      fill="${WHITE}"
      letter-spacing="-2"
    >PopsDrops</text>
  </svg>`;

  await sharp(Buffer.from(svg))
    .resize(width, height)
    .png({ quality: 100 })
    .toFile(join(ASSETS, "splash-icon.png"));

  console.log("✓ splash-icon.png (512x512)");
}

/**
 * Favicon — 48x48 for web.
 */
async function generateFavicon() {
  const size = 48;
  const svg = `<svg width="${size}" height="${size}" xmlns="http://www.w3.org/2000/svg">
    <rect width="${size}" height="${size}" fill="${BLACK}" rx="8"/>
    <text
      x="50%" y="54%"
      text-anchor="middle"
      dominant-baseline="central"
      font-family="Inter, Helvetica Neue, Arial, sans-serif"
      font-weight="700"
      font-size="30"
      fill="${WHITE}"
    >P</text>
  </svg>`;

  await sharp(Buffer.from(svg))
    .resize(size, size)
    .png()
    .toFile(join(ASSETS, "favicon.png"));

  console.log("✓ favicon.png (48x48)");
}

async function main() {
  console.log("Generating PopsDrops app assets...\n");

  await generateAppIcon();
  await generateAdaptiveIcon();
  await generateSplashIcon();
  await generateFavicon();

  console.log("\nDone. All assets saved to mobile/assets/");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});

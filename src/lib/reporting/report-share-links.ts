const REPORT_SHARE_TOKEN_BYTES = 32;
const REPORT_SHARE_TOKEN_PREFIX = "pd_rpt_";

function toBase64Url(bytes: Uint8Array): string {
  const binary = Array.from(bytes, (byte) => String.fromCharCode(byte)).join("");
  const base64 = btoa(binary);

  return base64.replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
}

function toHex(bytes: ArrayBuffer): string {
  return Array.from(new Uint8Array(bytes), (byte) =>
    byte.toString(16).padStart(2, "0"),
  ).join("");
}

export function createReportShareToken(): string {
  const bytes = new Uint8Array(REPORT_SHARE_TOKEN_BYTES);
  crypto.getRandomValues(bytes);

  return `${REPORT_SHARE_TOKEN_PREFIX}${toBase64Url(bytes)}`;
}

export function isReportShareTokenShape(token: string): boolean {
  return /^pd_rpt_[A-Za-z0-9_-]{40,80}$/.test(token);
}

export async function hashReportShareToken(token: string): Promise<string> {
  const digest = await crypto.subtle.digest(
    "SHA-256",
    new TextEncoder().encode(token),
  );

  return toHex(digest);
}

export function getReportShareTokenPrefix(token: string): string {
  return token.slice(0, 14);
}

export function buildReportShareUrl({
  origin,
  token,
}: {
  origin: string;
  token: string;
}): string {
  return `${origin.replace(/\/$/, "")}/reports/share/${encodeURIComponent(token)}`;
}

export function getReportShareExpiry(days = 30): string {
  const expiry = new Date();
  expiry.setUTCDate(expiry.getUTCDate() + days);

  return expiry.toISOString();
}

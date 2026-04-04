import type { PartnerInquiryInput } from "./validations";

function sanitizeSlackText(value: string) {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll("@", "@\u200B");
}

export function buildPartnerInquirySlackMessage(
  data: PartnerInquiryInput,
): string {
  const track =
    data.type === "brand" ? "Brand market entry" : "Distributor partnership";
  const marketLabel =
    data.type === "brand" ? "Target market" : "Current market";
  const detailsLabel =
    data.type === "brand" ? "What you need" : "What you offer";

  const lines = [
    "*New partner inquiry* :handshake:",
    `*Track:* ${track}`,
    `*Name:* ${sanitizeSlackText(data.full_name)}`,
    `*Email:* ${sanitizeSlackText(data.email)}`,
    `*Company:* ${sanitizeSlackText(data.company_name)}`,
    `*${marketLabel}:* ${sanitizeSlackText(data.market)}`,
  ];

  if (data.website) {
    lines.push(`*Website:* ${sanitizeSlackText(data.website)}`);
  }

  lines.push(`*${detailsLabel}:* ${sanitizeSlackText(data.reason)}`);

  return lines.join("\n");
}

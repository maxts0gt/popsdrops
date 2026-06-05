export type AgreementGateMode =
  | "rules_acknowledgement"
  | "typed_signature"
  | "brand_agreement"
  | "rules_and_brand_agreement";

export type AgreementStatus =
  | "not_required"
  | "pending"
  | "signed"
  | "needs_reacceptance";

export type AgreementRuleSection = {
  title: string;
  body: string;
};

export type AgreementRules = Record<string, AgreementRuleSection>;

export const AGREEMENT_RULE_ORDER = [
  "role",
  "disclosure",
  "claims",
  "usageRights",
  "confidentiality",
  "timeline",
  "reporting",
  "corrections",
] as const;

function formatRuleDate(value: string | null | undefined): string {
  if (!value) return "Not set";
  const date = new Date(value);
  const year = date.getUTCFullYear();
  const month = String(date.getUTCMonth() + 1).padStart(2, "0");
  const day = String(date.getUTCDate()).padStart(2, "0");
  return `${year}/${month}/${day}`;
}

export function normalizeAgreementRules(rules: AgreementRules): AgreementRules {
  return Object.fromEntries(
    Object.entries(rules)
      .sort(([left], [right]) => left.localeCompare(right))
      .map(([key, section]) => [
        key,
        {
          title: section.title.trim(),
          body: section.body.trim().replace(/\s+/g, " "),
        },
      ]),
  );
}

export function buildDefaultAgreementRules(input: {
  campaignTitle: string;
  platforms: string[];
  usageRightsDuration: string | null;
  usageRightsTerritory: string | null;
  usageRightsPaidAds: boolean;
  applicationDeadline: string | null;
  contentDueDate: string | null;
  postingWindowStart: string | null;
  postingWindowEnd: string | null;
  performanceDueDate: string | null;
  requiredEvidence: string[];
}): AgreementRules {
  const platforms = input.platforms.length
    ? input.platforms.join(", ")
    : "selected campaign platforms";
  const evidence = input.requiredEvidence.length
    ? input.requiredEvidence.join(", ")
    : "public URL, proof screenshot, and manual metrics";

  return normalizeAgreementRules({
    role: {
      title: "Campaign role",
      body: `You are joining ${input.campaignTitle} as an accepted creator. Follow the brief, deliverables, dates, and reporting requirements inside this workspace.`,
    },
    disclosure: {
      title: "Disclosure",
      body: `Use clear paid partnership or sponsored disclosure on every required post for ${platforms}. Free products, affiliate offers, and paid work must be disclosed.`,
    },
    claims: {
      title: "Brand claims",
      body: "Use only brand-approved claims. Do not add medical, safety, performance, comparison, pricing, or availability claims unless the brand provides them.",
    },
    usageRights: {
      title: "Usage rights",
      body: `Brand usage is ${input.usageRightsDuration ?? "campaign-defined"} in ${input.usageRightsTerritory ?? "campaign markets"}. Paid ads usage is ${input.usageRightsPaidAds ? "included" : "not included unless separately agreed"}. Keep original files available if the brief requests them.`,
    },
    confidentiality: {
      title: "Confidentiality",
      body: "Keep private materials, unreleased products, pricing, campaign assets, and internal instructions inside this campaign workspace.",
    },
    timeline: {
      title: "Timeline",
      body: `Apply by ${formatRuleDate(input.applicationDeadline)}. Content due ${formatRuleDate(input.contentDueDate)}. Publish from ${formatRuleDate(input.postingWindowStart)} to ${formatRuleDate(input.postingWindowEnd)}. Performance data due ${formatRuleDate(input.performanceDueDate)}.`,
    },
    reporting: {
      title: "Reporting proof",
      body: `Submit required evidence: ${evidence}. Review extracted values and confirm the numbers before they become report data.`,
    },
    corrections: {
      title: "Corrections",
      body: "Respond to correction requests promptly. Resubmit content or reporting proof when the brand requests a correction.",
    },
  });
}

export function getOrderedAgreementRuleEntries(rules: AgreementRules) {
  const knownEntries = AGREEMENT_RULE_ORDER.flatMap((key) => {
    const section = rules[key];
    return section ? [[key, section] as const] : [];
  });
  const extraEntries = Object.entries(rules)
    .filter(([key]) => !(AGREEMENT_RULE_ORDER as readonly string[]).includes(key))
    .sort(([left], [right]) => left.localeCompare(right));

  return [...knownEntries, ...extraEntries];
}

function rightRotate(value: number, amount: number): number {
  return (value >>> amount) | (value << (32 - amount));
}

function sha256Hex(message: string): string {
  const bytes = new TextEncoder().encode(message);
  const bitLength = bytes.length * 8;
  const paddedLength = (((bytes.length + 9 + 63) >> 6) << 6);
  const padded = new Uint8Array(paddedLength);
  padded.set(bytes);
  padded[bytes.length] = 0x80;

  const view = new DataView(padded.buffer);
  view.setUint32(paddedLength - 4, bitLength, false);

  const hash = [
    0x6a09e667, 0xbb67ae85, 0x3c6ef372, 0xa54ff53a,
    0x510e527f, 0x9b05688c, 0x1f83d9ab, 0x5be0cd19,
  ];
  const constants = [
    0x428a2f98, 0x71374491, 0xb5c0fbcf, 0xe9b5dba5,
    0x3956c25b, 0x59f111f1, 0x923f82a4, 0xab1c5ed5,
    0xd807aa98, 0x12835b01, 0x243185be, 0x550c7dc3,
    0x72be5d74, 0x80deb1fe, 0x9bdc06a7, 0xc19bf174,
    0xe49b69c1, 0xefbe4786, 0x0fc19dc6, 0x240ca1cc,
    0x2de92c6f, 0x4a7484aa, 0x5cb0a9dc, 0x76f988da,
    0x983e5152, 0xa831c66d, 0xb00327c8, 0xbf597fc7,
    0xc6e00bf3, 0xd5a79147, 0x06ca6351, 0x14292967,
    0x27b70a85, 0x2e1b2138, 0x4d2c6dfc, 0x53380d13,
    0x650a7354, 0x766a0abb, 0x81c2c92e, 0x92722c85,
    0xa2bfe8a1, 0xa81a664b, 0xc24b8b70, 0xc76c51a3,
    0xd192e819, 0xd6990624, 0xf40e3585, 0x106aa070,
    0x19a4c116, 0x1e376c08, 0x2748774c, 0x34b0bcb5,
    0x391c0cb3, 0x4ed8aa4a, 0x5b9cca4f, 0x682e6ff3,
    0x748f82ee, 0x78a5636f, 0x84c87814, 0x8cc70208,
    0x90befffa, 0xa4506ceb, 0xbef9a3f7, 0xc67178f2,
  ];

  for (let offset = 0; offset < paddedLength; offset += 64) {
    const words = new Array<number>(64);
    for (let index = 0; index < 16; index += 1) {
      words[index] = view.getUint32(offset + index * 4, false);
    }
    for (let index = 16; index < 64; index += 1) {
      const s0 =
        rightRotate(words[index - 15], 7) ^
        rightRotate(words[index - 15], 18) ^
        (words[index - 15] >>> 3);
      const s1 =
        rightRotate(words[index - 2], 17) ^
        rightRotate(words[index - 2], 19) ^
        (words[index - 2] >>> 10);
      words[index] = (words[index - 16] + s0 + words[index - 7] + s1) >>> 0;
    }

    let [a, b, c, d, e, f, g, h] = hash;
    for (let index = 0; index < 64; index += 1) {
      const s1 = rightRotate(e, 6) ^ rightRotate(e, 11) ^ rightRotate(e, 25);
      const ch = (e & f) ^ (~e & g);
      const temp1 = (h + s1 + ch + constants[index] + words[index]) >>> 0;
      const s0 = rightRotate(a, 2) ^ rightRotate(a, 13) ^ rightRotate(a, 22);
      const maj = (a & b) ^ (a & c) ^ (b & c);
      const temp2 = (s0 + maj) >>> 0;

      h = g;
      g = f;
      f = e;
      e = (d + temp1) >>> 0;
      d = c;
      c = b;
      b = a;
      a = (temp1 + temp2) >>> 0;
    }

    hash[0] = (hash[0] + a) >>> 0;
    hash[1] = (hash[1] + b) >>> 0;
    hash[2] = (hash[2] + c) >>> 0;
    hash[3] = (hash[3] + d) >>> 0;
    hash[4] = (hash[4] + e) >>> 0;
    hash[5] = (hash[5] + f) >>> 0;
    hash[6] = (hash[6] + g) >>> 0;
    hash[7] = (hash[7] + h) >>> 0;
  }

  return hash.map((value) => value.toString(16).padStart(8, "0")).join("");
}

export function hashAgreementContent(input: {
  campaignId: string;
  version: number;
  gateMode: AgreementGateMode;
  title: string;
  rules: AgreementRules;
  agreementBody?: string | null;
  fileSha256?: string | null;
}): string {
  const payload = {
    campaignId: input.campaignId,
    version: input.version,
    gateMode: input.gateMode,
    title: input.title.trim(),
    rules: normalizeAgreementRules(input.rules),
    agreementBody: input.agreementBody?.trim() ?? null,
    fileSha256: input.fileSha256 ?? null,
  };

  return sha256Hex(JSON.stringify(payload));
}

export function getAgreementStatusLabelKey(status: AgreementStatus): string {
  return {
    not_required: "agreement.status.notRequired",
    pending: "agreement.status.pending",
    signed: "agreement.status.signed",
    needs_reacceptance: "agreement.status.needsSignature",
  }[status];
}

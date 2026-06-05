export type CreatorInviteContactType = "email" | "handle" | "unknown";
export type CreatorInviteImportStatus =
  | "ready"
  | "duplicate"
  | "invalid"
  | "over_capacity";

export type CreatorInviteImportRow = {
  raw: string;
  value: string;
  normalizedValue: string;
  type: CreatorInviteContactType;
  status: CreatorInviteImportStatus;
};

export type CreatorInviteImportSummary = {
  openSeats: number;
  readyCount: number;
  emailCount: number;
  handleCount: number;
  duplicateCount: number;
  invalidCount: number;
  overCapacityCount: number;
};

export type CreatorInviteImportResult = {
  rows: CreatorInviteImportRow[];
  summary: CreatorInviteImportSummary;
};

const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const handlePattern = /^@[a-z0-9][a-z0-9._-]{1,63}$/i;

function normalizeLine(value: string) {
  return value.trim().replace(/^[,;\s]+|[,;\s]+$/g, "");
}

function splitInviteTokens(rawText: string) {
  return rawText
    .split(/[\r\n,;]+/)
    .map(normalizeLine)
    .filter(Boolean);
}

function normalizeHandle(value: string) {
  const withoutUrl = value
    .replace(/^https?:\/\/(www\.)?/i, "")
    .replace(/^(tiktok\.com|instagram\.com|youtube\.com|x\.com|twitter\.com|facebook\.com)\//i, "")
    .replace(/^@+/, "")
    .split(/[/?#]/)[0]
    ?.trim();

  return withoutUrl ? `@${withoutUrl.toLowerCase()}` : value.toLowerCase();
}

function classifyContact(raw: string) {
  const cleaned = normalizeLine(raw);
  const email = cleaned.toLowerCase();

  if (emailPattern.test(email)) {
    return {
      type: "email" as const,
      value: email,
      normalizedValue: email,
    };
  }

  const handle = normalizeHandle(cleaned);
  if (handlePattern.test(handle)) {
    return {
      type: "handle" as const,
      value: handle,
      normalizedValue: handle,
    };
  }

  return {
    type: "unknown" as const,
    value: cleaned,
    normalizedValue: cleaned.toLowerCase(),
  };
}

export function parseCreatorInviteImport({
  acceptedCount,
  capacity,
  existingContacts = [],
  reservedContacts,
  rawText,
}: {
  acceptedCount: number;
  capacity: number;
  existingContacts?: string[];
  reservedContacts?: string[];
  rawText: string;
}): CreatorInviteImportResult {
  const seen = new Set(existingContacts.map((contact) => contact.toLowerCase()));
  const reserved = new Set(
    (reservedContacts ?? existingContacts).map((contact) => contact.toLowerCase()),
  );
  const openSeats = Math.max(
    Math.floor(capacity) - Math.floor(acceptedCount) - reserved.size,
    0,
  );
  let readyCount = 0;

  const rows = splitInviteTokens(rawText).map((raw) => {
    const classified = classifyContact(raw);
    let status: CreatorInviteImportStatus = "ready";

    if (classified.type === "unknown") {
      status = "invalid";
    } else if (seen.has(classified.normalizedValue)) {
      status = "duplicate";
    } else if (readyCount >= openSeats) {
      status = "over_capacity";
      seen.add(classified.normalizedValue);
    } else {
      readyCount += 1;
      seen.add(classified.normalizedValue);
    }

    return {
      raw,
      value: classified.value,
      normalizedValue: classified.normalizedValue,
      type: classified.type,
      status,
    };
  });

  return {
    rows,
    summary: {
      openSeats,
      readyCount: rows.filter((row) => row.status === "ready").length,
      emailCount: rows.filter((row) => row.status === "ready" && row.type === "email")
        .length,
      handleCount: rows.filter((row) => row.status === "ready" && row.type === "handle")
        .length,
      duplicateCount: rows.filter((row) => row.status === "duplicate").length,
      invalidCount: rows.filter((row) => row.status === "invalid").length,
      overCapacityCount: rows.filter((row) => row.status === "over_capacity").length,
    },
  };
}

import { describe, expect, it } from "vitest";

import { parseCreatorInviteImport } from "./creator-invite-import";

describe("creator invite import parsing", () => {
  it("turns pasted emails and handles into capacity-aware invite rows", () => {
    const result = parseCreatorInviteImport({
      rawText: [
        "creator-one@example.com",
        "@lisa.global",
        "creator-one@example.com",
        "not a contact",
        "creator-two@example.com",
        "@messi",
      ].join("\n"),
      acceptedCount: 1,
      capacity: 4,
    });

    expect(result.summary).toMatchObject({
      openSeats: 3,
      readyCount: 3,
      emailCount: 2,
      handleCount: 1,
      duplicateCount: 1,
      invalidCount: 1,
      overCapacityCount: 1,
    });
    expect(result.rows.map((row) => [row.value, row.type, row.status])).toEqual([
      ["creator-one@example.com", "email", "ready"],
      ["@lisa.global", "handle", "ready"],
      ["creator-one@example.com", "email", "duplicate"],
      ["not a contact", "unknown", "invalid"],
      ["creator-two@example.com", "email", "ready"],
      ["@messi", "handle", "over_capacity"],
    ]);
  });

  it("deduplicates against previously imported contacts before using open seats", () => {
    const result = parseCreatorInviteImport({
      rawText: "VIP@Example.com\n@existing.creator\n@new.creator",
      acceptedCount: 9,
      capacity: 12,
      existingContacts: ["vip@example.com", "@existing.creator"],
    });

    expect(result.summary).toMatchObject({
      openSeats: 1,
      readyCount: 1,
      duplicateCount: 2,
      overCapacityCount: 0,
    });
    expect(result.rows.at(-1)?.value).toBe("@new.creator");
    expect(result.rows.at(-1)?.status).toBe("ready");
  });

  it("reserves capacity for previously saved invite contacts before accepting a new paste", () => {
    const result = parseCreatorInviteImport({
      rawText: "third@example.com\nfourth@example.com\nfirst@example.com",
      acceptedCount: 1,
      capacity: 4,
      existingContacts: ["first@example.com", "second@example.com"],
    });

    expect(result.summary).toMatchObject({
      openSeats: 1,
      readyCount: 1,
      duplicateCount: 1,
      overCapacityCount: 1,
    });
    expect(result.rows.map((row) => [row.value, row.status])).toEqual([
      ["third@example.com", "ready"],
      ["fourth@example.com", "over_capacity"],
      ["first@example.com", "duplicate"],
    ]);
  });

  it("lets applied invite contacts stay duplicate-only when the caller excludes them from reserved capacity", () => {
    const result = parseCreatorInviteImport({
      rawText: "new@example.com\napplied@example.com",
      acceptedCount: 1,
      capacity: 3,
      existingContacts: ["manual@example.com", "applied@example.com"],
      reservedContacts: ["manual@example.com"],
    });

    expect(result.summary).toMatchObject({
      openSeats: 1,
      readyCount: 1,
      duplicateCount: 1,
      overCapacityCount: 0,
    });
    expect(result.rows.map((row) => [row.value, row.status])).toEqual([
      ["new@example.com", "ready"],
      ["applied@example.com", "duplicate"],
    ]);
  });

  it("accepts spreadsheet-style comma and semicolon pasted invite lists", () => {
    const result = parseCreatorInviteImport({
      rawText:
        "creator-one@example.com, @rose.global; https://instagram.com/jisoo.global\ncreator-two@example.com",
      acceptedCount: 0,
      capacity: 4,
    });

    expect(result.summary).toMatchObject({
      openSeats: 4,
      readyCount: 4,
      emailCount: 2,
      handleCount: 2,
      invalidCount: 0,
      overCapacityCount: 0,
    });
    expect(result.rows.map((row) => [row.value, row.type, row.status])).toEqual([
      ["creator-one@example.com", "email", "ready"],
      ["@rose.global", "handle", "ready"],
      ["@jisoo.global", "handle", "ready"],
      ["creator-two@example.com", "email", "ready"],
    ]);
  });
});

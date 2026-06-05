import { describe, expect, it } from "vitest";

import { creatorProfileMatchesInvite } from "./creator-invite-match";

describe("creatorProfileMatchesInvite", () => {
  it("matches email invites against the signed-in creator email", () => {
    expect(
      creatorProfileMatchesInvite({
        creatorAccountProfile: null,
        invite: {
          contact_type: "email",
          normalized_contact: "rose@example.com",
        },
        userEmail: "Rose@Example.com",
      }),
    ).toBe(true);
  });

  it("matches handle invites against social account JSON handles", () => {
    expect(
      creatorProfileMatchesInvite({
        creatorAccountProfile: {
          instagram: {
            handle: "@roses_are_rosie",
            url: "https://instagram.com/roses_are_rosie",
          },
        },
        invite: {
          contact_type: "handle",
          normalized_contact: "@roses_are_rosie",
        },
        userEmail: "rose@example.com",
      }),
    ).toBe(true);
  });

  it("matches handle invites against profile URLs when the handle field is missing", () => {
    expect(
      creatorProfileMatchesInvite({
        creatorAccountProfile: {
          tiktok: {
            url: "https://www.tiktok.com/@lalalalisa_m",
          },
        },
        invite: {
          contact_type: "handle",
          normalized_contact: "@lalalalisa_m",
        },
        userEmail: "lisa@example.com",
      }),
    ).toBe(true);
  });

  it("rejects handle invites when no creator social account matches", () => {
    expect(
      creatorProfileMatchesInvite({
        creatorAccountProfile: {
          youtube: {
            handle: "@another_creator",
            url: "https://youtube.com/@another_creator",
          },
        },
        invite: {
          contact_type: "handle",
          normalized_contact: "@roses_are_rosie",
        },
        userEmail: "rose@example.com",
      }),
    ).toBe(false);
  });
});

import { beforeEach, describe, expect, it, vi } from "vitest";

const { getUser, maybeSingle, eq, update, from } = vi.hoisted(() => ({
  getUser: vi.fn(),
  maybeSingle: vi.fn(),
  eq: vi.fn(),
  update: vi.fn(),
  from: vi.fn(),
}));

vi.mock("./supabase", () => ({
  supabase: {
    auth: {
      getUser,
    },
    from,
  },
}));

import { publishContent } from "./campaign-actions";

describe("publishContent", () => {
  beforeEach(() => {
    vi.clearAllMocks();

    getUser.mockResolvedValue({
      data: {
        user: {
          id: "creator-1",
        },
      },
    });

    const builder = {
      eq,
      select: vi.fn(() => ({
        maybeSingle,
      })),
    };

    eq.mockReturnValue(builder);
    update.mockReturnValue(builder);
    from.mockReturnValue({
      update,
    });
  });

  it("rejects invalid published URLs before touching Supabase", async () => {
    await expect(
      publishContent("submission-1", "not-a-url"),
    ).rejects.toThrow("Invalid published URL");

    expect(from).not.toHaveBeenCalled();
  });

  it("only publishes approved submissions", async () => {
    maybeSingle.mockResolvedValue({
      data: null,
      error: null,
    });

    await expect(
      publishContent("submission-1", "https://example.com/post"),
    ).rejects.toThrow("Submission must be approved before publishing");

    expect(eq).toHaveBeenCalledWith("id", "submission-1");
    expect(eq).toHaveBeenCalledWith("status", "approved");
  });
});

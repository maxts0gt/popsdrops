import { beforeEach, describe, expect, it, vi } from "vitest";

const {
  getUser,
  maybeSingle,
  single,
  eq,
  update,
  insert,
  upsert,
  order,
  limit,
  inFilter,
  isFilter,
  from,
  storageFrom,
  upload,
} = vi.hoisted(() => ({
  getUser: vi.fn(),
  maybeSingle: vi.fn(),
  single: vi.fn(),
  eq: vi.fn(),
  update: vi.fn(),
  insert: vi.fn(),
  upsert: vi.fn(),
  order: vi.fn(),
  limit: vi.fn(),
  inFilter: vi.fn(),
  isFilter: vi.fn(),
  from: vi.fn(),
  storageFrom: vi.fn(),
  upload: vi.fn(),
}));

vi.mock("./supabase", () => ({
  supabase: {
    auth: {
      getUser,
    },
    from,
    storage: {
      from: storageFrom,
    },
  },
}));

import {
  buildCreatorSubmittedMetricValueRows,
  publishContent,
  submitContent,
  submitPerformance,
  uploadPerformanceEvidenceFile,
  withdrawApplication,
} from "./campaign-actions";

describe("buildCreatorSubmittedMetricValueRows", () => {
  it("mirrors native creator metrics into normalized reporting rows", () => {
    expect(
      buildCreatorSubmittedMetricValueRows({
        performanceId: "performance-1",
        reportTaskId: "task-1",
        platform: "instagram",
        metrics: {
          views: 4321,
          likes: 321,
          comments: 24,
          shares: 18,
          saves: 9,
          reach: undefined,
          impressions: Number.NaN,
        },
      }),
    ).toEqual([
      {
        performance_id: "performance-1",
        report_task_id: "task-1",
        platform: "instagram",
        metric_key: "views",
        metric_label: "Views",
        metric_value: 4321,
        metric_text: null,
        source_type: "creator_manual",
        confirmed_by_creator: true,
        confirmed_at: expect.any(String),
      },
      {
        performance_id: "performance-1",
        report_task_id: "task-1",
        platform: "instagram",
        metric_key: "likes",
        metric_label: "Likes",
        metric_value: 321,
        metric_text: null,
        source_type: "creator_manual",
        confirmed_by_creator: true,
        confirmed_at: expect.any(String),
      },
      {
        performance_id: "performance-1",
        report_task_id: "task-1",
        platform: "instagram",
        metric_key: "comments",
        metric_label: "Comments",
        metric_value: 24,
        metric_text: null,
        source_type: "creator_manual",
        confirmed_by_creator: true,
        confirmed_at: expect.any(String),
      },
      {
        performance_id: "performance-1",
        report_task_id: "task-1",
        platform: "instagram",
        metric_key: "shares",
        metric_label: "Shares",
        metric_value: 18,
        metric_text: null,
        source_type: "creator_manual",
        confirmed_by_creator: true,
        confirmed_at: expect.any(String),
      },
      {
        performance_id: "performance-1",
        report_task_id: "task-1",
        platform: "instagram",
        metric_key: "saves",
        metric_label: "Saves",
        metric_value: 9,
        metric_text: null,
        source_type: "creator_manual",
        confirmed_by_creator: true,
        confirmed_at: expect.any(String),
      },
    ]);
  });

  it("uses one confirmation timestamp for the creator-submitted metric group", () => {
    const rows = buildCreatorSubmittedMetricValueRows({
      performanceId: "performance-1",
      reportTaskId: "task-1",
      platform: "instagram",
      metrics: {
        views: 100,
        likes: 10,
      },
    });

    expect(rows).toHaveLength(2);
    expect(rows.every((row) => row.confirmed_by_creator)).toBe(true);
    expect(rows[0].confirmed_at).toBe(rows[1].confirmed_at);
  });
});

describe("withdrawApplication", () => {
  beforeEach(() => {
    vi.clearAllMocks();

    getUser.mockResolvedValue({
      data: {
        user: {
          id: "creator-1",
        },
      },
    });

    const builder: {
      eq: typeof eq;
      in: typeof inFilter;
      select: ReturnType<typeof vi.fn>;
      single: typeof single;
      update: typeof update;
    } = {
      eq,
      in: inFilter,
      select: vi.fn(() => builder),
      single,
      update,
    };
    eq.mockReturnValue(builder);
    inFilter.mockReturnValue(builder);
    update.mockReturnValue(builder);
    from.mockReturnValue(builder);
  });

  it("rejects closed campaign withdrawal before updating Supabase", async () => {
    single.mockResolvedValueOnce({
      data: {
        campaign_id: "campaign-1",
        creator_id: "creator-1",
        status: "pending",
        campaigns: {
          status: "completed",
          application_deadline: null,
        },
      },
      error: null,
    });

    await expect(withdrawApplication("application-1")).rejects.toThrow(
      "Application withdrawal is closed for this campaign stage.",
    );

    expect(update).not.toHaveBeenCalled();
  });
});

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

    const builder: {
      eq: typeof eq;
      maybeSingle: typeof maybeSingle;
      select: ReturnType<typeof vi.fn>;
      update: typeof update;
    } = {
      eq,
      maybeSingle,
      select: vi.fn(() => builder),
      update,
    };
    eq.mockReturnValue(builder);
    update.mockReturnValue(builder);
    from.mockReturnValue(builder);
  });

  it("rejects invalid published URLs before touching Supabase", async () => {
    await expect(
      publishContent("submission-1", "not-a-url"),
    ).rejects.toThrow("Invalid published URL");

    expect(from).not.toHaveBeenCalled();
  });

  it("only publishes approved submissions", async () => {
    maybeSingle.mockResolvedValueOnce({
      data: {
        id: "submission-1",
        campaign_member_id: "member-1",
        status: "submitted",
      },
      error: null,
    });

    await expect(
      publishContent("submission-1", "https://example.com/post"),
    ).rejects.toThrow("Submission must be approved before publishing");

    expect(eq).toHaveBeenCalledWith("id", "submission-1");
    expect(update).not.toHaveBeenCalled();
  });

  it("blocks publishing when the campaign has already completed", async () => {
    maybeSingle.mockResolvedValueOnce({
      data: {
        id: "submission-1",
        campaign_member_id: "member-1",
        status: "approved",
        campaign_members: {
          creator_id: "creator-1",
          campaign_id: "campaign-1",
          campaigns: {
            status: "completed",
          },
        },
      },
      error: null,
    });

    await expect(
      publishContent("submission-1", "https://example.com/post"),
    ).rejects.toThrow("Creator work is closed for this campaign stage.");

    expect(update).not.toHaveBeenCalled();
  });
});

describe("submitContent", () => {
  beforeEach(() => {
    vi.clearAllMocks();

    getUser.mockResolvedValue({
      data: {
        user: {
          id: "creator-1",
        },
      },
    });

    const builder: {
      eq: typeof eq;
      insert: typeof insert;
      is: typeof isFilter;
      limit: typeof limit;
      maybeSingle: typeof maybeSingle;
      order: typeof order;
      select: ReturnType<typeof vi.fn>;
      single: typeof single;
    } = {
      eq,
      insert,
      is: isFilter,
      limit,
      maybeSingle,
      order,
      select: vi.fn(() => builder),
      single,
    };
    eq.mockReturnValue(builder);
    order.mockReturnValue(builder);
    limit.mockReturnValue(builder);
    insert.mockReturnValue(builder);
    isFilter.mockReturnValue(builder);
    from.mockReturnValue(builder);
  });

  it("blocks creator draft submission when the campaign has already completed", async () => {
    single.mockResolvedValueOnce({
      data: {
        id: "member-1",
        creator_id: "creator-1",
        campaigns: {
          status: "completed",
        },
      },
      error: null,
    });

    await expect(
      submitContent({
        campaign_member_id: "11111111-1111-4111-8111-111111111111",
        content_url: "https://example.com/draft",
        platform: "tiktok",
      }),
    ).rejects.toThrow("Creator work is closed for this campaign stage.");

    expect(insert).not.toHaveBeenCalled();
  });
});

describe("submitPerformance", () => {
  beforeEach(() => {
    vi.clearAllMocks();

    getUser.mockResolvedValue({
      data: {
        user: {
          id: "creator-1",
        },
      },
    });

    const builder: {
      eq: typeof eq;
      insert: typeof insert;
      is: typeof isFilter;
      limit: typeof limit;
      maybeSingle: typeof maybeSingle;
      order: typeof order;
      select: ReturnType<typeof vi.fn>;
      single: typeof single;
      upsert: typeof upsert;
    } = {
      eq,
      insert,
      is: isFilter,
      limit,
      maybeSingle,
      order,
      select: vi.fn(() => builder),
      single,
      upsert,
    };
    eq.mockReturnValue(builder);
    order.mockReturnValue(builder);
    limit.mockReturnValue(builder);
    insert.mockReturnValue(builder);
    isFilter.mockReturnValue(builder);
    from.mockReturnValue(builder);
    upsert.mockResolvedValue({ error: null });
  });

  it("blocks creator metric submission when the campaign has already completed", async () => {
    maybeSingle.mockResolvedValueOnce({
      data: {
        id: "submission-1",
        platform: "tiktok",
        campaign_member_id: "member-1",
        campaign_members: {
          id: "member-1",
          campaign_id: "campaign-1",
          creator_id: "creator-1",
          campaigns: {
            status: "completed",
          },
        },
      },
      error: null,
    });
    single.mockResolvedValueOnce({
      data: {
        id: "member-1",
        campaign_id: "campaign-1",
        creator_id: "creator-1",
        campaigns: {
          status: "completed",
        },
      },
      error: null,
    });

    await expect(
      submitPerformance({
        submission_id: "22222222-2222-4222-8222-222222222222",
        measurement_type: "final_7d",
        views: 1200,
      }),
    ).rejects.toThrow("Creator work is closed for this campaign stage.");

    expect(insert).not.toHaveBeenCalled();
    expect(upsert).not.toHaveBeenCalled();
  });
});

describe("uploadPerformanceEvidenceFile", () => {
  beforeEach(() => {
    vi.clearAllMocks();

    getUser.mockResolvedValue({
      data: {
        user: {
          id: "creator-1",
        },
      },
    });

    const builder: {
      eq: typeof eq;
      insert: typeof insert;
      maybeSingle: typeof maybeSingle;
      select: ReturnType<typeof vi.fn>;
      single: typeof single;
    } = {
      eq,
      insert,
      maybeSingle,
      select: vi.fn(() => builder),
      single,
    };
    eq.mockReturnValue(builder);
    insert.mockReturnValue(builder);
    from.mockReturnValue(builder);
    storageFrom.mockReturnValue({ upload });
    upload.mockResolvedValue({ error: null });
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: true,
        arrayBuffer: async () => new Uint8Array([1, 2, 3]).buffer,
      }),
    );
  });

  it("blocks proof uploads when the campaign has already completed", async () => {
    single
      .mockResolvedValueOnce({
        data: {
          id: "task-1",
          campaign_id: "campaign-1",
          campaign_member_id: "member-1",
          campaign_members: {
            creator_id: "creator-1",
            campaigns: {
              status: "completed",
            },
          },
        },
        error: null,
      })
      .mockResolvedValueOnce({
        data: {
          id: "evidence-1",
          storage_path: "campaign-1/member-1/task-1/evidence-1/proof.csv",
        },
        error: null,
      });
    maybeSingle.mockResolvedValueOnce({
      data: {
        status: "signed",
      },
      error: null,
    });

    await expect(
      uploadPerformanceEvidenceFile({
        reportTaskId: "33333333-3333-4333-8333-333333333333",
        file: {
          uri: "file:///proof.csv",
          name: "proof.csv",
          mimeType: "text/csv",
          size: 3,
        },
      }),
    ).rejects.toThrow("Creator work is closed for this campaign stage.");

    expect(globalThis.fetch).not.toHaveBeenCalled();
    expect(insert).not.toHaveBeenCalled();
    expect(upload).not.toHaveBeenCalled();
  });
});

import { describe, expect, it } from "vitest";

import { getCampaignCloseoutReadiness } from "./campaign-closeout";

describe("campaign closeout readiness", () => {
  it("is ready only when a running campaign has members, published live URLs, and settled reports", () => {
    expect(
      getCampaignCloseoutReadiness({
        campaignStatus: "monitoring",
        pendingApplicants: 0,
        members: [{ id: "member-1" }],
        submissions: [
          {
            campaignMemberId: "member-1",
            publishedUrl: "https://www.instagram.com/reel/1/",
            status: "published",
          },
        ],
        reportTasks: [
          {
            campaignMemberId: "member-1",
            status: "verified",
          },
        ],
      }),
    ).toMatchObject({
      ready: true,
      blockers: [],
    });
  });

  it("keeps completion locked while content, proof, or recruiting work is still open", () => {
    const readiness = getCampaignCloseoutReadiness({
      campaignStatus: "monitoring",
      pendingApplicants: 1,
      members: [{ id: "member-1" }, { id: "member-2" }],
      submissions: [
        {
          campaignMemberId: "member-1",
          publishedUrl: "https://www.instagram.com/reel/1/",
          status: "published",
        },
        {
          campaignMemberId: "member-2",
          publishedUrl: null,
          status: "approved",
        },
      ],
      reportTasks: [
        {
          campaignMemberId: "member-1",
          status: "verified",
        },
        {
          campaignMemberId: "member-2",
          status: "submitted",
        },
      ],
    });

    expect(readiness.ready).toBe(false);
    expect(readiness.blockers).toEqual([
      "pending_applicants",
      "missing_live_urls",
      "unsettled_reports",
    ]);
  });

  it("ignores superseded content revision rows when checking closeout", () => {
    expect(
      getCampaignCloseoutReadiness({
        campaignStatus: "monitoring",
        pendingApplicants: 0,
        members: [{ id: "member-1" }],
        submissions: [
          {
            id: "submission-v2",
            parentSubmissionId: "submission-v1",
            campaignMemberId: "member-1",
            publishedUrl: "https://www.instagram.com/reel/2/",
            status: "published",
          },
          {
            id: "submission-v1",
            parentSubmissionId: null,
            campaignMemberId: "member-1",
            publishedUrl: null,
            status: "revision_requested",
          },
        ],
        reportTasks: [
          {
            campaignMemberId: "member-1",
            status: "verified",
          },
        ],
      }),
    ).toMatchObject({
      ready: true,
      blockers: [],
    });
  });

  it("only allows closeout from monitoring campaigns", () => {
    for (const campaignStatus of [
      "draft",
      "recruiting",
      "in_progress",
      "publishing",
      "paused",
      "cancelled",
      "completed",
    ]) {
      expect(
        getCampaignCloseoutReadiness({
          campaignStatus,
          pendingApplicants: 0,
          members: [{ id: "member-1" }],
          submissions: [
            {
              campaignMemberId: "member-1",
              publishedUrl: "https://www.instagram.com/reel/1/",
              status: "published",
            },
          ],
          reportTasks: [
            {
              campaignMemberId: "member-1",
              status: "verified",
            },
          ],
        }).ready,
      ).toBe(false);
    }
  });
});

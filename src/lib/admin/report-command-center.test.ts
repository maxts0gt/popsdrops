import { describe, expect, it } from "vitest";

import {
  buildReportCommandCenter,
  formatReportCommandWaitingAge,
  type ReportCommandCampaignMeta,
  type ReportCommandEvidenceRow,
  type ReportCommandExportJobRow,
  type ReportCommandTaskRow,
} from "./report-command-center";

describe("admin report command center model", () => {
  const campaign: ReportCommandCampaignMeta = {
    brandName: "Hermes Japan",
    id: "campaign-1",
    status: "monitoring",
    title: "Tokyo launch proof room",
  };

  const tasks: ReportCommandTaskRow[] = [
    {
      id: "missed-task",
      campaign_id: campaign.id,
      campaign_member_id: "member-1",
      due_at: "2026-06-01T09:00:00.000Z",
      missed_at: "2026-06-02T09:00:00.000Z",
      review_note: null,
      status: "missed",
      submitted_at: null,
      updated_at: "2026-06-02T09:00:00.000Z",
    },
    {
      id: "revision-task",
      campaign_id: campaign.id,
      campaign_member_id: "member-1",
      due_at: "2026-06-01T09:00:00.000Z",
      missed_at: null,
      review_note: "Visible account name is missing.",
      status: "needs_revision",
      submitted_at: "2026-06-01T08:30:00.000Z",
      updated_at: "2026-06-01T10:00:00.000Z",
    },
  ];

  const chanelCampaign: ReportCommandCampaignMeta = {
    brandName: "Chanel Korea",
    id: "campaign-2",
    status: "monitoring",
    title: "Seoul boutique proof room",
  };

  const evidenceRows: ReportCommandEvidenceRow[] = [
    {
      id: "stale-submitted-proof",
      campaign_id: campaign.id,
      campaign_member_id: "member-1",
      created_at: "2026-06-01T00:00:00.000Z",
      file_name: "stale-proof.png",
      report_task_id: "submitted-task",
      review_note: null,
      verification_status: "submitted",
    },
    {
      id: "old-rejected-correction",
      campaign_id: campaign.id,
      campaign_member_id: "member-1",
      created_at: "2026-06-03T09:00:00.000Z",
      file_name: "old-correction.png",
      report_task_id: "returned-task",
      review_note: "Date window was cropped.",
      verification_status: "rejected",
    },
    {
      id: "returned-submitted-correction",
      campaign_id: campaign.id,
      campaign_member_id: "member-1",
      created_at: "2026-06-03T10:00:00.000Z",
      file_name: "returned-correction.png",
      report_task_id: "returned-task",
      review_note: null,
      verification_status: "submitted",
    },
    {
      id: "current-rejected-proof",
      campaign_id: campaign.id,
      campaign_member_id: "member-2",
      created_at: "2026-06-03T11:00:00.000Z",
      file_name: "rejected-proof.png",
      report_task_id: "rejected-task",
      review_note: "Account identity is not visible.",
      verification_status: "rejected",
    },
  ];

  const exportRows: ReportCommandExportJobRow[] = [
    {
      id: "failed-export",
      campaign_id: campaign.id,
      created_at: "2026-06-04T09:00:00.000Z",
      error_message: "PDF renderer failed before storage.",
      file_name: "leadership-report.pdf",
      format: "pdf",
      status: "failed",
    },
  ];

  it("formats waiting age as an operator urgency signal", () => {
    const now = new Date("2026-06-04T09:30:00.000Z").getTime();

    expect(
      formatReportCommandWaitingAge("2026-06-04T09:01:00.000Z", now),
    ).toBe("29m waiting");
    expect(
      formatReportCommandWaitingAge("2026-06-04T03:00:00.000Z", now),
    ).toBe("6h waiting");
    expect(
      formatReportCommandWaitingAge("2026-06-01T00:00:00.000Z", now),
    ).toBe("3d waiting");
    expect(formatReportCommandWaitingAge("not-a-date", now)).toBe(
      "Waiting time unknown",
    );
  });

  it("prioritizes leadership-blocking proof risks and gives every row an action contract", () => {
    const command = buildReportCommandCenter({
      campaigns: new Map([[campaign.id, campaign]]),
      evidenceRows,
      exportRows,
      now: new Date("2026-06-04T09:30:00.000Z").getTime(),
      tasks,
    });

    expect(command.reviewSlaBreachCount).toBe(1);
    expect(command.exportFailureCount).toBe(1);
    expect(command.missedCount).toBe(1);
    expect(command.correctionCount).toBe(2);
    expect(command.evidenceReviewCount).toBe(2);

    expect(command.rows).toHaveLength(6);
    expect(command.rows.map((row) => row.kind)).toEqual([
      "review_sla",
      "export_failure",
      "missed",
      "correction",
      "correction_returned",
      "correction",
    ]);

    const priority = command.rows[0];
    expect(priority.title).toBe("Proof review older than 24h");
    expect(priority.waitingLabel).toBe("3d waiting");
    expect(priority.impact).toBe(
      "Blocks report confidence until brand confirms proof.",
    );
    expect(priority.shareGate).toBe(
      "Leadership hold until brand verifies submitted proof.",
    );
    expect(priority.nextStep).toBe(
      "Open the campaign and push brand proof review.",
    );
    expect(priority.owner).toBe("Brand owner");
    expect(priority.clearance).toBe(
      "Brand reviews or requests correction on submitted proof.",
    );

    expect(
      command.rows.every(
        (row) =>
          row.actionHref ===
            `/admin/campaigns/${campaign.id}?focus=reporting#admin-reporting-exceptions` &&
          row.actionLabel === "Open campaign" &&
          row.impact.length > 0 &&
          row.shareGate.startsWith("Leadership hold") &&
          row.nextStep.length > 0 &&
          row.owner.length > 0 &&
          row.clearance.length > 0 &&
          row.waitingLabel.length > 0,
      ),
    ).toBe(true);

    expect(command.rows.some((row) => row.id === "evidence:old-rejected-correction"))
      .toBe(false);
    expect(
      command.rows.find(
        (row) => row.id === "evidence:returned-submitted-correction",
      ),
    ).toMatchObject({
      kind: "correction_returned",
      label: "Correction returned",
      title: "Corrected proof awaiting brand review",
    });
  });

  it("summarizes campaign-level leadership readiness from open report exceptions", () => {
    const command = buildReportCommandCenter({
      campaigns: new Map([
        [campaign.id, campaign],
        [chanelCampaign.id, chanelCampaign],
      ]),
      evidenceRows: [
        ...evidenceRows,
        {
          id: "fresh-chanel-proof",
          campaign_id: chanelCampaign.id,
          campaign_member_id: "member-3",
          created_at: "2026-06-04T08:00:00.000Z",
          file_name: "chanel-proof.png",
          report_task_id: "chanel-submitted-task",
          review_note: null,
          verification_status: "submitted",
        },
      ],
      exportRows,
      now: new Date("2026-06-04T09:30:00.000Z").getTime(),
      tasks,
    });

    expect(command.campaignHoldCount).toBe(2);
    expect(command.campaignReadiness).toHaveLength(2);
    expect(command.campaignReadiness[0]).toMatchObject({
      actionHref: `/admin/campaigns/${campaign.id}?focus=reporting#admin-reporting-exceptions`,
      blockerCount: 6,
      campaign,
      clearance: "Brand reviews or requests correction on submitted proof.",
      leadershipStatus: "Leadership hold",
      primaryKind: "review_sla",
      primaryLabel: "Review SLA breach",
      shareGate: "Leadership hold until brand verifies submitted proof.",
      waitingLabel: "3d waiting",
    });
    expect(command.campaignReadiness[0].summary).toBe(
      "6 blockers: Review SLA breach is the top leadership gate.",
    );
    expect(command.campaignReadiness[1]).toMatchObject({
      actionHref: `/admin/campaigns/${chanelCampaign.id}?focus=reporting#admin-reporting-exceptions`,
      blockerCount: 1,
      campaign: chanelCampaign,
      leadershipStatus: "Leadership hold",
      primaryKind: "evidence_review",
      primaryLabel: "Needs brand review",
      shareGate: "Leadership hold until brand verifies submitted proof.",
      waitingLabel: "1h waiting",
    });
  });
});

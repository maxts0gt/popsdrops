import { describe, expect, it } from "vitest";
import type { ReportExportData } from "./report-export";
import {
  getSharedReportLeadershipGate,
  getSharedReportNextAction,
  getSharedReportProofBasis,
  getSharedReportTrustDecision,
} from "./shared-report-trust";

describe("shared report trust decision", () => {
  it("treats fully verified ready-for-review reports as leadership-ready", () => {
    const trustDecision = getSharedReportTrustDecision({
      trust: [
        {
          key: "evidence_backed_reads",
          label: "Evidence-backed reads",
          value: "1/1",
          detail: "Native analytics screenshots",
        },
        {
          key: "verified_reads",
          label: "Verified reads",
          value: "1/1",
          detail: "Verified by source evidence",
        },
        {
          key: "report_status",
          label: "Report status",
          value: "Ready for review",
          detail: "1/1 submitted",
        },
      ],
    });

    expect(trustDecision).toBe("Ready for leadership sharing.");
    expect(getSharedReportLeadershipGate(trustDecision)).toMatchObject({
      state: "ready",
      label: "Leadership-ready",
    });
  });

  it("keeps submitted reports on hold when verified reads are incomplete", () => {
    const trustDecision = getSharedReportTrustDecision({
      trust: [
        {
          key: "evidence_backed_reads",
          label: "Evidence-backed reads",
          value: "1/1",
          detail: "Native analytics screenshots",
        },
        {
          key: "verified_reads",
          label: "Verified reads",
          value: "0/1",
          detail: "Supported by source evidence",
        },
        {
          key: "report_status",
          label: "Report status",
          value: "1 awaiting review",
          detail: "1/1 submitted",
        },
      ],
    });

    expect(trustDecision).toBe("Keep in proof room until evidence is reviewed.");
    expect(getSharedReportNextAction({
      trust: [
        {
          key: "evidence_backed_reads",
          label: "Evidence-backed reads",
          value: "1/1",
          detail: "Native analytics screenshots",
        },
        {
          key: "verified_reads",
          label: "Verified reads",
          value: "0/1",
          detail: "Supported by source evidence",
        },
        {
          key: "report_status",
          label: "Report status",
          value: "1 awaiting review",
          detail: "1/1 submitted",
        },
      ],
    })).toBe("Review 1 submitted proof read before sharing.");
    expect(getSharedReportLeadershipGate(trustDecision)).toMatchObject({
      state: "hold",
      label: "Leadership hold",
    });
  });

  it("does not treat proof coverage alone as brand-reviewed leadership evidence", () => {
    const trustDecision = getSharedReportTrustDecision({
      trust: [
        {
          key: "evidence_backed_reads",
          label: "Evidence-backed reads",
          value: "1/1",
          detail: "Native analytics screenshots",
        },
        {
          key: "report_status",
          label: "Report status",
          value: "Ready for leadership",
          detail: "1/1 submitted",
        },
      ],
    });

    expect(trustDecision).toBe("Keep in proof room until evidence is reviewed.");
    expect(getSharedReportLeadershipGate(trustDecision)).toMatchObject({
      state: "hold",
      label: "Leadership hold",
    });
  });

  it("uses the authoritative leadership handoff when visible shared tiles hide verified reads", () => {
    const sharedReport: Pick<ReportExportData, "trust" | "leadershipHandoff"> = {
      trust: [
        {
          key: "evidence_backed_reads",
          label: "Proof coverage",
          value: "1/1",
          detail: "Native analytics screenshots",
        },
        {
          key: "data_window",
          label: "Read window",
          value: "2026/06/04 - 2026/06/04",
          detail: "Platform read dates",
        },
        {
          key: "data_source",
          label: "Metric origin",
          value: "Brand-reviewed proof",
          detail: "Creator evidence reviewed by brand",
        },
      ],
      leadershipHandoff: {
        state: "ready",
        label: "Share with leadership",
        decision: "Ready for leadership sharing.",
        proofBasis: [
          { key: "included", label: "Included", value: 1 },
          { key: "needs-review", label: "Needs review", value: 0 },
          { key: "corrections", label: "Corrections", value: 0 },
          { key: "missing-proof", label: "Missing proof", value: 0 },
        ],
      },
    };

    expect(getSharedReportTrustDecision(sharedReport)).toBe(
      "Ready for leadership sharing.",
    );
    expect(getSharedReportProofBasis(sharedReport)).toEqual([
      { key: "included", value: 1 },
      { key: "needs-review", value: 0 },
      { key: "corrections", value: 0 },
      { key: "missing-proof", value: 0 },
    ]);
    expect(getSharedReportNextAction(sharedReport)).toBe(
      "Share the verified proof room with leadership.",
    );
  });

  it("uses authoritative leadership state even when decision copy looks ready", () => {
    const sharedReport: Pick<ReportExportData, "trust" | "leadershipHandoff"> = {
      trust: [
        {
          key: "evidence_backed_reads",
          label: "Proof coverage",
          value: "1/1",
          detail: "Native analytics screenshots",
        },
      ],
      leadershipHandoff: {
        state: "hold",
        label: "Leadership hold",
        decision: "Ready for leadership sharing.",
        proofBasis: [
          { key: "included", label: "Included", value: 0 },
          { key: "needs-review", label: "Needs review", value: 1 },
          { key: "corrections", label: "Corrections", value: 0 },
          { key: "missing-proof", label: "Missing proof", value: 0 },
        ],
      },
    };

    expect(getSharedReportLeadershipGate(sharedReport)).toMatchObject({
      state: "hold",
      label: "Leadership hold",
      detail: "Ready for leadership sharing.",
    });
  });

  it("uses authoritative proof basis counts for shared report next actions", () => {
    const sharedReport: Pick<ReportExportData, "trust" | "leadershipHandoff"> = {
      trust: [
        {
          key: "evidence_backed_reads",
          label: "Proof coverage",
          value: "1/1",
          detail: "Native analytics screenshots",
        },
      ],
      leadershipHandoff: {
        state: "hold",
        label: "Leadership hold",
        decision: "Keep in proof room until evidence is reviewed.",
        proofBasis: [
          { key: "included", label: "Included", value: 0 },
          { key: "needs-review", label: "Needs review", value: 1 },
          { key: "corrections", label: "Corrections", value: 0 },
          { key: "missing-proof", label: "Missing proof", value: 0 },
        ],
      },
    };

    expect(getSharedReportNextAction(sharedReport)).toBe(
      "Review 1 submitted proof read before sharing.",
    );
  });

  it("keeps reports with no submitted proof reads on leadership hold", () => {
    const trustDecision = getSharedReportTrustDecision({
      trust: [
        {
          key: "evidence_backed_reads",
          label: "Evidence-backed reads",
          value: "0/0",
          detail: "Native analytics screenshots",
        },
        {
          key: "verified_reads",
          label: "Verified reads",
          value: "0/0",
          detail: "Verified by source evidence",
        },
        {
          key: "report_status",
          label: "Report status",
          value: "Ready for review",
          detail: "0/0 submitted",
        },
      ],
    });

    expect(trustDecision).toBe(
      "Keep in proof room until at least one proof read is submitted and reviewed.",
    );
    expect(getSharedReportLeadershipGate(trustDecision)).toMatchObject({
      state: "hold",
      label: "Leadership hold",
    });
    expect(getSharedReportNextAction({
      trust: [
        {
          key: "evidence_backed_reads",
          label: "Evidence-backed reads",
          value: "0/0",
          detail: "Native analytics screenshots",
        },
        {
          key: "verified_reads",
          label: "Verified reads",
          value: "0/0",
          detail: "Verified by source evidence",
        },
        {
          key: "report_status",
          label: "Report status",
          value: "Ready for review",
          detail: "0/0 submitted",
        },
      ],
    })).toBe("Collect and review the first proof read before sharing.");
  });

  it("keeps correction states on hold even when proof counts are complete", () => {
    expect(
      getSharedReportTrustDecision({
        trust: [
          {
            key: "evidence_backed_reads",
            label: "Evidence-backed reads",
            value: "1/1",
            detail: "Native analytics screenshots",
          },
          {
            key: "verified_reads",
            label: "Verified reads",
            value: "1/1",
            detail: "Verified by source evidence",
          },
          {
            key: "report_status",
            label: "Report status",
            value: "Needs revision",
            detail: "Brand requested a correction",
          },
        ],
      }),
    ).toBe("Resolve correction requests before leadership sharing.");
    expect(
      getSharedReportNextAction({
        trust: [
          {
            key: "evidence_backed_reads",
            label: "Evidence-backed reads",
            value: "2/2",
            detail: "Native analytics screenshots",
          },
          {
            key: "verified_reads",
            label: "Verified reads",
            value: "1/2",
            detail: "Verified by source evidence",
          },
          {
            key: "report_status",
            label: "Report status",
            value: "1 correction pending",
            detail: "Brand requested a correction",
          },
        ],
      }),
    ).toBe("Resolve 1 correction request before leadership sharing.");
  });

  it("summarizes the proof basis behind shared leadership decisions", () => {
    expect(
      getSharedReportProofBasis({
        trust: [
          {
            key: "evidence_backed_reads",
            label: "Proof coverage",
            value: "3/4",
            detail: "Native analytics screenshots",
          },
          {
            key: "verified_reads",
            label: "Verified reads",
            value: "2/4",
            detail: "Brand-reviewed proof",
          },
          {
            key: "report_status",
            label: "Report status",
            value: "1 correction pending",
            detail: "Creator reporting tasks",
          },
        ],
      }),
    ).toEqual([
      { key: "included", value: 2 },
      { key: "needs-review", value: 0 },
      { key: "corrections", value: 1 },
      { key: "missing-proof", value: 1 },
    ]);
  });

  it("prioritizes missing proof next actions before leadership sharing", () => {
    expect(
      getSharedReportNextAction({
        trust: [
          {
            key: "evidence_backed_reads",
            label: "Proof coverage",
            value: "1/2",
            detail: "Native analytics screenshots",
          },
          {
            key: "verified_reads",
            label: "Verified reads",
            value: "1/2",
            detail: "Brand-reviewed proof",
          },
          {
            key: "report_status",
            label: "Report status",
            value: "1/2 submitted",
            detail: "Creator reporting tasks",
          },
        ],
      }),
    ).toBe("Ask creator to upload 1 missing proof read.");
  });
});

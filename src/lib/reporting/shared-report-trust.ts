import type { ReportExportData } from "./report-export";

export type SharedReportLeadershipState = "ready" | "hold";

export type SharedReportProofBasisKey =
  | "included"
  | "needs-review"
  | "corrections"
  | "missing-proof";

const noSubmittedProofDecision =
  "Keep in proof room until at least one proof read is submitted and reviewed.";

type SharedReportTrustData = Pick<ReportExportData, "trust" | "leadershipHandoff">;

export function getSharedReportLeadershipGate(trustDecision: string): {
  state: SharedReportLeadershipState;
  label: string;
  detail: string;
} {
  if (trustDecision === "Ready for leadership sharing.") {
    return {
      state: "ready",
      label: "Leadership-ready",
      detail: trustDecision,
    };
  }

  return {
    state: "hold",
    label: "Leadership hold",
    detail: trustDecision,
  };
}

function parseSharedReportRatio(
  value: string,
): { numerator: number; denominator: number } | null {
  const match = value.trim().match(/^(\d+)\s*\/\s*(\d+)/);
  if (!match) return null;

  const numerator = Number(match[1]);
  const denominator = Number(match[2]);
  if (!Number.isFinite(numerator) || !Number.isFinite(denominator)) return null;

  return { numerator, denominator };
}

function isIncompleteReportStatusValue(value: string): boolean {
  return /\b(missing|incomplete|pending|submitted|unreviewed|awaiting)\b/.test(value) ||
    /\bneeds?\s+review\b/.test(value);
}

function getSharedReportEvidenceCoverageItem(
  data: Pick<ReportExportData, "trust">,
) {
  return data.trust.find((item) =>
    item.key === "evidence_backed_reads" ||
    item.label.toLowerCase().includes("evidence") ||
    item.label.toLowerCase().includes("proof"),
  );
}

function getSharedReportVerifiedReadsItem(
  data: Pick<ReportExportData, "trust">,
) {
  return data.trust.find((item) =>
    item.key === "verified_reads" ||
    item.label.toLowerCase().includes("verified"),
  );
}

function getSharedReportStatusItem(
  data: Pick<ReportExportData, "trust">,
) {
  return data.trust.find((item) =>
    item.key === "report_status" ||
    item.label.toLowerCase().includes("status"),
  );
}

function getSharedReportCorrectionCount(
  data: Pick<ReportExportData, "trust">,
): number {
  const reportStatus = getSharedReportStatusItem(data);
  const statusText = `${reportStatus?.label ?? ""} ${reportStatus?.value ?? ""} ${reportStatus?.detail ?? ""}`.toLowerCase();

  if (!/\bcorrection|revision|rejected\b/.test(statusText)) return 0;

  const explicitCount = Number.parseInt(
    statusText.match(/\b(\d+)\b/)?.[1] ?? "",
    10,
  );

  return Number.isFinite(explicitCount) && explicitCount > 0
    ? explicitCount
    : 1;
}

function formatSharedReportCount(count: number, singular: string, plural: string) {
  return `${count} ${count === 1 ? singular : plural}`;
}

function getSharedReportProofBasisValue(
  proofBasis: Array<{ key: SharedReportProofBasisKey; value: number }>,
  key: SharedReportProofBasisKey,
) {
  return Math.max(0, proofBasis.find((item) => item.key === key)?.value ?? 0);
}

export function getSharedReportProofBasis(
  data: SharedReportTrustData,
): Array<{ key: SharedReportProofBasisKey; value: number }> {
  if (data.leadershipHandoff?.proofBasis?.length) {
    return data.leadershipHandoff.proofBasis.map((item) => ({
      key: item.key,
      value: item.value,
    }));
  }

  const evidenceRatio = parseSharedReportRatio(
    getSharedReportEvidenceCoverageItem(data)?.value ?? "",
  );
  const verifiedRatio = parseSharedReportRatio(
    getSharedReportVerifiedReadsItem(data)?.value ?? "",
  );
  const total = evidenceRatio?.denominator ?? verifiedRatio?.denominator ?? 0;
  const evidenced = evidenceRatio?.numerator ?? verifiedRatio?.numerator ?? 0;
  const included = verifiedRatio
    ? Math.min(verifiedRatio.numerator, Math.max(evidenced, verifiedRatio.numerator))
    : getSharedReportTrustDecision(data) === "Ready for leadership sharing."
      ? evidenced
      : 0;
  const missingProof = total > 0 ? Math.max(0, total - evidenced) : 0;
  const unresolvedEvidence = Math.max(0, evidenced - included);
  const corrections = Math.min(
    getSharedReportCorrectionCount(data),
    unresolvedEvidence,
  );
  const needsReview = Math.max(0, unresolvedEvidence - corrections);

  return [
    { key: "included", value: included },
    { key: "needs-review", value: needsReview },
    { key: "corrections", value: corrections },
    { key: "missing-proof", value: missingProof },
  ];
}

export function getSharedReportTrustDecision(
  data: SharedReportTrustData,
): string {
  if (data.leadershipHandoff?.decision) return data.leadershipHandoff.decision;

  const reportStatus = getSharedReportStatusItem(data);
  const statusValueText = `${reportStatus?.label ?? ""} ${reportStatus?.value ?? ""}`.toLowerCase();
  const statusText = `${statusValueText} ${reportStatus?.detail ?? ""}`.toLowerCase();

  if (/\bcorrection|revision|rejected\b/.test(statusText)) {
    return "Resolve correction requests before leadership sharing.";
  }

  const evidence = getSharedReportEvidenceCoverageItem(data);
  const verified = getSharedReportVerifiedReadsItem(data);
  const evidenceRatio = evidence ? parseSharedReportRatio(evidence.value) : null;
  const verifiedRatio = verified ? parseSharedReportRatio(verified.value) : null;

  if (!evidenceRatio && !verifiedRatio) {
    return noSubmittedProofDecision;
  }

  if (
    evidenceRatio?.denominator === 0 ||
    verifiedRatio?.denominator === 0
  ) {
    return noSubmittedProofDecision;
  }

  if (
    evidenceRatio &&
    evidenceRatio.denominator > 0 &&
    evidenceRatio.numerator < evidenceRatio.denominator
  ) {
    return "Keep in proof room until all required proof is present.";
  }

  if (!verifiedRatio && evidenceRatio && evidenceRatio.denominator > 0) {
    return "Keep in proof room until evidence is reviewed.";
  }

  if (
    verifiedRatio &&
    verifiedRatio.denominator > 0 &&
    verifiedRatio.numerator < verifiedRatio.denominator
  ) {
    return "Keep in proof room until evidence is reviewed.";
  }

  if (isIncompleteReportStatusValue(statusValueText)) {
    return "Keep in proof room until evidence is reviewed.";
  }

  return "Ready for leadership sharing.";
}

export function getSharedReportNextAction(data: SharedReportTrustData): string {
  const trustDecision = getSharedReportTrustDecision(data);
  const proofBasis = getSharedReportProofBasis(data);
  const corrections = getSharedReportProofBasisValue(proofBasis, "corrections");
  const missingProof = getSharedReportProofBasisValue(proofBasis, "missing-proof");
  const needsReview = getSharedReportProofBasisValue(proofBasis, "needs-review");

  if (corrections > 0) {
    return `Resolve ${formatSharedReportCount(
      corrections,
      "correction request",
      "correction requests",
    )} before leadership sharing.`;
  }

  if (missingProof > 0) {
    return `Ask ${missingProof === 1 ? "creator" : "creators"} to upload ${formatSharedReportCount(
      missingProof,
      "missing proof read",
      "missing proof reads",
    )}.`;
  }

  if (needsReview > 0) {
    return `Review ${formatSharedReportCount(
      needsReview,
      "submitted proof read",
      "submitted proof reads",
    )} before sharing.`;
  }

  if (trustDecision === noSubmittedProofDecision) {
    return "Collect and review the first proof read before sharing.";
  }

  if (trustDecision === "Ready for leadership sharing.") {
    return "Share the verified proof room with leadership.";
  }

  return trustDecision;
}

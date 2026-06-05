export const REPORT_EXPORT_CONTRACT_VERSION = "report-export-proof-ops-basis-v9-2026-06-05";

export const STALE_REPORT_EXPORT_SERVICE_ERROR =
  "Report export service is out of date. Deploy the generate-report Edge Function before exporting.";

export function assertReportExportServiceContractVersion(payload: {
  contractVersion?: unknown;
}) {
  if (payload.contractVersion !== REPORT_EXPORT_CONTRACT_VERSION) {
    throw new Error(STALE_REPORT_EXPORT_SERVICE_ERROR);
  }
}

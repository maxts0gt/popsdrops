import {
  assertReportExportServiceContractVersion,
  STALE_REPORT_EXPORT_SERVICE_ERROR,
} from "./report-export-contract";

export function getReportExportServiceConfig() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !serviceRoleKey) {
    throw new Error("Report export service is not configured.");
  }

  return { serviceRoleKey, supabaseUrl };
}

export async function assertReportExportServiceReady() {
  const { serviceRoleKey, supabaseUrl } = getReportExportServiceConfig();
  const response = await fetch(`${supabaseUrl}/functions/v1/generate-report`, {
    method: "GET",
    headers: {
      Authorization: `Bearer ${serviceRoleKey}`,
    },
  });
  const payload = await response.json().catch(() => null) as
    | { contractVersion?: unknown; error?: string }
    | null;

  if (!response.ok || !payload) {
    throw new Error(STALE_REPORT_EXPORT_SERVICE_ERROR);
  }

  assertReportExportServiceContractVersion(payload);
}

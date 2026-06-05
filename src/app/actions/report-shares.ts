"use server";

import { revalidatePath } from "next/cache";
import { headers } from "next/headers";
import { createClient } from "@/lib/supabase/server";
import {
  assertBrandWorkspacePermission,
  type BrandWorkspaceSupabaseClient,
} from "@/lib/brand-workspace";
import { getUser } from "./auth";
import {
  buildReportShareUrl,
  createReportShareToken,
  getReportShareExpiry,
  getReportShareTokenPrefix,
  hashReportShareToken,
} from "@/lib/reporting/report-share-links";

export interface ReportShareLinkSummary {
  id: string;
  tokenPrefix: string;
  label: string;
  expiresAt: string | null;
  revokedAt: string | null;
  lastViewedAt: string | null;
  viewCount: number;
  createdAt: string;
}

async function getShareOrigin(): Promise<string> {
  if (process.env.NEXT_PUBLIC_SITE_URL) {
    return process.env.NEXT_PUBLIC_SITE_URL;
  }

  const requestHeaders = await headers();
  const host = requestHeaders.get("x-forwarded-host") ?? requestHeaders.get("host");
  if (!host) {
    throw new Error("Report share origin could not be resolved.");
  }

  const protocol =
    requestHeaders.get("x-forwarded-proto") ??
    (host.startsWith("localhost") || host.startsWith("127.0.0.1")
      ? "http"
      : "https");

  return `${protocol}://${host}`;
}

function toSummary(row: {
  id: string;
  token_prefix: string;
  label: string;
  expires_at: string | null;
  revoked_at: string | null;
  last_viewed_at: string | null;
  view_count: number;
  created_at: string;
}): ReportShareLinkSummary {
  return {
    id: row.id,
    tokenPrefix: row.token_prefix,
    label: row.label,
    expiresAt: row.expires_at,
    revokedAt: row.revoked_at,
    lastViewedAt: row.last_viewed_at,
    viewCount: row.view_count,
    createdAt: row.created_at,
  };
}

async function assertBrandReportShareAccess(
  supabase: BrandWorkspaceSupabaseClient,
  userId: string,
  campaignId: string,
  permission: "view_campaigns" | "share_reports",
) {
  const workspace = await assertBrandWorkspacePermission(
    supabase,
    userId,
    permission,
  );

  const { data: campaign } = await supabase
    .from("campaigns")
    .select("id")
    .eq("id", campaignId)
    .eq("brand_id", workspace.brandId)
    .single();

  if (!campaign) throw new Error("Campaign not found");

  return workspace;
}

export async function listReportShareLinks(
  campaignId: string,
): Promise<ReportShareLinkSummary[]> {
  const user = await getUser();
  const supabase = await createClient();
  await assertBrandReportShareAccess(
    supabase,
    user.id,
    campaignId,
    "view_campaigns",
  );

  const { data, error } = await supabase
    .from("campaign_report_share_links")
    .select(
      "id, token_prefix, label, expires_at, revoked_at, last_viewed_at, view_count, created_at",
    )
    .eq("campaign_id", campaignId)
    .order("created_at", { ascending: false });

  if (error) throw new Error(error.message);

  return (data ?? []).map(toSummary);
}

export async function createReportShareLink(
  campaignId: string,
): Promise<ReportShareLinkSummary & { url: string }> {
  const user = await getUser();
  const supabase = await createClient();
  await assertBrandReportShareAccess(
    supabase,
    user.id,
    campaignId,
    "share_reports",
  );
  const token = createReportShareToken();
  const tokenHash = await hashReportShareToken(token);
  const expiresAt = getReportShareExpiry(30);

  const { data, error } = await supabase
    .from("campaign_report_share_links")
    .insert({
      campaign_id: campaignId,
      created_by: user.id,
      token_hash: tokenHash,
      token_prefix: getReportShareTokenPrefix(token),
      label: "Client report",
      expires_at: expiresAt,
    })
    .select(
      "id, token_prefix, label, expires_at, revoked_at, last_viewed_at, view_count, created_at",
    )
    .single();

  if (error) throw new Error(error.message);

  revalidatePath(`/b/campaigns/${campaignId}/report`);

  return {
    ...toSummary(data),
    url: buildReportShareUrl({ origin: await getShareOrigin(), token }),
  };
}

export async function revokeReportShareLink({
  campaignId,
  shareLinkId,
}: {
  campaignId: string;
  shareLinkId: string;
}): Promise<{ ok: true }> {
  const user = await getUser();
  const supabase = await createClient();
  await assertBrandReportShareAccess(
    supabase,
    user.id,
    campaignId,
    "share_reports",
  );

  const { data, error } = await supabase
    .from("campaign_report_share_links")
    .update({ revoked_at: new Date().toISOString() })
    .eq("id", shareLinkId)
    .eq("campaign_id", campaignId)
    .is("revoked_at", null)
    .select("id")
    .maybeSingle();

  if (error) throw new Error(error.message);
  if (!data) throw new Error("Share link could not be revoked.");

  revalidatePath(`/b/campaigns/${campaignId}/report`);

  return { ok: true };
}

import { existsSync, readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const campaignsSource = readFileSync(
  new URL("./campaigns.ts", import.meta.url),
  "utf8",
);
const newCampaignSource = readFileSync(
  new URL("../(site)/(app)/b/campaigns/new/page.tsx", import.meta.url),
  "utf8",
);
const translateBriefEdgeFunctionUrl = new URL(
  "../../../supabase/functions/translate-brief/index.ts",
  import.meta.url,
);
const translateBriefEdgeFunctionSource = existsSync(translateBriefEdgeFunctionUrl)
  ? readFileSync(translateBriefEdgeFunctionUrl, "utf8")
  : "";

describe("campaign reporting requirements creation", () => {
  it("builds defaults from deliverables when explicit requirements are absent", () => {
    expect(campaignsSource).toContain("buildDefaultCampaignReportingRequirements");
    expect(campaignsSource).toContain("reporting_requirements");
    expect(campaignsSource).toContain(".from(\"campaign_reporting_requirements\")");
  });

  it("creates a campaign reporting plan during campaign creation", () => {
    expect(campaignsSource).toContain(".from(\"campaign_reporting_plans\")");
    expect(campaignsSource).toContain("reporting_cadence");
    expect(campaignsSource).toContain("getCampaignReportingPlanWindow");
    expect(campaignsSource).toContain("starts_at: reportingPlanWindow.startsAt");
    expect(campaignsSource).toContain("ends_at: reportingPlanWindow.endsAt");
  });

  it("persists the chosen campaign report goal as a reporting-plan snapshot", () => {
    expect(campaignsSource).toContain("loadReportCompositionTemplateForCampaign");
    expect(campaignsSource).toContain("normalizeReportCompositionSelection");
    expect(campaignsSource).toContain("report_template_id");
    expect(campaignsSource).toContain("report_preset_id");
    expect(campaignsSource).toContain("report_chart_mode_id");
    expect(campaignsSource).toContain("report_block_ids");
    expect(campaignsSource).toContain(".from(\"report_composition_templates\")");
    expect(campaignsSource).toContain(".eq(\"brand_id\", brandId)");
  });

  it("passes reporting requirements from the campaign builder payload", () => {
    expect(newCampaignSource).toContain("reporting_requirements");
    expect(newCampaignSource).toContain("reporting_cadence");
    expect(newCampaignSource).toContain("report_template_id");
    expect(newCampaignSource).toContain("report_preset_id");
  });

  it("lets brand managers update required proof metrics for an existing campaign requirement", () => {
    expect(campaignsSource).toContain("campaignReportingRequirementUpdateSchema");
    expect(campaignsSource).toContain("updateCampaignReportingRequirement");
    expect(campaignsSource).toContain("validateRequirementMetricKeys");
    expect(campaignsSource).toContain(".from(\"campaign_reporting_requirements\")");
    expect(campaignsSource).toContain("required_metric_keys: parsed.data.requiredMetricKeys");
    expect(campaignsSource).toContain("evidence_types: parsed.data.evidenceTypes");
    expect(campaignsSource).toContain("Only draft or recruiting campaigns can change proof fields.");
    expect(campaignsSource).toContain("revalidatePath(`/i/discover/${parsed.data.campaignId}`)");
  });
});

describe("campaign brief translation backend boundary", () => {
  it("delegates dynamic brief translation to a Supabase Edge Function", () => {
    expect(campaignsSource).toContain('.functions.invoke("translate-brief"');
    expect(campaignsSource).not.toContain("process.env.GEMINI_API_KEY");
    expect(campaignsSource).not.toContain("generativelanguage.googleapis.com");
  });

  it("keeps Gemini translation and the campaign update inside Supabase", () => {
    expect(translateBriefEdgeFunctionSource).toContain('Deno.env.get("GEMINI_API_KEY")');
    expect(translateBriefEdgeFunctionSource).toContain('.from("campaigns")');
    expect(translateBriefEdgeFunctionSource).toContain("brief_translated");
    expect(translateBriefEdgeFunctionSource).toContain(
      "Translate the following campaign brief fields",
    );
  });

  it("does not overwrite brand-reviewed creator-language translations", () => {
    expect(translateBriefEdgeFunctionSource).toContain("existingTranslations");
    expect(translateBriefEdgeFunctionSource).toContain("missingTargetLocales");
    expect(translateBriefEdgeFunctionSource).toContain("mergedTranslations");
    expect(translateBriefEdgeFunctionSource).toContain("...existingTranslations");
  });

  it("supports pre-publish creator-language draft generation without a campaign write", () => {
    expect(translateBriefEdgeFunctionSource).toContain("previewRequestSchema");
    expect(translateBriefEdgeFunctionSource).toContain("targetLocale");
    expect(translateBriefEdgeFunctionSource).toContain("briefFields");
    expect(translateBriefEdgeFunctionSource).toContain("handlePreviewTranslation");
    expect(translateBriefEdgeFunctionSource).toContain("getBrandWorkspaceForUser(client, user.id)");
    expect(translateBriefEdgeFunctionSource).toContain("Only brands can generate campaign language drafts");
    expect(translateBriefEdgeFunctionSource).toContain('status: "preview_translated"');
    expect(translateBriefEdgeFunctionSource).toContain("translation: translatedFields");

    const previewStart = translateBriefEdgeFunctionSource.indexOf(
      "async function handlePreviewTranslation",
    );
    const previewEnd = translateBriefEdgeFunctionSource.indexOf(
      "Deno.serve",
      previewStart,
    );
    const previewSource = translateBriefEdgeFunctionSource.slice(previewStart, previewEnd);

    expect(previewSource).toContain("translateFields(apiKey, targetLocale, briefFields)");
    expect(previewSource).not.toContain(".update({ brief_translated");
    expect(previewSource).not.toContain(".from(\"campaigns\")");
  });
});

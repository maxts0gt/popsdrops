// DEV ONLY — creates a campaign with a submitted content piece for the dev brand.
// This lets us test the brand content review flow.

import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export async function GET() {
  if (process.env.NODE_ENV === "production") {
    return NextResponse.json({ error: "Not available" }, { status: 404 });
  }

  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );

  // Find dev brand
  const { data: brandProfile } = await supabase
    .from("profiles")
    .select("id")
    .eq("email", "dev-brand@popsdrops.test")
    .single();

  if (!brandProfile) {
    return NextResponse.json({ error: "Dev brand not found" }, { status: 404 });
  }

  // Find dev creator
  const { data: creatorProfile } = await supabase
    .from("profiles")
    .select("id, full_name")
    .eq("email", "dev-creator@popsdrops.test")
    .single();

  if (!creatorProfile) {
    return NextResponse.json({ error: "Dev creator not found" }, { status: 404 });
  }

  // Check if campaign already exists
  const { data: existing } = await supabase
    .from("campaigns")
    .select("id")
    .eq("brand_id", brandProfile.id)
    .eq("title", "Summer Glow Collection — UGC Campaign")
    .limit(1)
    .single();

  let campaignId: string;

  if (existing) {
    campaignId = existing.id;
  } else {
    // Create campaign
    const { data: camp, error: campError } = await supabase
      .from("campaigns")
      .insert({
        brand_id: brandProfile.id,
        title: "Summer Glow Collection — UGC Campaign",
        brief_description:
          "Create authentic unboxing and review content featuring our new Summer Glow skincare line. Show your morning routine incorporating the products. Keep it natural and relatable.",
        brief_requirements:
          "Must mention product name. Must show packaging. Include discount code SUMMERGLOW20 in caption.",
        brief_dos:
          "Show real application\nMention key ingredients (Vitamin C, Hyaluronic Acid)\nUse natural lighting",
        brief_donts:
          "No competitor products visible\nNo heavy filters that misrepresent product color\nNo medical claims",
        platforms: ["tiktok", "instagram"],
        markets: ["us", "ae", "sa"],
        niches: ["beauty", "lifestyle"],
        budget_min: 200,
        budget_max: 500,
        max_creators: 5,
        status: "in_progress",
        application_deadline: "2026-03-15",
        content_due_date: "2026-04-15",
        posting_window_start: "2026-04-20",
        posting_window_end: "2026-05-20",
        max_revisions: 3,
      })
      .select("id")
      .single();

    if (campError) {
      return NextResponse.json({ error: campError.message }, { status: 500 });
    }
    campaignId = camp.id;
  }

  // Ensure campaign member exists
  const { data: existingMember } = await supabase
    .from("campaign_members")
    .select("id")
    .eq("campaign_id", campaignId)
    .eq("creator_id", creatorProfile.id)
    .limit(1)
    .single();

  let memberId: string;

  if (existingMember) {
    memberId = existingMember.id;
  } else {
    const { data: member, error: memberError } = await supabase
      .from("campaign_members")
      .insert({
        campaign_id: campaignId,
        creator_id: creatorProfile.id,
        accepted_rate: 350,
      })
      .select("id")
      .single();

    if (memberError) {
      return NextResponse.json({ error: memberError.message }, { status: 500 });
    }
    memberId = member.id;
  }

  // Check if submissions already exist
  const { data: existingSubs } = await supabase
    .from("content_submissions")
    .select("id")
    .eq("campaign_member_id", memberId)
    .limit(1);

  if (existingSubs && existingSubs.length > 0) {
    return NextResponse.json({
      success: true,
      message: "Already seeded",
      campaign_id: campaignId,
      member_id: memberId,
    });
  }

  // Create two content submissions
  const { error: sub1Error } = await supabase
    .from("content_submissions")
    .insert({
      campaign_member_id: memberId,
      content_url: "https://www.tiktok.com/@summerglow/video/7345678901234567890",
      caption:
        "My new morning routine is officially upgraded ☀️ These Summer Glow products are unreal — the Vitamin C serum has my skin GLOWING. Use code SUMMERGLOW20 for 20% off! #SummerGlow #Skincare #MorningRoutine",
      platform: "tiktok",
      status: "submitted",
      version: 1,
      submitted_at: new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString(), // 2 hours ago
    });

  if (sub1Error) {
    return NextResponse.json({ error: sub1Error.message }, { status: 500 });
  }

  const { error: sub2Error } = await supabase
    .from("content_submissions")
    .insert({
      campaign_member_id: memberId,
      content_url: "https://www.instagram.com/reel/ABC123xyz/",
      caption:
        "POV: You find a skincare routine that actually works ✨ Summer Glow Collection review — honest thoughts in the caption. Link in bio for 20% off with SUMMERGLOW20",
      platform: "instagram",
      status: "submitted",
      version: 1,
      submitted_at: new Date(Date.now() - 45 * 60 * 1000).toISOString(), // 45 min ago
    });

  if (sub2Error) {
    return NextResponse.json({ error: sub2Error.message }, { status: 500 });
  }

  return NextResponse.json({
    success: true,
    campaign_id: campaignId,
    member_id: memberId,
    message: "Created campaign with 2 content submissions ready for review",
  });
}

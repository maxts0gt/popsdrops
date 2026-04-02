// DEV ONLY — creates a campaign membership for the dev creator for testing.
// Finds their pending application, accepts it, and creates a campaign_member.

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

  // Find dev creator's user id
  const { data: creatorProfile } = await supabase
    .from("profiles")
    .select("id")
    .eq("email", "dev-creator@popsdrops.test")
    .single();

  if (!creatorProfile) {
    return NextResponse.json({ error: "Dev creator not found" }, { status: 404 });
  }

  // Find their pending application
  const { data: app } = await supabase
    .from("campaign_applications")
    .select("id, campaign_id, proposed_rate")
    .eq("creator_id", creatorProfile.id)
    .eq("status", "pending")
    .order("created_at", { ascending: false })
    .limit(1)
    .single();

  if (!app) {
    return NextResponse.json({ error: "No pending application found" }, { status: 404 });
  }

  // Accept the application
  await supabase
    .from("campaign_applications")
    .update({ status: "accepted" })
    .eq("id", app.id);

  // Create campaign member
  const { data: member, error: memberError } = await supabase
    .from("campaign_members")
    .insert({
      campaign_id: app.campaign_id,
      creator_id: creatorProfile.id,
      accepted_rate: app.proposed_rate,
    })
    .select("id")
    .single();

  if (memberError) {
    return NextResponse.json({ error: memberError.message }, { status: 500 });
  }

  // Also update campaign status to in_progress if it's still recruiting
  await supabase
    .from("campaigns")
    .update({ status: "in_progress" })
    .eq("id", app.campaign_id)
    .eq("status", "recruiting");

  return NextResponse.json({
    success: true,
    campaign_id: app.campaign_id,
    member_id: member.id,
    accepted_rate: app.proposed_rate,
  });
}

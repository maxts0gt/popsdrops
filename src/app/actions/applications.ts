"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import {
  createPrivilegedNotification,
  upsertPrivilegedCampaignMember,
} from "@/lib/supabase/privileged";
import { getUser } from "./auth";
import { submitApplicationSchema, counterOfferSchema } from "@/lib/validations";
import { sendNotificationEmail } from "@/lib/email/notify";

export async function submitApplication(input: {
  campaign_id: string;
  proposed_rate: number;
  pitch: string;
}) {
  const parsed = submitApplicationSchema.safeParse(input);
  if (!parsed.success) throw new Error(parsed.error.issues[0].message);

  const user = await getUser();
  const supabase = await createClient();

  const { data: campaign } = await supabase
    .from("campaigns")
    .select("id, brand_id, title, status, application_deadline")
    .eq("id", input.campaign_id)
    .single();

  if (!campaign || campaign.status !== "recruiting") {
    throw new Error("This campaign is not open for applications.");
  }

  if (
    campaign.application_deadline &&
    new Date(campaign.application_deadline).getTime() < Date.now()
  ) {
    throw new Error("The application deadline has already passed.");
  }

  const { data, error } = await supabase
    .from("campaign_applications")
    .insert({
      campaign_id: input.campaign_id,
      creator_id: user.id,
      proposed_rate: input.proposed_rate,
      pitch: input.pitch,
      status: "pending",
    })
    .select("id")
    .single();

  if (error) throw new Error(error.message);

  await createPrivilegedNotification({
    user_id: campaign.brand_id,
    type: "application_received",
    title: "New Application",
    body: `A creator applied to "${campaign.title}"`,
    data: { campaign_id: input.campaign_id, application_id: data.id },
  });

  const [{ data: brandProfile }, { data: creatorProfile }] = await Promise.all([
    supabase.from("profiles").select("email, full_name").eq("id", campaign.brand_id).single(),
    supabase.from("profiles").select("full_name").eq("id", user.id).single(),
  ]);

  if (brandProfile?.email) {
    sendNotificationEmail({
      type: "application_received",
      recipientEmail: brandProfile.email,
      recipientName: brandProfile.full_name ?? "Brand",
      data: {
        creatorName: creatorProfile?.full_name ?? "A creator",
        campaignTitle: campaign.title,
        campaignId: input.campaign_id,
        proposedRate: input.proposed_rate,
      },
    });
  }

  revalidatePath(`/i/discover/${input.campaign_id}`);
  revalidatePath("/i/campaigns");
  return { id: data.id };
}

export async function acceptApplication(
  applicationId: string,
  acceptedRate: number
) {
  const user = await getUser();
  const supabase = await createClient();

  // Get application details
  const { data: app, error: appError } = await supabase
    .from("campaign_applications")
    .select("campaign_id, creator_id, status, campaigns(brand_id, title)")
    .eq("id", applicationId)
    .single();

  if (appError || !app) throw new Error("Application not found");

  // Verify current user is the campaign brand
  const campaign = app.campaigns as unknown as { brand_id: string; title: string };
  if (campaign.brand_id !== user.id) throw new Error("Not authorized");
  if (!["pending", "counter_offer"].includes(app.status)) {
    throw new Error("This application can no longer be accepted.");
  }

  // Update application status
  const { error: updateError } = await supabase
    .from("campaign_applications")
    .update({ status: "accepted" })
    .eq("id", applicationId)
    .eq("status", app.status)
    .select("id")
    .single();

  if (updateError) throw new Error(updateError.message);

  try {
    await upsertPrivilegedCampaignMember({
      campaign_id: app.campaign_id,
      creator_id: app.creator_id,
      accepted_rate: acceptedRate,
    });
  } catch (error) {
    await supabase
      .from("campaign_applications")
      .update({ status: app.status })
      .eq("id", applicationId);
    throw error;
  }

  // Notify creator
  await createPrivilegedNotification({
    user_id: app.creator_id,
    type: "application_accepted",
    title: "Application Accepted!",
    body: `You've been accepted to "${campaign.title}"`,
    data: { campaign_id: app.campaign_id },
  });

  // Email creator
  const { data: creatorProfile } = await supabase
    .from("profiles")
    .select("email, full_name")
    .eq("id", app.creator_id)
    .single();

  if (creatorProfile?.email) {
    sendNotificationEmail({
      type: "application_accepted",
      recipientEmail: creatorProfile.email,
      recipientName: creatorProfile.full_name ?? "Creator",
      data: {
        campaignTitle: campaign.title,
        campaignId: app.campaign_id,
        acceptedRate: acceptedRate,
      },
    });
  }

  revalidatePath(`/b/campaigns/${app.campaign_id}`);
}

export async function rejectApplication(applicationId: string) {
  const user = await getUser();
  const supabase = await createClient();

  const { data: app } = await supabase
    .from("campaign_applications")
    .select("campaign_id, creator_id, status, campaigns(brand_id, title)")
    .eq("id", applicationId)
    .single();

  if (!app) throw new Error("Application not found");

  const campaign = app.campaigns as unknown as { brand_id: string; title: string };
  if (campaign.brand_id !== user.id) throw new Error("Not authorized");
  if (!["pending", "counter_offer"].includes(app.status)) {
    throw new Error("This application can no longer be rejected.");
  }

  const { error } = await supabase
    .from("campaign_applications")
    .update({ status: "rejected" })
    .eq("id", applicationId)
    .eq("status", app.status)
    .select("id")
    .single();

  if (error) throw new Error(error.message);

  await createPrivilegedNotification({
    user_id: app.creator_id,
    type: "application_rejected",
    title: "Application Update",
    body: `Update on your application to "${campaign.title}"`,
    data: { campaign_id: app.campaign_id },
  });

  revalidatePath(`/b/campaigns/${app.campaign_id}`);
}

export async function counterOffer(input: {
  application_id: string;
  counter_rate: number;
  counter_message?: string;
}) {
  const parsed = counterOfferSchema.safeParse(input);
  if (!parsed.success) throw new Error(parsed.error.issues[0].message);

  const user = await getUser();
  const supabase = await createClient();

  const { data: app } = await supabase
    .from("campaign_applications")
    .select("campaign_id, creator_id, status, campaigns(brand_id, title)")
    .eq("id", input.application_id)
    .single();

  if (!app) throw new Error("Application not found");

  const campaign = app.campaigns as unknown as { brand_id: string; title: string };
  if (campaign.brand_id !== user.id) throw new Error("Not authorized");
  if (app.status !== "pending") {
    throw new Error("A counter-offer can only be sent for pending applications.");
  }

  const { error } = await supabase
    .from("campaign_applications")
    .update({
      status: "counter_offer",
      counter_rate: input.counter_rate,
      counter_message: input.counter_message ?? null,
    })
    .eq("id", input.application_id)
    .eq("status", "pending")
    .select("id")
    .single();

  if (error) throw new Error(error.message);

  await createPrivilegedNotification({
    user_id: app.creator_id,
    type: "counter_offer",
    title: "Counter Offer Received",
    body: `A brand proposed $${input.counter_rate} for "${campaign.title}"`,
    data: {
      campaign_id: app.campaign_id,
      application_id: input.application_id,
      counter_rate: input.counter_rate,
    },
  });

  // Email creator
  const { data: creatorProfile } = await supabase
    .from("profiles")
    .select("email, full_name")
    .eq("id", app.creator_id)
    .single();

  if (creatorProfile?.email) {
    sendNotificationEmail({
      type: "counter_offer",
      recipientEmail: creatorProfile.email,
      recipientName: creatorProfile.full_name ?? "Creator",
      data: {
        campaignTitle: campaign.title,
        campaignId: app.campaign_id,
        counterRate: input.counter_rate,
        message: input.counter_message,
      },
    });
  }

  revalidatePath(`/b/campaigns/${app.campaign_id}`);
}

export async function respondToCounterOffer(
  applicationId: string,
  accept: boolean
) {
  const user = await getUser();
  const supabase = await createClient();

  const { data: app } = await supabase
    .from("campaign_applications")
    .select("campaign_id, creator_id, counter_rate, status, campaigns(brand_id, title)")
    .eq("id", applicationId)
    .single();

  if (!app || app.creator_id !== user.id) throw new Error("Not authorized");
  if (app.status !== "counter_offer") {
    throw new Error("There is no counter-offer to respond to.");
  }

  if (accept) {
    if (app.counter_rate == null) {
      throw new Error("This counter-offer is missing a proposed rate.");
    }

    // Accept counter offer -> accept application + create member
    const { error: updateError } = await supabase
      .from("campaign_applications")
      .update({ status: "accepted" })
      .eq("id", applicationId)
      .eq("status", "counter_offer")
      .select("id")
      .single();

    if (updateError) throw new Error(updateError.message);

    try {
      await upsertPrivilegedCampaignMember({
        campaign_id: app.campaign_id,
        creator_id: user.id,
        accepted_rate: app.counter_rate,
      });
    } catch (error) {
      await supabase
        .from("campaign_applications")
        .update({ status: "counter_offer" })
        .eq("id", applicationId);
      throw error;
    }

    const campaign = app.campaigns as unknown as { brand_id: string; title: string };
    await createPrivilegedNotification({
      user_id: campaign.brand_id,
      type: "application_accepted",
      title: "Counter Offer Accepted",
      body: `Creator accepted your offer for "${campaign.title}"`,
      data: { campaign_id: app.campaign_id },
    });
  } else {
    // Decline -> reject application
    const { error } = await supabase
      .from("campaign_applications")
      .update({ status: "rejected" })
      .eq("id", applicationId)
      .eq("status", "counter_offer")
      .select("id")
      .single();

    if (error) throw new Error(error.message);
  }

  revalidatePath(`/i/discover/${app.campaign_id}`);
  revalidatePath("/i/campaigns");
}

export async function withdrawApplication(applicationId: string) {
  const user = await getUser();
  const supabase = await createClient();

  const { error } = await supabase
    .from("campaign_applications")
    .update({ status: "withdrawn" })
    .eq("id", applicationId)
    .eq("creator_id", user.id)
    .in("status", ["pending", "counter_offer"])
    .select("id")
    .single();

  if (error) throw new Error(error.message);

  revalidatePath("/i/campaigns");
}

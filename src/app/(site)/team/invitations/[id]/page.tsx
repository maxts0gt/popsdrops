import type { Metadata } from "next";
import Link from "next/link";
import {
  BadgeCheck,
  Building2,
  Clock3,
  Mail,
  ShieldCheck,
  UserRound,
} from "lucide-react";

import { acceptBrandTeamInvitation } from "@/app/actions/brand-team";
import { Button } from "@/components/ui/button";
import { getBrandTeamInvitationPreview } from "@/lib/brand-team-invitations";
import { getSourceStrings } from "@/lib/i18n/strings";
import { createClient } from "@/lib/supabase/server";

export const metadata: Metadata = {
  title: "Team Invitation",
  description: "Review and accept a PopsDrops brand team invitation.",
  robots: {
    index: false,
    follow: false,
  },
};

type TeamInvitationPageProps = {
  params: Promise<{ id: string }>;
};

function t(key: string, vars?: Record<string, string>) {
  const source = getSourceStrings("team.invitation");
  let text = source[key] || key;

  for (const [name, value] of Object.entries(vars ?? {})) {
    text = text.replace(`{${name}}`, value);
  }

  return text;
}

function formatInviteDate(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.valueOf())) return value;

  return new Intl.DateTimeFormat("en-US", {
    day: "numeric",
    month: "short",
    year: "numeric",
  }).format(date);
}

function StateMessage({
  body,
  title,
}: {
  body: string;
  title: string;
}) {
  return (
    <div className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-3">
      <p className="text-sm font-semibold text-slate-950">{title}</p>
      <p className="mt-1 text-sm leading-6 text-slate-600">{body}</p>
    </div>
  );
}

export default async function TeamInvitationPage({
  params,
}: TeamInvitationPageProps) {
  const { id } = await params;
  const preview = await getBrandTeamInvitationPreview(id);
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  const currentEmail = user?.email?.toLowerCase() ?? null;
  const invitedEmail =
    "email" in preview ? preview.email.toLowerCase() : null;
  const isSignedIn = Boolean(user);
  const isWrongSignedInEmail =
    Boolean(currentEmail && invitedEmail) && currentEmail !== invitedEmail;
  const returnToPath = `/team/invitations/${id}`;

  if (preview.status === "missing") {
    return (
      <main className="flex min-h-svh items-center justify-center bg-slate-50 px-4 py-10">
        <section
          className="w-full max-w-xl rounded-2xl border border-slate-200 bg-white p-6 shadow-sm ring-1 ring-slate-900/[0.03]"
          data-testid="brand-team-invitation-preview"
        >
          <ShieldCheck className="size-5 text-slate-500" />
          <h1 className="mt-5 text-2xl font-semibold text-slate-950">
            {t("teamInvite.missingTitle")}
          </h1>
          <p className="mt-2 text-sm leading-6 text-slate-600">
            {t("teamInvite.missingBody")}
          </p>
          <Link
            className="mt-6 inline-flex h-9 items-center justify-center rounded-lg border border-slate-200 px-3 text-sm font-medium text-slate-700 transition-colors hover:bg-slate-50"
            href="/login"
          >
            {t("teamInvite.requestNewInvite")}
          </Link>
        </section>
      </main>
    );
  }

  const roleLabel = t(preview.roleLabel);
  const accessSummary = t(preview.accessSummary);
  const isPending = preview.status === "pending";
  const canAccept = isPending && isSignedIn && !isWrongSignedInEmail;

  const state =
    preview.status === "expired"
      ? {
          body: t("teamInvite.expiredBody"),
          title: t("teamInvite.expiredTitle"),
        }
      : preview.status === "revoked"
        ? {
            body: t("teamInvite.revokedBody"),
            title: t("teamInvite.revokedTitle"),
          }
        : preview.status === "accepted"
          ? {
              body: t("teamInvite.acceptedBody"),
              title: t("teamInvite.acceptedTitle"),
            }
          : isWrongSignedInEmail
            ? {
                body: t("teamInvite.wrongEmailBody", {
                  currentEmail: currentEmail ?? "",
                  invitedEmail: preview.email,
                }),
                title: t("teamInvite.wrongEmailTitle"),
              }
            : {
                body: t("teamInvite.pendingBody"),
                title: t("teamInvite.pendingTitle"),
              };

  return (
    <main className="flex min-h-svh items-center justify-center bg-slate-50 px-4 py-10">
      <section
        className="w-full max-w-2xl rounded-2xl border border-slate-200 bg-white p-5 shadow-sm ring-1 ring-slate-900/[0.03] sm:p-6"
        data-testid="brand-team-invitation-preview"
      >
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="text-xs font-semibold uppercase text-slate-500">
              {t("teamInvite.eyebrow")}
            </p>
            <h1 className="mt-2 text-2xl font-semibold text-slate-950">
              {t("teamInvite.title", { brandName: preview.brandName })}
            </h1>
            <p className="mt-2 text-sm text-slate-600">
              {t("teamInvite.invitedBy", {
                invitedByName: preview.invitedByName,
              })}
            </p>
          </div>
          <div className="flex size-10 shrink-0 items-center justify-center rounded-xl border border-slate-200 bg-slate-50">
            <ShieldCheck className="size-5 text-slate-700" />
          </div>
        </div>

        <div className="mt-6 grid gap-3 sm:grid-cols-2">
          <div className="rounded-xl border border-slate-200 p-4">
            <div className="flex items-center gap-2 text-sm font-medium text-slate-500">
              <Building2 className="size-4" />
              {t("teamInvite.role")}
            </div>
            <p className="mt-3 text-lg font-semibold text-slate-950">
              {roleLabel}
            </p>
            <p className="mt-1 text-sm leading-6 text-slate-600">
              {accessSummary}
            </p>
          </div>
          <div className="rounded-xl border border-slate-200 p-4">
            <div className="flex items-center gap-2 text-sm font-medium text-slate-500">
              <Mail className="size-4" />
              {t("teamInvite.email")}
            </div>
            <p className="mt-3 break-all text-lg font-semibold text-slate-950">
              {preview.email}
            </p>
            {currentEmail ? (
              <p className="mt-1 text-sm leading-6 text-slate-600">
                {t("teamInvite.signedInAs", { email: currentEmail })}
              </p>
            ) : null}
          </div>
        </div>

        <div className="mt-3 grid gap-3 sm:grid-cols-2">
          <div className="rounded-xl border border-slate-200 p-4">
            <div className="flex items-center gap-2 text-sm font-medium text-slate-500">
              <Clock3 className="size-4" />
              {t("teamInvite.expires")}
            </div>
            <p className="mt-3 text-lg font-semibold text-slate-950">
              {formatInviteDate(preview.expiresAt)}
            </p>
          </div>
          <div className="rounded-xl border border-slate-200 p-4">
            <div className="flex items-center gap-2 text-sm font-medium text-slate-500">
              <UserRound className="size-4" />
              {t("teamInvite.access")}
            </div>
            <p className="mt-3 text-lg font-semibold text-slate-950">
              {preview.brandName}
            </p>
          </div>
        </div>

        <div className="mt-5">
          <StateMessage body={state.body} title={state.title} />
        </div>

        <div className="mt-6 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
          {preview.status === "accepted" ? (
            <Link
              className="inline-flex h-9 items-center justify-center rounded-lg bg-slate-950 px-3 text-sm font-medium text-white transition-colors hover:bg-slate-800"
              href="/b/home"
            >
              <BadgeCheck className="me-1.5 size-4" />
              {t("teamInvite.openWorkspace")}
            </Link>
          ) : preview.status === "expired" || preview.status === "revoked" ? (
            <Link
              className="inline-flex h-9 items-center justify-center rounded-lg border border-slate-200 px-3 text-sm font-medium text-slate-700 transition-colors hover:bg-slate-50"
              href="mailto:notifications@popsdrops.com"
            >
              {t("teamInvite.requestNewInvite")}
            </Link>
          ) : !isSignedIn || isWrongSignedInEmail ? (
            <Link
              className="inline-flex h-9 items-center justify-center rounded-lg bg-slate-950 px-3 text-sm font-medium text-white transition-colors hover:bg-slate-800"
              href={`/login?returnTo=${encodeURIComponent(returnToPath)}`}
            >
              {t("teamInvite.signInCta")}
            </Link>
          ) : null}

          {canAccept ? (
            <form action={acceptBrandTeamInvitation.bind(null, preview.id)}>
              <Button type="submit">
                <BadgeCheck className="me-1.5 size-4" />
                {t("teamInvite.acceptCta")}
              </Button>
            </form>
          ) : null}
        </div>

        {!isSignedIn && isPending ? (
          <p className="mt-3 text-end text-xs text-slate-500">
            {t("teamInvite.signInHint")}
          </p>
        ) : null}
      </section>
    </main>
  );
}

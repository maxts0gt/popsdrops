"use client";

import { useState } from "react";
import {
  ArrowRight,
  Building2,
  CheckCircle2,
  KeyRound,
  Loader2,
  ShieldCheck,
  Users,
} from "lucide-react";
import {
  type DevBrandTeamRole,
  type DevLoginRole,
  getDevBrandTeamEmail,
  getDevUserEmail,
} from "@/lib/dev-users";

/**
 * DEV ONLY - one-click login as any role.
 * Uses the admin-powered /auth/dev-login route to generate a real session
 * without requiring password auth to be enabled in Supabase.
 */

type DevLoginCard = {
  role: DevLoginRole;
  teamRole?: DevBrandTeamRole;
  label: string;
  description: string;
  icon: typeof Users;
  destination: string;
};

const DEV_USERS: DevLoginCard[] = [
  {
    role: "creator",
    label: "Creator",
    description: "Creator app: opportunities, profile, earnings",
    icon: Users,
    destination: "/i/home",
  },
  {
    role: "brand",
    teamRole: "owner",
    label: "Brand Owner",
    description: "Everything: billing, team, profile, campaigns, reports",
    icon: Building2,
    destination: "/b/settings",
  },
  {
    role: "brand",
    teamRole: "admin",
    label: "Brand Admin",
    description: "Team, profile, campaigns, reviews, and reports",
    icon: Building2,
    destination: "/b/home",
  },
  {
    role: "brand",
    teamRole: "manager",
    label: "Brand Manager",
    description: "Campaign operations, creator review, and reporting",
    icon: Building2,
    destination: "/b/campaigns",
  },
  {
    role: "brand",
    teamRole: "viewer",
    label: "Brand Viewer",
    description: "Read-only brand workspace smoke path",
    icon: Building2,
    destination: "/b/campaigns",
  },
  {
    role: "admin",
    label: "Platform Admin",
    description: "Admin center: users, approvals, platform state",
    icon: ShieldCheck,
    destination: "/admin",
  },
];

export default function DevLoginPage() {
  const [loading, setLoading] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  function getCardKey(user: DevLoginCard) {
    return user.teamRole ? `${user.role}:${user.teamRole}` : user.role;
  }

  function getCardEmail(user: DevLoginCard) {
    return user.teamRole ? getDevBrandTeamEmail(user.teamRole) : getDevUserEmail(user.role);
  }

  async function handleLogin(user: DevLoginCard) {
    setLoading(getCardKey(user));
    setError(null);
    if (user.role === "brand" && user.teamRole) {
      window.location.assign(`/auth/dev-login?role=brand&teamRole=${user.teamRole}`);
      return;
    }
    window.location.assign(`/auth/dev-login?role=${user.role}`);
  }

  return (
    <div className="min-h-screen bg-white text-slate-950">
      <main className="mx-auto grid min-h-screen w-full max-w-5xl content-center gap-10 px-6 py-10 lg:grid-cols-[0.9fr_1.1fr]">
        <section className="space-y-7">
          <div className="inline-flex items-center gap-2 rounded-full border border-slate-200 px-3 py-1 text-xs font-medium text-slate-600">
            <KeyRound className="size-3.5" />
            Local smoke access
          </div>

          <div className="space-y-3">
            <p className="text-sm font-semibold text-slate-500">PopsDrops</p>
            <h1 className="max-w-sm text-3xl font-semibold leading-tight text-slate-950">
              Choose a verified test role.
            </h1>
            <p className="max-w-md text-sm leading-6 text-slate-600">
              Each sign-in creates a real Supabase session with the matching
              profile, then routes directly into that workspace.
            </p>
          </div>

          <div className="grid gap-3 text-sm text-slate-600">
            {["Remote Supabase", "Approved profile", "Role redirect"].map((item) => (
              <div key={item} className="flex items-center gap-3">
                <CheckCircle2 className="size-4 text-slate-500" />
                <span>{item}</span>
              </div>
            ))}
          </div>
        </section>

        <section className="space-y-3" aria-label="Dev login roles">
          {DEV_USERS.map((user) => {
            const Icon = user.icon;
            const cardKey = getCardKey(user);
            const isLoading = loading === cardKey;

            return (
              <button
                key={cardKey}
                onClick={() => handleLogin(user)}
                disabled={loading !== null}
                className="group flex w-full items-center gap-4 rounded-xl border border-slate-200 bg-white p-4 text-start shadow-sm ring-1 ring-slate-900/[0.03] transition-all hover:-translate-y-0.5 hover:border-slate-300 hover:shadow-md disabled:pointer-events-none disabled:opacity-60"
              >
                <div className="flex size-11 shrink-0 items-center justify-center rounded-lg bg-slate-50 text-slate-700 ring-1 ring-slate-900/[0.06]">
                  {isLoading ? (
                    <Loader2 className="size-5 animate-spin" />
                  ) : (
                    <Icon className="size-5" />
                  )}
                </div>

                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
                    <p className="font-semibold text-slate-950">{user.label}</p>
                    <span className="text-xs text-slate-400">{user.destination}</span>
                  </div>
                  <p className="mt-1 text-sm text-slate-600">{user.description}</p>
                  <p className="mt-2 inline-flex rounded-md bg-slate-50 px-2 py-1 font-mono text-[11px] text-slate-500 ring-1 ring-slate-900/[0.04]">
                    {getCardEmail(user)}
                  </p>
                </div>

                <ArrowRight className="size-4 shrink-0 text-slate-300 transition-transform group-hover:translate-x-0.5 group-hover:text-slate-500" />
              </button>
            );
          })}

          {error && (
            <div className="rounded-lg bg-red-50 p-3 text-sm text-red-700">{error}</div>
          )}

          <p className="px-1 text-xs leading-5 text-slate-500">
            Admin API session minting is enabled only outside production. No
            password auth is used.
          </p>
        </section>
      </main>
    </div>
  );
}

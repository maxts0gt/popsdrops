"use client";

import { useState } from "react";
import { Shield, Palette, Users, Loader2 } from "lucide-react";

/**
 * DEV ONLY — one-click login as any role.
 * Uses the admin-powered /auth/dev-login route to generate a real session
 * without requiring password auth to be enabled in Supabase.
 */

const DEV_USERS = [
  {
    role: "creator",
    label: "Creator",
    description: "Creator app — discover campaigns, manage profile, track earnings",
    icon: Users,
    color: "bg-violet-50 text-violet-700 ring-violet-200",
  },
  {
    role: "brand",
    label: "Brand Manager",
    description: "Brand dashboard — create campaigns, discover creators, review content",
    icon: Palette,
    color: "bg-blue-50 text-blue-700 ring-blue-200",
  },
  {
    role: "admin",
    label: "Admin",
    description: "Admin center — manage users, review waitlist, platform metrics",
    icon: Shield,
    color: "bg-amber-50 text-amber-700 ring-amber-200",
  },
];

export default function DevLoginPage() {
  const [loading, setLoading] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function handleLogin(role: string) {
    setLoading(role);
    setError(null);
    // Navigate to the server route which handles session creation + redirect
    window.location.href = `/auth/dev-login?role=${role}`;
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-50 p-4">
      <div className="w-full max-w-md space-y-6">
        {/* Header */}
        <div className="text-center">
          <div className="mx-auto mb-3 flex size-12 items-center justify-center rounded-xl bg-slate-900 text-white">
            <Shield className="size-6" />
          </div>
          <h1 className="text-xl font-bold text-slate-900">Dev Login</h1>
          <p className="mt-1 text-sm text-slate-500">
            Development only — sign in as any role
          </p>
        </div>

        {/* User cards */}
        <div className="space-y-3">
          {DEV_USERS.map((user) => (
            <button
              key={user.role}
              onClick={() => handleLogin(user.role)}
              disabled={loading !== null}
              className="group flex w-full items-start gap-4 rounded-xl bg-white p-4 text-start shadow-sm ring-1 ring-slate-900/[0.03] transition-all hover:-translate-y-0.5 hover:shadow-md disabled:opacity-50"
            >
              <div
                className={`flex size-10 shrink-0 items-center justify-center rounded-lg ring-1 ${user.color}`}
              >
                {loading === user.role ? (
                  <Loader2 className="size-5 animate-spin" />
                ) : (
                  <user.icon className="size-5" />
                )}
              </div>
              <div className="min-w-0 flex-1">
                <p className="font-semibold text-slate-900">{user.label}</p>
                <p className="mt-0.5 text-xs text-slate-500">{user.description}</p>
                <p className="mt-1 font-mono text-[10px] text-slate-400">
                  dev-{user.role}@popsdrops.test
                </p>
              </div>
            </button>
          ))}
        </div>

        {/* Error */}
        {error && (
          <div className="rounded-lg bg-red-50 p-3 text-sm text-red-700">{error}</div>
        )}

        {/* Info */}
        <p className="text-center text-xs text-slate-400">
          Sessions created via admin API — no password auth needed.
          <br />
          Users are auto-provisioned on first login.
        </p>
      </div>
    </div>
  );
}

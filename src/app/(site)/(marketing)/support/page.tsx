import type { Metadata } from "next";
import Link from "next/link";
import { ArrowRight, Building2, ShieldCheck, UserRound } from "lucide-react";

export const metadata: Metadata = {
  title: "Support",
  description:
    "Get help with PopsDrops creator campaigns, account access, privacy requests, and app review.",
};

const supportPaths = [
  {
    title: "Creators",
    description:
      "Campaign access, brief translation, content submissions, proof uploads, correction requests, and payment status.",
    href: "mailto:support@popsdrops.com?subject=PopsDrops creator support",
    icon: UserRound,
  },
  {
    title: "Brands",
    description:
      "Invite access, campaign setup, service fee checkout, creator handoff, reporting, and team settings.",
    href: "mailto:support@popsdrops.com?subject=PopsDrops brand support",
    icon: Building2,
  },
  {
    title: "Privacy & data",
    description:
      "Data export, account deletion, retention questions, legal notices, and privacy policy requests.",
    href: "mailto:legal@popsdrops.com?subject=PopsDrops privacy request",
    icon: ShieldCheck,
  },
];

export default function SupportPage() {
  return (
    <main className="bg-white pt-28 pb-20 sm:pt-36">
      <section className="mx-auto max-w-5xl px-6">
        <div className="max-w-2xl">
          <p className="text-sm font-medium text-slate-500">PopsDrops Support</p>
          <h1 className="mt-4 text-4xl font-semibold tracking-tight text-slate-950 sm:text-5xl">
            Help for private creator campaigns.
          </h1>
          <p className="mt-5 text-base leading-7 text-slate-600">
            Tell us what is blocking your campaign, account, proof, or data request. We route support by the work you are trying to finish.
          </p>
        </div>

        <div className="mt-12 grid gap-4 md:grid-cols-3">
          {supportPaths.map((path) => {
            const Icon = path.icon;

            return (
              <a
                key={path.title}
                href={path.href}
                className="group rounded-2xl border border-slate-200 bg-white p-6 shadow-sm transition duration-200 hover:-translate-y-0.5 hover:border-slate-300 hover:shadow-md"
              >
                <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-slate-100 text-slate-700">
                  <Icon className="h-5 w-5" aria-hidden="true" />
                </div>
                <h2 className="mt-6 text-lg font-semibold tracking-tight text-slate-950">
                  {path.title}
                </h2>
                <p className="mt-3 text-sm leading-6 text-slate-600">
                  {path.description}
                </p>
                <span className="mt-6 inline-flex items-center gap-2 text-sm font-medium text-slate-950">
                  Email support
                  <ArrowRight
                    className="h-4 w-4 transition group-hover:translate-x-0.5"
                    aria-hidden="true"
                  />
                </span>
              </a>
            );
          })}
        </div>

        <div className="mt-10 rounded-2xl border border-slate-200 bg-slate-50 p-6">
          <h2 className="text-base font-semibold tracking-tight text-slate-950">
            App review and account access
          </h2>
          <p className="mt-3 max-w-3xl text-sm leading-6 text-slate-600">
            App review teams can reach us at{" "}
            <a className="font-medium text-slate-950" href="mailto:support@popsdrops.com">
              support@popsdrops.com
            </a>
            . Privacy requests go to{" "}
            <a className="font-medium text-slate-950" href="mailto:legal@popsdrops.com">
              legal@popsdrops.com
            </a>
            . PopsDrops uses Google OAuth, email magic links, and OTP fallback. We do not use passwords.
          </p>
          <div className="mt-5 flex flex-wrap gap-3">
            <Link
              href="/privacy"
              className="rounded-lg border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-slate-950 shadow-sm transition hover:border-slate-300"
            >
              Privacy Policy
            </Link>
            <Link
              href="/terms"
              className="rounded-lg border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-slate-950 shadow-sm transition hover:border-slate-300"
            >
              Terms of Service
            </Link>
          </div>
        </div>
      </section>
    </main>
  );
}

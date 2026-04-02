import { Clock, CheckCircle2, Mail, LogOut } from "lucide-react";
import Link from "next/link";

export default function PendingApprovalPage() {
  return (
    <div className="rounded-xl border border-slate-200 bg-white p-8 text-center shadow-sm">
      <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-amber-100">
        <Clock className="h-7 w-7 text-amber-600" />
      </div>
      <h1 className="mt-4 text-xl font-bold text-slate-900">
        Your Application is Under Review
      </h1>
      <p className="mt-2 text-sm text-slate-600">
        We&apos;re reviewing your profile to ensure quality for everyone on the
        platform. This usually takes less than 24 hours.
      </p>

      <div className="mt-8 space-y-4 text-left">
        <h2 className="text-sm font-semibold text-slate-900">
          What happens next?
        </h2>
        {[
          {
            icon: CheckCircle2,
            text: "We verify your information",
          },
          {
            icon: Mail,
            text: "You'll receive an email when approved",
          },
          {
            icon: Clock,
            text: "Start exploring campaigns immediately",
          },
        ].map((step, i) => (
          <div key={i} className="flex items-center gap-3">
            <step.icon className="h-4 w-4 shrink-0 text-slate-900" />
            <span className="text-sm text-slate-600">{step.text}</span>
          </div>
        ))}
      </div>

      <div className="mt-8 flex flex-col gap-2">
        <Link
          href="mailto:hello@popsdrops.com"
          className="text-sm text-slate-900 hover:underline"
        >
          Contact Support
        </Link>
        <Link
          href="/"
          className="inline-flex items-center justify-center gap-1 text-sm text-slate-400 hover:text-slate-600"
        >
          <LogOut className="h-3 w-3" />
          Back to home
        </Link>
      </div>
    </div>
  );
}

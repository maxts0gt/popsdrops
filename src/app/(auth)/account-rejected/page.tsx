import { XCircle, LogOut } from "lucide-react";
import Link from "next/link";

export default function AccountRejectedPage() {
  return (
    <div className="rounded-xl border border-slate-200 bg-white p-8 text-center shadow-sm">
      <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-red-100">
        <XCircle className="h-7 w-7 text-red-600" />
      </div>
      <h1 className="mt-4 text-xl font-bold text-slate-900">
        Application Not Approved
      </h1>
      <p className="mt-2 text-sm text-slate-600">
        Unfortunately, we weren&apos;t able to approve your account at this
        time. This could be because we couldn&apos;t verify your social
        accounts or information provided.
      </p>
      <div className="mt-6 flex flex-col gap-2">
        <Link
          href="mailto:hello@popsdrops.com"
          className="text-sm text-slate-900 hover:underline"
        >
          Contact us to learn more or re-apply
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

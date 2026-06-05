"use client";

import { CheckCircle2, Clock, PenLine } from "lucide-react";
import {
  getAgreementStatusLabelKey,
  type AgreementStatus,
} from "@/lib/agreements/campaign-agreement";
import { useTranslation } from "@/lib/i18n";

const agreementStatusClassNames: Record<AgreementStatus, string> = {
  not_required: "border-slate-200 bg-white text-muted-foreground",
  pending: "border-amber-200 bg-amber-50 text-amber-900",
  signed: "border-slate-200 bg-slate-50 text-slate-700",
  needs_reacceptance: "border-red-200 bg-red-50 text-red-700",
};

const agreementStatusIcons = {
  not_required: Clock,
  pending: PenLine,
  signed: CheckCircle2,
  needs_reacceptance: PenLine,
} satisfies Record<AgreementStatus, typeof Clock>;

export function AgreementStatusCell({ status }: { status: AgreementStatus }) {
  const { t } = useTranslation("brand.campaign");
  const Icon = agreementStatusIcons[status];

  return (
    <span
      data-testid="campaign-member-agreement-status"
      className={`inline-flex whitespace-nowrap rounded-full border px-2 py-0.5 text-xs font-medium ${agreementStatusClassNames[status]}`}
    >
      <Icon className="me-1 size-3" aria-hidden="true" />
      {t(getAgreementStatusLabelKey(status))}
    </span>
  );
}

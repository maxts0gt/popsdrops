"use client";

import { useCallback, useEffect, useState, useTransition } from "react";
import { Download, Loader2, ShieldAlert } from "lucide-react";
import { toast } from "sonner";
import {
  getPrivacyExportDownloadUrl,
  requestAccountDeletion,
  requestDataExport,
} from "@/app/actions/compliance";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useTranslation } from "@/lib/i18n";
import { createClient, getBrowserUser } from "@/lib/supabase/client";
import { cn } from "@/lib/utils";
import type {
  DataRightsRequestStatus,
  DataRightsRequestType,
} from "@/types/database";

type PrivacyRequestRow = {
  id: string;
  request_type: DataRightsRequestType;
  status: DataRightsRequestStatus;
  retention_note: string | null;
  scheduled_for: string | null;
  completed_at: string | null;
  processed_at: string | null;
  processing_error: string | null;
  export_storage_path: string | null;
  export_file_name: string | null;
  export_expires_at: string | null;
  created_at: string;
};

const DENIAL_REASON_MARKER = "Admin denial reason:";

const STATUS_LABEL_KEYS: Record<DataRightsRequestStatus, string> = {
  pending: "privacy.status.pending",
  scheduled: "privacy.status.scheduled",
  reviewing: "privacy.status.reviewing",
  processing: "privacy.status.processing",
  completed: "privacy.status.completed",
  failed: "privacy.status.failed",
  rejected: "privacy.status.rejected",
  cancelled: "privacy.status.cancelled",
};

const REQUEST_TYPE_LABEL_KEYS: Record<DataRightsRequestType, string> = {
  export: "privacy.requestType.export",
  deletion: "privacy.requestType.deletion",
  correction: "privacy.requestType.correction",
};

function getDenialReason(note: string | null) {
  if (!note?.includes(DENIAL_REASON_MARKER)) return null;

  return note.split(DENIAL_REASON_MARKER).pop()?.trim() || null;
}

function isExportExpired(request: PrivacyRequestRow) {
  return (
    request.request_type === "export" &&
    Boolean(request.export_expires_at) &&
    new Date(request.export_expires_at as string).getTime() <= Date.now()
  );
}

export function PrivacyControlsPanel() {
  const { t, locale } = useTranslation("settings");
  const [deleteConfirmation, setDeleteConfirmation] = useState("");
  const [requests, setRequests] = useState<PrivacyRequestRow[]>([]);
  const [historyLoading, setHistoryLoading] = useState(true);
  const [pendingAction, setPendingAction] = useState<"export" | "deletion" | null>(
    null,
  );
  const [pendingDownload, setPendingDownload] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const deleteConfirmText = t("privacy.deletion.confirmText");
  const deletionReady = deleteConfirmation.trim() === deleteConfirmText;

  const formatDate = useCallback(
    (date: string | null) => {
      if (!date) return null;

      return new Intl.DateTimeFormat(locale, {
        month: "short",
        day: "numeric",
        year: "numeric",
      }).format(new Date(date));
    },
    [locale],
  );

  const loadPrivacyRequests = useCallback(async () => {
    setHistoryLoading(true);
    try {
      const {
        data: { user },
      } = await getBrowserUser();

      if (!user) {
        setRequests([]);
        return;
      }

      const supabase = createClient();
      const { data, error } = await supabase
        .from("data_rights_requests")
        .select(
          "id, request_type, status, retention_note, scheduled_for, completed_at, processed_at, processing_error, export_storage_path, export_file_name, export_expires_at, created_at",
        )
        .eq("profile_id", user.id)
        .order("created_at", { ascending: false })
        .limit(6);

      if (error) throw error;

      setRequests((data ?? []) as PrivacyRequestRow[]);
    } catch {
      setRequests([]);
    } finally {
      setHistoryLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadPrivacyRequests();
  }, [loadPrivacyRequests]);

  function handleExport() {
    setPendingAction("export");
    startTransition(() => {
      void (async () => {
        try {
          await requestDataExport();
          await loadPrivacyRequests();
          toast.success(t("privacy.export.success"));
        } catch {
          toast.error(t("privacy.export.error"));
        } finally {
          setPendingAction(null);
        }
      })();
    });
  }

  function handleDeletion() {
    setPendingAction("deletion");
    startTransition(() => {
      void (async () => {
        try {
          await requestAccountDeletion();
          await loadPrivacyRequests();
          setDeleteConfirmation("");
          toast.success(t("privacy.deletion.success"));
        } catch {
          toast.error(t("privacy.deletion.error"));
        } finally {
          setPendingAction(null);
        }
      })();
    });
  }

  function handleDownload(requestId: string) {
    setPendingDownload(requestId);
    startTransition(() => {
      void (async () => {
        try {
          const result = await getPrivacyExportDownloadUrl({ requestId });
          window.location.assign(result.signedUrl);
        } catch {
          toast.error(t("privacy.download.error"));
        } finally {
          setPendingDownload(null);
        }
      })();
    });
  }

  function getStatusLabel(status: DataRightsRequestStatus) {
    return t(STATUS_LABEL_KEYS[status]);
  }

  function getRequestTitle(type: DataRightsRequestType) {
    return t(REQUEST_TYPE_LABEL_KEYS[type]);
  }

  function getRequestDetail(request: PrivacyRequestRow) {
    if (request.status === "scheduled" && request.scheduled_for) {
      return t("privacy.history.scheduledFor", {
        date: formatDate(request.scheduled_for) ?? "",
      });
    }

    if (request.status === "completed") {
      if (isExportExpired(request)) {
        return t("privacy.history.expired", {
          date: formatDate(request.export_expires_at) ?? "",
        });
      }

      if (request.request_type === "export" && request.export_expires_at) {
        return t("privacy.history.availableUntil", {
          date: formatDate(request.export_expires_at) ?? "",
        });
      }

      return t("privacy.history.completedAt", {
        date: formatDate(request.completed_at ?? request.processed_at) ?? "",
      });
    }

    if (request.status === "failed" && request.processing_error) {
      return t("privacy.history.reviewing");
    }

    return t("privacy.history.createdAt", {
      date: formatDate(request.created_at) ?? "",
    });
  }

  return (
    <section className="space-y-4">
      <div>
        <h2 className="text-sm font-semibold text-foreground">
          {t("privacy.title")}
        </h2>
        <p className="mt-1 text-sm text-muted-foreground">
          {t("privacy.detail")}
        </p>
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        <div className="flex items-start justify-between gap-3 rounded-xl border border-border/70 p-3">
          <div className="flex min-w-0 gap-3">
            <div className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-muted text-muted-foreground">
              <Download className="size-4" />
            </div>
            <div>
              <p className="text-sm font-medium text-foreground">
                {t("privacy.export")}
              </p>
              <p className="mt-0.5 text-sm text-muted-foreground">
                {t("privacy.export.detail")}
              </p>
            </div>
          </div>
          <Button
            type="button"
            variant="outline"
            size="sm"
            data-testid="privacy-export-request"
            onClick={handleExport}
            disabled={isPending}
          >
            {pendingAction === "export" && (
              <Loader2 className="size-3.5 animate-spin" />
            )}
            {t("privacy.request")}
          </Button>
        </div>

        <div className="space-y-3 rounded-xl border border-border/70 p-3">
          <div className="flex items-start gap-3">
            <div className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-muted text-muted-foreground">
              <ShieldAlert className="size-4" />
            </div>
            <div>
              <p className="text-sm font-medium text-foreground">
                {t("privacy.deletion")}
              </p>
              <p className="mt-0.5 text-sm text-muted-foreground">
                {t("privacy.deletion.detail")}
              </p>
            </div>
          </div>
          <div className="grid gap-2 sm:grid-cols-[1fr_auto]">
            <div>
              <Label htmlFor="delete-confirmation">
                {t("privacy.deletion.confirmLabel")}
              </Label>
              <Input
                id="delete-confirmation"
                value={deleteConfirmation}
                onChange={(event) =>
                  setDeleteConfirmation(event.target.value)
                }
                className="mt-1.5"
              />
            </div>
            <div className="flex items-end">
              <Button
                type="button"
                variant="destructive"
                data-testid="privacy-deletion-request"
                onClick={handleDeletion}
                disabled={isPending || !deletionReady}
              >
                {pendingAction === "deletion" && (
                  <Loader2 className="size-3.5 animate-spin" />
                )}
                {t("privacy.request")}
              </Button>
            </div>
          </div>
        </div>
      </div>

      <div
        className="rounded-xl border border-border/70 p-3"
        data-testid="privacy-request-history"
      >
        <div className="flex items-center justify-between gap-3">
          <p className="text-sm font-medium text-foreground">
            {t("privacy.history.title")}
          </p>
          {historyLoading && (
            <Loader2
              aria-label={t("privacy.history.loading")}
              className="size-3.5 animate-spin text-muted-foreground"
            />
          )}
        </div>

        {!historyLoading && requests.length === 0 && (
          <p className="mt-2 text-sm text-muted-foreground">
            {t("privacy.history.empty")}
          </p>
        )}

        {requests.length > 0 && (
          <div className="mt-3 divide-y divide-border/70">
            {requests.map((request) => {
              const denialReason =
                request.status === "rejected"
                  ? getDenialReason(request.retention_note)
                  : null;
              const canDownload =
                request.request_type === "export" &&
                request.status === "completed" &&
                Boolean(request.export_storage_path) &&
                !isExportExpired(request);

              return (
                <div
                  key={request.id}
                  className="grid gap-2 py-3 first:pt-0 last:pb-0 sm:grid-cols-[minmax(0,1fr)_auto]"
                  data-testid="privacy-request-row"
                >
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-foreground">
                      {getRequestTitle(request.request_type)}
                    </p>
                    <p className="mt-0.5 text-sm text-muted-foreground">
                      {getRequestDetail(request)}
                    </p>
                    {denialReason && (
                      <p
                        className="mt-2 text-sm text-muted-foreground"
                        data-testid="privacy-request-denial-reason"
                      >
                        {t("privacy.history.denialReason", {
                          reason: denialReason,
                        })}
                      </p>
                    )}
                  </div>
                  <div className="flex flex-wrap items-center gap-2 sm:justify-end">
                    <span
                      className={cn(
                        "inline-flex h-7 w-fit items-center rounded-full border px-2.5 text-xs font-medium",
                        request.status === "completed" &&
                          "border-emerald-200 bg-emerald-50 text-emerald-700",
                        request.status === "rejected" &&
                          "border-amber-200 bg-amber-50 text-amber-700",
                        request.status !== "completed" &&
                          request.status !== "rejected" &&
                          "border-border bg-muted text-muted-foreground",
                      )}
                    >
                      {getStatusLabel(request.status)}
                    </span>
                    {canDownload && (
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        data-testid="privacy-export-download"
                        onClick={() => handleDownload(request.id)}
                        disabled={pendingDownload === request.id}
                        className="h-7 gap-1.5 px-2.5 text-xs"
                      >
                        {pendingDownload === request.id ? (
                          <Loader2 className="size-3 animate-spin" />
                        ) : (
                          <Download className="size-3" />
                        )}
                        {t("privacy.download")}
                      </Button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </section>
  );
}

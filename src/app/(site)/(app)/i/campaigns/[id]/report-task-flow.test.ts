import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const source = readFileSync(new URL("./page.tsx", import.meta.url), "utf8");
const performanceFormSource = readFileSync(
  new URL("../../../../../../components/shared/performance-form.tsx", import.meta.url),
  "utf8",
);
const contentSubmitFormSource = readFileSync(
  new URL("../../../../../../components/shared/content-submit-form.tsx", import.meta.url),
  "utf8",
);
const platformUrlSource = readFileSync(
  new URL("../../../../../../lib/platform-url.ts", import.meta.url),
  "utf8",
);
const reportSubmissionStateSource = readFileSync(
  new URL(
    "../../../../../../lib/campaigns/creator-report-submission-state.ts",
    import.meta.url,
  ),
  "utf8",
);
const creatorReportGoalContextSource = readFileSync(
  new URL(
    "../../../../../../lib/reporting/creator-report-goal-context.ts",
    import.meta.url,
  ),
  "utf8",
);
const designSource = readFileSync(
  new URL("../../../../../../../DESIGN.md", import.meta.url),
  "utf8",
);
const stringsSource = readFileSync(
  new URL("../../../../../../../src/lib/i18n/strings.ts", import.meta.url),
  "utf8",
);
const platformEnglishBundleSource = readFileSync(
  new URL(
    "../../../../../../../src/lib/i18n/generated/platform-bundles/en.json",
    import.meta.url,
  ),
  "utf8",
);

describe("creator campaign report task flow", () => {
  it("shows a live URL publish control before performance reporting", () => {
    expect(source).toContain("import { publishContent }");
    expect(source).toContain("function PublishUrlForm");
    expect(source).toContain('s.status === "approved"');
    expect(source).toContain("await publishContent(submissionId, publishedUrl.trim())");
  });

  it("loads campaign report tasks for the accepted member", () => {
    expect(source).toContain("interface ReportTask");
    expect(source).toContain("const [reportTasks, setReportTasks]");
    expect(source).toContain(".from(\"campaign_report_tasks\")");
    expect(source).toContain(".eq(\"campaign_member_id\", member.id)");
  });

  it("blocks the creator room behind the agreement gate until signed", () => {
    expect(source).toContain("AgreementGate");
    expect(source).toContain("const [agreementStatus, setAgreementStatus]");
    expect(source).toContain(".from(\"campaign_member_agreement_status\")");
    expect(source).toContain('agreementStatus.status !== "signed"');
    expect(source).toContain('agreementStatus.status !== "not_required"');
  });

  it("passes the active report task into each performance form", () => {
    expect(source).toContain("const activeReportTask =");
    expect(source).toContain("reportTaskId={activeReportTask?.id}");
    expect(source).toContain("reportTaskDueAt={activeReportTask?.due_at}");
    expect(source).toContain(
      "content_performance ( id, report_task_id, reported_at, verification_status )",
    );
    expect(source).toContain("getCreatorReportSubmissionState");
    expect(source).toContain("isSubmitted={");
    expect(source).toContain("isSubmitted={reportState.isSubmitted}");
    expect(performanceFormSource).toContain("reportTaskId?: string");
    expect(performanceFormSource).toContain("isSubmitted?: boolean");
    expect(performanceFormSource).toContain("report_task_id: reportTaskId");
  });

  it("passes brand-selected measurement fields into the creator proof form", () => {
    expect(source).toContain("interface ReportingRequirement");
    expect(source).toContain("const [reportingRequirements, setReportingRequirements]");
    expect(source).toContain(".from(\"campaign_reporting_requirements\")");
    expect(source).toContain("required_metric_keys");
    expect(source).toContain("getReportingRequirementForSubmission(");
    expect(source).toContain("requiredMetricKeys={reportingRequirement?.required_metric_keys ?? undefined}");
    expect(performanceFormSource).toContain("requiredMetricKeys?: string[]");
    expect(performanceFormSource).toContain(
      "getPlatformMetricFields(platform, requiredMetricKeys)",
    );
  });

  it("shows why creator proof is needed based on the brand report goal", () => {
    expect(source).toContain("getCreatorReportGoalContext");
    expect(source).toContain("const [reportGoalContext, setReportGoalContext]");
    expect(source).toContain(".from(\"campaign_reporting_plans\")");
    expect(source).toContain("report_preset_id, report_chart_mode_id, report_block_ids");
    expect(source).toContain("setReportGoalContext(getCreatorReportGoalContext");
    expect(source).toContain("reportGoalContext={reportGoalContext}");
    expect(performanceFormSource).toContain("reportGoalContext?: CreatorReportGoalContext | null");
    expect(performanceFormSource).toContain('data-testid="performance-report-goal-context"');
    expect(performanceFormSource).toContain("reportGoalContext.detail");
    expect(creatorReportGoalContextSource).toContain("reportGoal.preset.leadership");
    expect(creatorReportGoalContextSource).toContain("reportGoal.block.reportTrust");
    expect(stringsSource).toContain('"reportGoalContext.title": "Report goal"');
    expect(stringsSource).toContain('"reportGoal.preset.leadership": "Leadership brief"');
    expect(platformEnglishBundleSource).toContain('"reportGoalContext.title": "Report goal"');
  });

  it("surfaces a brand-requested report correction without locking the form", () => {
    expect(source).toContain("review_note: string | null");
    expect(source).toContain("submitted_at, review_note");
    expect(source).toContain("const correctionReportTask =");
    expect(source).toContain('task.status === "needs_revision"');
    expect(source).toContain("getReportCorrectionPriority");
    expect(source).toContain("correctionReportTasks.toSorted");
    expect(source).toContain("data-testid=\"creator-report-correction\"");
    expect(source).toContain("submit.performanceCorrection");
    expect(source).toContain("formatShortDate(correctionReportTask.due_at");
    expect(source).toContain(
      'const isReportCorrection = activeReportTask?.status === "needs_revision";',
    );
    expect(source).toContain("proofStatusLabel");
  });

  it("limits correction mode to the submission whose proof was rejected", () => {
    expect(source).toContain(
      "content_performance ( id, report_task_id, reported_at, verification_status )",
    );
    expect(source).toContain("getCreatorReportSubmissionState");
    expect(reportSubmissionStateSource).toContain(
      'latestRow?.verification_status === "rejected"',
    );
    expect(reportSubmissionStateSource).toContain("getLatestReportForTask");
    expect(reportSubmissionStateSource).toContain("row.reported_at");
    expect(source).toContain(
      "reportState.shouldShowForm",
    );
    expect(source).toContain("reportState.statusKey");
    expect(source).toContain("reportState.dueAt");
  });

  it("ties brand correction feedback to the exact proof row the creator must fix", () => {
    expect(source).toContain("evidence_review_note");
    expect(source).toContain("reportState.correctionNote");
    expect(source).toContain('data-testid="creator-report-correction-note"');
    expect(source).toContain("room.brandFeedback");
  });

  it("names corrected proof resubmission as correction work", () => {
    expect(performanceFormSource).toContain(
      'const isCorrectionResubmission = reportTaskStatus === "needs_revision";',
    );
    expect(performanceFormSource).toMatch(
      /isCorrectionResubmission\s+\?\s+t\("submitted\.correctionTitle"\)/,
    );
    expect(performanceFormSource).toMatch(
      /isCorrectionResubmission\s+\?\s+t\("submitted\.correctionDetail"\)/,
    );
    expect(performanceFormSource).toMatch(
      /isCorrectionResubmission\s+\?\s+t\("action\.resubmitCorrection"\)/,
    );
    expect(stringsSource).toContain(
      '"submitted.correctionTitle": "Correction sent"',
    );
    expect(stringsSource).toContain('"submitted.correctionDetail"');
    expect(stringsSource).toContain(
      '"Your corrected proof is back with the brand."',
    );
    expect(stringsSource).toContain('"action.resubmitCorrection": "Resubmit proof"');
    expect(designSource).toContain(
      "Creator correction resubmission must be named as correction work.",
    );
  });

  it("prioritizes performance reporting once content is already published", () => {
    expect(source).toContain("const hasPublishedSubmissions =");
    expect(source).toContain("const hasOpenReportTask =");
    expect(source).toContain("const shouldOpenSubmitTab =");
    expect(source).toContain("const activeDueDate =");
    expect(source).toContain("status.reportDue");
    expect(source).toContain('const initialTab = shouldOpenSubmitTab ? "submit" : "brief";');
    expect(stringsSource).toContain('"next.performanceProof.title"');
    expect(stringsSource).toContain('"next.performanceProof.detail"');
    expect(source).toContain("getActiveCreatorRoomSubmissions");
    expect(source).toMatch(
      /const showContentSubmitForm =\s+creatorWorkIsOpen && \(\s+activeSubmissions\.length === 0 \|\| hasRevisionNeeded\s+\);/,
    );
    expect(stringsSource).toContain('"next.performanceProof.title"');
    expect(stringsSource).toContain('"next.performanceProof.detail"');
    expect(stringsSource).toContain('"status.reportDue"');
    expect(stringsSource).toContain('"submit.reportPerformanceDetail"');
    expect(stringsSource).toContain(
      '"Upload platform analytics, review extracted numbers, then send proof to the brand."',
    );
    expect(stringsSource).toContain(
      '"next.performanceProof.title": "Upload analytics proof"',
    );
    expect(stringsSource).toContain('"next.performanceProof.action": "Upload proof"');
    expect(designSource).toContain(
      "Creator proof-needed states must say what evidence to upload and where it goes.",
    );
  });

  it("opens the submit workspace when approved content still needs a live URL", () => {
    expect(source).toContain("const hasApprovedContentMissingLiveUrl =");
    expect(source).toContain(
      'submission.status === "approved" && !submission.published_url',
    );
    expect(source).toContain("hasApprovedContentMissingLiveUrl ||");
  });

  it("uses one compact next action strip to route the creator to the right tab", () => {
    expect(source).toContain("getCreatorRoomNextAction");
    expect(source).toContain("function CampaignRoomActionStrip");
    expect(source).toContain("const selectedTab = requestedTab ?? initialTab;");
    expect(source).not.toContain("const [activeTab, setActiveTab]");
    expect(source).toContain("value={selectedTab}");
    expect(source).toContain("onValueChange={handleCreatorRoomTabChange}");
    expect(source).toContain("onClick={() => handleCreatorRoomTabChange(roomAction.targetTab)}");
    expect(source).toContain('t("next.label")');
    expect(source).toContain('t(`next.${roomAction.key}.title`)');
    expect(source).toContain('t(`next.${roomAction.key}.detail`)');
    expect(stringsSource).toContain('"next.firstDraft.title"');
    expect(stringsSource).toContain('"next.brandReview.title"');
    expect(stringsSource).toContain('"next.performanceProof.title"');
    expect(stringsSource).toContain('"next.onTrack.title"');
  });

  it("orders the creator room first viewport as identity, one next action, tabs, then content", () => {
    const firstViewportSource = source.slice(
      source.indexOf('data-testid="creator-room-first-viewport"'),
      source.indexOf('{/* Brief tab */}'),
    );
    const identityIndex = firstViewportSource.indexOf(
      'data-testid="creator-room-identity"',
    );
    const actionIndex = firstViewportSource.indexOf(
      'data-testid="creator-room-next-action"',
    );
    const tabsIndex = firstViewportSource.indexOf(
      'data-testid="creator-room-flow-tabs"',
    );

    expect(firstViewportSource).toContain(
      'data-testid="creator-room-first-viewport"',
    );
    expect(firstViewportSource).toContain('data-testid="creator-room-identity"');
    expect(firstViewportSource).toContain('data-testid="creator-room-active-due"');
    expect(firstViewportSource).toContain('data-testid="creator-room-rate"');
    expect(identityIndex).toBeGreaterThan(-1);
    expect(actionIndex).toBeGreaterThan(identityIndex);
    expect(tabsIndex).toBeGreaterThan(actionIndex);
  });

  it("shows accepted rate and payment status together in the creator room identity", () => {
    const identitySource = source.slice(
      source.indexOf('data-testid="creator-room-identity"'),
      source.indexOf("{/* Review CTA for completed campaigns */}"),
    );

    expect(source).toContain("payment_status: PaymentStatusType");
    expect(source).toContain("payment_status: member.payment_status");
    expect(source).toContain("payment.status.");
    expect(identitySource).toContain('data-testid="creator-room-rate"');
    expect(identitySource).toContain('data-testid="creator-room-payment-status"');
    expect(identitySource).toContain("room.paymentStatus");
    expect(stringsSource).toContain('"room.paymentStatus": "Payment {status}"');
    expect(stringsSource).toContain('"payment.status.pending": "pending"');
    expect(stringsSource).toContain('"payment.status.paid": "paid"');
    expect(platformEnglishBundleSource).toContain(
      '"room.paymentStatus": "Payment {status}"',
    );
  });

  it("keeps the next action strip visually quieter than the creator room content", () => {
    const actionStripSource = source.slice(
      source.indexOf("function CampaignRoomActionStrip"),
      source.indexOf("function CampaignBriefWorkspace"),
    );

    expect(actionStripSource).toContain("border-border bg-card text-foreground");
    expect(actionStripSource).toContain("bg-muted/50");
    expect(actionStripSource).toContain('variant="outline"');
    expect(actionStripSource).toContain('className="h-8 shrink-0 px-2.5 text-xs"');
    expect(actionStripSource).toContain("text-xs leading-snug text-muted-foreground");
    expect(actionStripSource).not.toContain("mt-4 rounded-xl");
    expect(actionStripSource).not.toContain("truncate text-xs");
    expect(actionStripSource).not.toContain("bg-blue");
  });

  it("uses the tab rail as a compact creator handoff map", () => {
    expect(source).toContain('data-testid="creator-room-flow-tabs"');
    expect(source).toContain('data-testid="creator-room-flow-tab"');
    expect(source).toContain("flow.brief.detail");
    expect(source).toContain("flow.tasks.detail");
    expect(source).toContain("flow.submit.detail");
    expect(source).toContain("deliverables.length");
    expect(source).toContain("completedTaskCount");
    expect(source).toContain("roomAction.targetTab");
    expect(source).toContain(
      "const hasActionAttention = !creatorRoomStatusOnlyActions.has(roomAction.key);",
    );
    expect(source).toContain("grid-cols-3");
    expect(stringsSource).toContain('"flow.brief.detail"');
    expect(stringsSource).toContain('"flow.tasks.detail"');
    expect(stringsSource).toContain('"flow.submit.detail"');
  });

  it("keeps creator room active tabs obvious without using a dark primary slab", () => {
    const tabsSource = source.slice(
      source.indexOf('data-testid="creator-room-flow-tabs"'),
      source.indexOf("</TabsList>", source.indexOf('data-testid="creator-room-flow-tabs"')),
    );

    expect(source).toContain("rounded-xl border border-border bg-muted/40 p-1");
    expect(tabsSource).toContain("border-transparent bg-transparent");
    expect(tabsSource).toContain("hover:bg-background/70");
    expect(tabsSource).toContain("data-active:border-border");
    expect(tabsSource).toContain("data-active:bg-background");
    expect(tabsSource).toContain("data-active:text-foreground");
    expect(tabsSource).toContain("text-current");
    expect(tabsSource).toContain("after:hidden");
    expect(tabsSource).toContain("shadow-none");
    expect(tabsSource).not.toContain("data-active:bg-slate-900");
    expect(tabsSource).not.toContain("data-active:text-white");
    expect(designSource).toContain(
      "not a heavy dark outline or dark primary fill",
    );
  });

  it("does not mark a tab with an attention dot when no creator action is waiting", () => {
    expect(source).toContain("hasActionAttention && roomAction.targetTab");
    expect(source).toContain(
      "creatorRoomStatusOnlyActions.has(roomAction.key)",
    );
    expect(designSource).toContain(
      "A tab attention dot means a real creator action is waiting.",
    );
  });

  it("does not show a fake next-action button when the creator room is waiting", () => {
    const actionStripSource = source.slice(
      source.indexOf("function CampaignRoomActionStrip"),
      source.indexOf("function CampaignBriefWorkspace"),
    );

    expect(source).toContain("const creatorRoomStatusOnlyActions = new Set");
    expect(source).toContain('"brandReview"');
    expect(source).toContain('"proofReview"');
    expect(source).toContain('"onTrack"');
    expect(actionStripSource).toContain(
      "!creatorRoomStatusOnlyActions.has(action.key)",
    );
    expect(actionStripSource).toContain("showActionButton");
    expect(actionStripSource).toContain("{showActionButton && (");
    expect(actionStripSource).toContain("actionLabel");
    expect(designSource).toContain(
      "Creator room waiting states are status, not work.",
    );
    expect(stringsSource).toContain(
      '"next.brandReview.title": "Submitted for review"',
    );
    expect(stringsSource).toContain(
      "The brand is reviewing your draft. You will be notified if changes are needed.",
    );
    expect(stringsSource).toContain(
      '"next.proofReview.title": "Proof sent for review"',
    );
    expect(stringsSource).toContain(
      "The brand is reviewing your performance proof. You will be notified if corrections are needed.",
    );
  });

  it("names creator room tabs by their mental model instead of raw counts", () => {
    const tabsSource = source.slice(
      source.indexOf("const flowTabs"),
      source.indexOf("return (", source.indexOf("const flowTabs")),
    );

    expect(tabsSource).toContain('t("flow.brief.detail")');
    expect(tabsSource).not.toContain("flow.brief.detailSingle");
    expect(stringsSource).toContain('"flow.brief.detail": "What to make"');
    expect(stringsSource).toContain('"flow.tasks.detail": "{done}/{total} complete"');
    expect(stringsSource).toContain('"flow.submit.detail": "Send work"');
    expect(designSource).toContain(
      "Creator room tab labels and details must answer three different questions.",
    );
  });

  it("presents the brief tab as one compact creator reading surface", () => {
    expect(source).toContain("function CampaignBriefWorkspace");
    expect(source).toContain('data-testid="creator-brief-workspace"');
    expect(source).toContain('data-testid="creator-brief-deliverables"');
    expect(source).toContain('data-testid="creator-brief-timeline"');
    expect(source).toContain('data-testid="creator-brief-guidance"');
    expect(source).toContain("brief.overview");
    expect(source).toContain("brief.guidance");
    expect(source).toContain("brief.keyDates");
    expect(source).toContain("room={room}");
    expect(source).toContain("deliverables={deliverables}");
  });

  it("honors notification deep links to the creator room tab", () => {
    expect(source).toContain("useSearchParams");
    expect(source).toContain("getRequestedCreatorRoomTab");
    expect(source).toContain('searchParams.get("tab")');
    expect(source).toContain("requestedTab ??");
  });

  it("makes creator room tabs URL addressable for refresh-safe handoff work", () => {
    expect(source).toContain("usePathname");
    expect(source).toContain("useRouter");
    expect(source).toContain("function buildCreatorRoomTabUrl");
    expect(source).toContain("const handleCreatorRoomTabChange = useCallback");
    expect(source).toContain(
      "router.replace(buildCreatorRoomTabUrl(pathname, searchParams, tab)",
    );
    expect(source).toContain('!shouldOpenSubmitTab || selectedTab !== "submit"');
    expect(source).toContain(
      'router.replace(buildCreatorRoomTabUrl(pathname, searchParams, "submit")',
    );
    expect(source).toContain("onValueChange={handleCreatorRoomTabChange}");
    expect(source).toContain("onClick={() => handleCreatorRoomTabChange(roomAction.targetTab)}");
    expect(source).not.toContain("onValueChange={(value) => setActiveTab(value as CreatorRoomTab)}");
    expect(source).not.toContain("onClick={() => setActiveTab(roomAction.targetTab)}");
  });

  it("renders the tasks tab as one compact horizontal workflow rail", () => {
    const tasksTabSource = source.slice(
      source.indexOf('{/* Tasks tab */}'),
      source.indexOf('{/* Submit tab */}'),
    );

    expect(source).toContain('data-testid="creator-task-rail"');
    expect(source).toContain('data-testid="creator-task-rail-item"');
    expect(tasksTabSource).toContain("grid-cols-3");
    expect(tasksTabSource).toContain("sm:grid-cols-6");
    expect(tasksTabSource).toContain("tabular-nums");
    expect(tasksTabSource).not.toContain("space-y-1");
  });

  it("shows the creator their reporting schedule from actual report tasks", () => {
    const tasksTabSource = source.slice(
      source.indexOf('{/* Tasks tab */}'),
      source.indexOf('{/* Submit tab */}'),
    );

    expect(source).toContain("period_start: string | null");
    expect(source).toContain("period_end: string | null");
    expect(source).toContain(
      ".select(\"id, task_key, period_start, period_end, due_at, status, submitted_at, review_note\")",
    );
    expect(source).toContain("getCreatorReportTaskLabelKey");
    expect(source).toContain("getCreatorReportTaskStatusKey");
    expect(source).toContain("formatReportTaskWindow");
    expect(source).toContain('"excused",');
    expect(tasksTabSource).toContain('data-testid="creator-reporting-schedule"');
    expect(tasksTabSource).toContain('data-testid="creator-reporting-schedule-item"');
    expect(tasksTabSource).toContain("overflow-x-auto");
    expect(tasksTabSource).toContain("reportTasks.map");
    expect(source).toContain("formatReportTaskCount");
    expect(source).toContain(
      'if (status === "submitted_late") {\n    return "border-amber-200 bg-amber-50/70 text-amber-950";\n  }',
    );
    expect(stringsSource).toContain('"task.reportCountSingular": "1 read"');
    expect(stringsSource).toContain('"task.reportingSchedule": "Reporting schedule"');
    expect(stringsSource).toContain('"task.reportingScheduleDetail": "Required reads and creator-added updates."');
    expect(stringsSource).toContain('"task.reportKind.daily": "Daily read"');
    expect(stringsSource).toContain('"task.reportKind.weekly": "Key read"');
    expect(stringsSource).toContain('"task.reportKind.final": "Final report"');
    expect(stringsSource).toContain('"task.reportStatus.pending": "Pending"');
    expect(stringsSource).toContain('"task.reportStatus.needsRevision": "Correction"');
    expect(platformEnglishBundleSource).toContain('"task.reportingSchedule": "Reporting schedule"');
    expect(designSource).toContain(
      "Creator reporting schedules must be visible as real dated work.",
    );
  });

  it("lets creators add one optional extra proof read when required reads are settled", () => {
    const tasksTabSource = source.slice(
      source.indexOf('{/* Tasks tab */}'),
      source.indexOf('{/* Submit tab */}'),
    );

    expect(source).toContain("createExtraPerformanceReportTask");
    expect(source).toContain("const canAddExtraReportRead =");
    expect(source).toContain("!hasOpenReportTask");
    expect(source).toContain("function handleAddExtraReportRead");
    expect(source).toContain("setReportTasks((currentTasks) =>");
    expect(source).toContain("handleCreatorRoomTabChange(\"submit\")");
    expect(tasksTabSource).toContain('data-testid="creator-add-report-read"');
    expect(tasksTabSource).toContain("canAddExtraReportRead");
    expect(source).toContain('if (taskKey.startsWith("extra:")) return "task.reportKind.extra";');
    expect(stringsSource).toContain('"task.addReportRead": "Add read"');
    expect(stringsSource).toContain('"task.addingReportRead": "Adding"');
    expect(stringsSource).toContain('"task.addReportReadError": "Could not add read. Try again."');
    expect(stringsSource).toContain('"task.reportKind.extra": "Extra read"');
    expect(platformEnglishBundleSource).toContain('"task.addReportRead": "Add read"');
    expect(designSource).toContain(
      "Optional creator-added report reads must be explicit, compact, and attached to the existing reporting schedule.",
    );
  });

  it("turns the creator submit workspace read-only outside active campaign work stages", () => {
    expect(source).toContain("const creatorWorkIsOpen =");
    expect(source).toContain(
      '["in_progress", "publishing", "monitoring"].includes(room.status)',
    );
    expect(source).toContain("creatorWorkIsOpen && !hasOpenReportTask");
    expect(source).toContain("creatorWorkIsOpen && (");
    expect(source).toContain("creatorWorkIsOpen={creatorWorkIsOpen}");
    expect(source).toContain('data-testid="creator-work-read-only-stage"');
    expect(source).toContain("submit.readOnlyStage");
    expect(source).toContain("creatorWorkIsOpen && submission.status === \"approved\"");
    expect(source).toContain("creatorWorkIsOpen && shouldShowForm");
    expect(stringsSource).toContain('"submit.readOnlyStage"');
    expect(stringsSource).toContain(
      "This campaign is read-only; completed work and proof stay visible.",
    );
    expect(platformEnglishBundleSource).toContain(
      '"submit.readOnlyStage": "This campaign is read-only; completed work and proof stay visible."',
    );
  });

  it("presents the submit tab as one compact creator handoff workflow", () => {
    expect(source).toContain("function CampaignSubmitWorkspace");
    expect(source).toContain('data-testid="creator-submit-workspace"');
    expect(source).toContain('data-testid="creator-submit-stage-rail"');
    expect(source).toContain('data-testid="creator-handoff-row"');
    expect(source).toContain('data-testid="creator-report-status-row"');
    expect(source).toContain("submit.workflowTitle");
    expect(source).toContain("submit.stage.content");
    expect(source).toContain("submit.stage.liveUrl");
    expect(source).toContain("submit.stage.performance");
    expect(source).toContain("submit.handoffSectionTitle");
    expect(source).toContain("submit.performanceSectionTitle");
    expect(stringsSource).toContain('"submit.stage.performance": "Proof"');
    expect(source).not.toContain("<Card key={s.id}>");
  });

  it("marks the submit handoff as proof-first when performance evidence is waiting", () => {
    const submitWorkspaceSource = source.slice(
      source.indexOf("function CampaignSubmitWorkspace"),
      source.indexOf("function PublishUrlForm"),
    );

    expect(submitWorkspaceSource).toContain(
      'data-testid="creator-submit-stage-item"',
    );
    expect(submitWorkspaceSource).toContain(
      'aria-current={stage.active ? "step" : undefined}',
    );
    expect(submitWorkspaceSource).toContain("data-stage-state={");
    expect(submitWorkspaceSource).toContain(
      "submit.stage.performance.proofFirst",
    );
    expect(submitWorkspaceSource).toContain(
      "submissionsNeedingPerformanceProof.length",
    );
    expect(stringsSource).toContain(
      '"submit.stage.performance.proofFirst"',
    );
  });

  it("keeps content, live URL, and proof in one handoff row per submission", () => {
    const submitWorkspaceSource = source.slice(
      source.indexOf("function CampaignSubmitWorkspace"),
      source.indexOf("function PublishUrlForm"),
    );

    expect(submitWorkspaceSource).toContain(
      'data-testid="creator-handoff-list"',
    );
    expect(submitWorkspaceSource).toContain(
      'data-testid="creator-handoff-row"',
    );
    expect(submitWorkspaceSource).toContain(
      'data-testid="creator-handoff-status-grid"',
    );
    expect(submitWorkspaceSource).toContain("submit.handoffSectionTitle");
    expect(submitWorkspaceSource).toContain("submit.handoffSectionDetail");
    expect(submitWorkspaceSource).toContain("submit.handoff.content");
    expect(submitWorkspaceSource).toContain("submit.handoff.liveUrl");
    expect(submitWorkspaceSource).toContain("submit.handoff.proof");
    expect(submitWorkspaceSource).not.toContain(
      'data-testid="creator-content-card-grid"',
    );
    expect(submitWorkspaceSource).not.toContain(
      'data-testid="creator-performance-proof-grid"',
    );
    expect(stringsSource).toContain('"submit.handoffSectionTitle": "Submission handoff"');
    expect(stringsSource).toContain('"submit.handoffSectionDetail"');
    expect(stringsSource).toContain(
      '"Each post moves through draft, live URL, and proof."',
    );
    expect(designSource).toContain(
      "Each submitted post should show draft, live URL, and proof in one row.",
    );
  });

  it("shows accepted creators the Creative Kit inside the campaign room", () => {
    expect(source).toContain("campaign_assets");
    expect(source).toContain("mapCampaignAssetRow");
    expect(source).toContain("createSignedUrls");
    expect(source).toContain("acceptedCreatorAssets");
    expect(source).toContain('asset.visibility === "public" || asset.visibility === "member"');
    expect(source).toContain('data-testid="creator-room-creative-kit"');
    expect(source).toContain('data-testid="creator-room-creative-kit-asset"');
  });

  it("keeps accepted-room Creative Kit assets compact and branded", () => {
    const creativeKitSource = source.slice(
      source.indexOf('data-testid="creator-room-creative-kit"'),
      source.indexOf('data-testid="creator-handoff-list"'),
    );

    expect(creativeKitSource).toContain(
      'data-testid="creator-room-creative-kit-asset"',
    );
    expect(creativeKitSource).toContain("relative size-14");
    expect(creativeKitSource).toContain("bg-slate-950");
    expect(creativeKitSource).toContain("radial-gradient");
    expect(creativeKitSource).toContain('loading="eager"');
    expect(creativeKitSource).toContain("brandInitials(room.brand_name)");
    expect(creativeKitSource).toContain("PLATFORM_LABELS[room.platforms[0]]");
    expect(creativeKitSource).not.toContain("rounded-lg bg-muted text-muted-foreground");
    expect(designSource).toContain(
      "Accepted creator Creative Kit assets must match the public preview quality bar.",
    );
  });

  it("keeps draft review links distinct from live platform post URLs", () => {
    expect(contentSubmitFormSource).toContain("submit.contentLink");
    expect(contentSubmitFormSource).toContain("submit.contentLinkPlaceholder");
    expect(contentSubmitFormSource).toContain("submit.contentLinkHelp");
    expect(contentSubmitFormSource).toContain("submit.submitDraft");
    expect(contentSubmitFormSource).toContain("new URL(contentLink.trim())");
    expect(contentSubmitFormSource).not.toContain("PLATFORM_URL_PATTERNS");
    expect(contentSubmitFormSource).not.toContain("published post");
    expect(contentSubmitFormSource).not.toContain("Submit for Review");

    expect(source).toContain("getPlatformPostUrlExample");
    expect(source).toContain("isPlatformPostUrl");
    expect(source).toContain("platform={submission.platform}");
    expect(source).toContain("labels.invalid");
    expect(source).toContain("submit.publishedUrlInvalid");
    expect(platformUrlSource).toContain("isPlatformPostUrl");
    expect(stringsSource).toContain('"next.publishUrl.title": "Publish approved post"');
    expect(stringsSource).toContain(
      '"Post the approved content on the platform, then paste the live URL here."',
    );
    expect(stringsSource).toContain(
      '"Approved. Publish this content, then paste the live post URL below."',
    );
    expect(stringsSource).toContain('"submit.stage.liveUrl.active": "Publish next"');
    expect(stringsSource).toContain('"submit.handoff.liveNeeded": "Publish next"');
    expect(source).toContain("hasLiveUrlWork");
    expect(designSource).toContain(
      "Approved-content live URL states must name the real sequence",
    );
  });

  it("hides proof instructions after the report task is already submitted", () => {
    expect(source).toContain("const reportIsComplete =");
    expect(source).toContain("!correctionReportTask && !reportIsComplete");
  });

  it("uses direct evidence upload instead of asking creators for image-host URLs", () => {
    expect(performanceFormSource).toContain("createPerformanceEvidenceUpload");
    expect(performanceFormSource).toContain("analyzePerformanceEvidence");
    expect(performanceFormSource).toContain(".storage.from(evidenceUpload.bucket)");
    expect(performanceFormSource).toContain(".upload(evidenceUpload.storagePath");
    expect(performanceFormSource).toContain("type=\"file\"");
    expect(performanceFormSource).not.toContain("type=\"url\"");
    expect(performanceFormSource).not.toContain("paste the URL");
  });

  it("renders dense performance metrics as a compact grid, not a vertical questionnaire", () => {
    expect(performanceFormSource).toContain(
      'data-testid="performance-metric-grid"',
    );
    expect(performanceFormSource).toContain("grid-cols-2");
    expect(performanceFormSource).toContain("sm:grid-cols-4");
    expect(performanceFormSource).toContain(
      'placeholder={field.type === "text" ? "" : "0"}',
    );
    expect(performanceFormSource).toContain("aria-label={field.label}");
    expect(performanceFormSource).not.toContain("placeholder={field.description}");
  });

  it("uses budget-style numeric controls for performance metric entry", () => {
    expect(performanceFormSource).toContain(
      'data-testid="performance-metric-input-card"',
    );
    expect(performanceFormSource).toContain(
      'data-testid="performance-metric-input-control"',
    );
    expect(performanceFormSource).toContain("focus-within:ring-2");
    expect(performanceFormSource).toContain("tabular-nums");
    expect(performanceFormSource).toContain("text-end");
    expect(performanceFormSource).toContain("[appearance:textfield]");
  });

  it("uses Chrome-friendly numeric text fields for performance metric entry", () => {
    const metricGridSource = performanceFormSource.slice(
      performanceFormSource.indexOf('data-testid="performance-metric-grid"'),
      performanceFormSource.indexOf("{/* Error */}"),
    );

    expect(metricGridSource).toContain('type="text"');
    expect(metricGridSource).toContain(
      'inputMode={field.type === "text" ? "text" : "decimal"}',
    );
    expect(metricGridSource).toContain("updateValue(field, e.target.value)");
    expect(performanceFormSource).toContain("function sanitizeMetricInput");
    expect(metricGridSource).not.toContain('type="number"');
  });

  it("makes creator reporting proof-first, then metric validation", () => {
    const evidenceIndex = performanceFormSource.indexOf(
      'data-testid="performance-evidence-block"',
    );
    const metricIndex = performanceFormSource.indexOf(
      'data-testid="performance-metric-grid"',
    );
    const proofRequiredIndex = performanceFormSource.indexOf(
      'setError(t("error.proofRequired"))',
    );
    const requiredFieldsIndex = performanceFormSource.indexOf(
      'setError(t("error.requiredFields"',
    );

    expect(evidenceIndex).toBeGreaterThan(-1);
    expect(metricIndex).toBeGreaterThan(-1);
    expect(evidenceIndex).toBeLessThan(metricIndex);
    expect(proofRequiredIndex).toBeGreaterThan(-1);
    expect(requiredFieldsIndex).toBeGreaterThan(-1);
    expect(proofRequiredIndex).toBeLessThan(requiredFieldsIndex);
    expect(performanceFormSource).toContain(
      'data-testid="performance-reporting-steps"',
    );
    expect(performanceFormSource).toContain(
      't("proof.title")',
    );
    expect(stringsSource).toContain('"proof.title": "Platform analytics proof"');
    expect(stringsSource).toContain('"proof.chooseFile": "Upload screenshot or export"');
    expect(stringsSource).toContain('"steps.proof": "Upload proof"');
    expect(stringsSource).toContain('"steps.metrics": "Confirm numbers"');
    expect(stringsSource).toContain('"steps.submit": "Send to brand"');
    expect(stringsSource).toContain(
      '"submit.stage.performance.proofFirst": "Upload proof"',
    );
    expect(stringsSource).toContain('"metrics.title": "Confirm numbers"');
    expect(stringsSource).toContain('"action.submitReport": "Send {report} proof"');
    expect(platformEnglishBundleSource).toContain(
      '"proof.chooseFile": "Upload screenshot or export"',
    );
    expect(performanceFormSource).toContain(
      't("metrics.title")',
    );
    expect(performanceFormSource).toContain(
      't("action.submitReport"',
    );
    expect(performanceFormSource).not.toContain("Analytics Evidence");
    expect(performanceFormSource).not.toContain("Choose analytics file");
    expect(performanceFormSource).not.toContain("Upload analytics evidence first");
  });

  it("keeps AI extracted metrics confirmable when the creator submits", () => {
    expect(performanceFormSource).toContain("const [aiExtractionId, setAiExtractionId]");
    expect(performanceFormSource).toContain("setAiExtractionId(extraction.extractionId)");
    expect(performanceFormSource).toContain("ai_extraction_id: aiExtractionId");
    expect(performanceFormSource).toContain("const aiExtractionEdited =");
    expect(performanceFormSource).toContain("ai_extraction_edited: aiExtractionEdited");
    expect(performanceFormSource).toContain("setAiExtractionId(null)");
  });

  it("shows creators which metric values came from AI before they confirm", () => {
    expect(performanceFormSource).toContain("const [metricSourceByKey, setMetricSourceByKey]");
    expect(performanceFormSource).toContain('source: "ai"');
    expect(performanceFormSource).toContain('source: "manual"');
    expect(performanceFormSource).toContain('data-testid="performance-ai-confirmation"');
    expect(performanceFormSource).toContain('data-testid="performance-metric-source"');
    expect(performanceFormSource).toContain("metrics.confirmation.aiTitle");
    expect(performanceFormSource).toContain("metrics.confirmation.aiDetail");
    expect(performanceFormSource).toContain("metrics.confirmation.manualTitle");
    expect(performanceFormSource).toContain("metrics.source.ai");
    expect(performanceFormSource).toContain("metrics.source.manual");
    expect(performanceFormSource).toContain("const nextValues: Record<string, string>");
    expect(performanceFormSource).toContain("setValues(nextValues)");
    expect(stringsSource).toContain(
      '"metrics.confirmation.aiTitle": "Review AI suggestions"',
    );
    expect(platformEnglishBundleSource).toContain(
      '"metrics.confirmation.aiTitle": "Review AI suggestions"',
    );
  });

  it("exposes a stable submitted-report marker for smoke tests", () => {
    expect(performanceFormSource).toContain(
      'data-testid="performance-report-submitted"',
    );
  });

  it("documents proof-first reporting as a design rule", () => {
    expect(designSource).toContain("Creator reporting is proof-first");
    expect(designSource).toContain("source proof, metric validation, submit");
  });

  it("documents compact metric entry as a design rule", () => {
    expect(designSource).toContain("Dense numeric metric entry");
    expect(designSource).toContain("Do not stack each metric as a full-width field");
    expect(designSource).toContain("Numeric metric inputs must look editable");
    expect(designSource).toContain("the budget investment controls");
  });

  it("documents creator handoff rooms as one compact sequence", () => {
    expect(designSource).toContain("Creator campaign rooms should show handoff work");
    expect(designSource).toContain("one compact sequence");
    expect(designSource).toContain("Do not stack disconnected cards");
  });

  it("documents the draft versus live URL split", () => {
    expect(designSource).toContain("Draft content links and live post URLs are distinct");
    expect(designSource).toContain("Do not ask for a public platform post URL before approval");
  });
});

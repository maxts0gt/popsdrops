"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import {
  ArrowLeft,
  ArrowRight,
  Check,
  Sparkles,
  Gift,
  Megaphone,
  Target,
  Repeat,
  Zap,
  Plus,
  Trash2,
  Loader2,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Separator } from "@/components/ui/separator";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  PLATFORM_LABELS,
  MARKETS,
  NICHES,
  CONTENT_FORMATS,
  NICHE_KEYS,
  FORMAT_KEYS,
  getMarketLabel,
  formatBudgetRange,
} from "@/lib/constants";
import { useTranslation } from "@/lib/i18n";
import { useI18n } from "@/lib/i18n/context";
import { createCampaign, publishCampaign } from "@/app/actions/campaigns";
import { toast } from "sonner";
import type { Platform, Niche, ContentFormat, Market } from "@/lib/constants";

// ---------------------------------------------------------------------------
// Playbook config (icons + defaults only — labels resolved via t())
// ---------------------------------------------------------------------------

const playbooks = [
  {
    id: "product-seeding",
    titleKey: "playbook.productSeeding",
    descKey: "playbook.productSeeding.desc",
    icon: Gift,
    color: "bg-slate-100 text-slate-600",
    defaults: {
      platforms: ["tiktok", "instagram"] as Platform[],
      formats: ["short_video", "story"] as ContentFormat[],
      creatorsCount: 5,
      maxRevisions: 1,
    },
  },
  {
    id: "brand-awareness",
    titleKey: "playbook.brandAwareness",
    descKey: "playbook.brandAwareness.desc",
    icon: Megaphone,
    color: "bg-slate-100 text-slate-600",
    defaults: {
      platforms: ["tiktok", "instagram", "snapchat"] as Platform[],
      formats: ["short_video", "reel"] as ContentFormat[],
      creatorsCount: 10,
      maxRevisions: 2,
    },
  },
  {
    id: "conversion",
    titleKey: "playbook.conversion",
    descKey: "playbook.conversion.desc",
    icon: Target,
    color: "bg-slate-100 text-slate-600",
    defaults: {
      platforms: ["instagram", "youtube"] as Platform[],
      formats: ["short_video", "carousel"] as ContentFormat[],
      creatorsCount: 8,
      maxRevisions: 2,
    },
  },
  {
    id: "ugc",
    titleKey: "playbook.ugc",
    descKey: "playbook.ugc.desc",
    icon: Repeat,
    color: "bg-slate-100 text-slate-600",
    defaults: {
      platforms: ["tiktok"] as Platform[],
      formats: ["short_video"] as ContentFormat[],
      creatorsCount: 15,
      maxRevisions: 3,
    },
  },
  {
    id: "event-launch",
    titleKey: "playbook.eventLaunch",
    descKey: "playbook.eventLaunch.desc",
    icon: Zap,
    color: "bg-slate-100 text-slate-600",
    defaults: {
      platforms: ["tiktok", "instagram", "snapchat"] as Platform[],
      formats: ["short_video", "story", "live"] as ContentFormat[],
      creatorsCount: 12,
      maxRevisions: 1,
    },
  },
];

const STEP_KEYS = [
  "step.playbook",
  "step.basics",
  "step.brief",
  "step.budgetTimeline",
  "step.settings",
  "step.reviewPublish",
] as const;

// ---------------------------------------------------------------------------
// Usage rights config (labels resolved via t())
// ---------------------------------------------------------------------------

const usageRightsOptions = [
  { value: "brand_channels", labelKey: "usage.brandChannels", descKey: "usage.brandChannels.desc" },
  { value: "paid_ads", labelKey: "usage.paidAds", descKey: "usage.paidAds.desc" },
  { value: "full_rights", labelKey: "usage.fullRights", descKey: "usage.fullRights.desc" },
] as const;

// ---------------------------------------------------------------------------
// MultiSelect
// ---------------------------------------------------------------------------

function MultiSelect({
  options,
  selected,
  onChange,
}: {
  options: Record<string, string>;
  selected: string[];
  onChange: (val: string[]) => void;
}) {
  return (
    <div className="flex flex-wrap gap-2">
      {Object.entries(options).map(([key, label]) => {
        const isSelected = selected.includes(key);
        return (
          <button
            key={key}
            type="button"
            onClick={() =>
              onChange(isSelected ? selected.filter((s) => s !== key) : [...selected, key])
            }
            className={`rounded-lg border px-3 py-1.5 text-sm transition-colors ${
              isSelected
                ? "border-slate-900 bg-slate-900 font-medium text-white"
                : "border-slate-200 text-slate-600 hover:border-slate-300 hover:bg-slate-50"
            }`}
          >
            {label}
          </button>
        );
      })}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export default function CreateCampaignPage() {
  const { t } = useTranslation("brand.newCampaign");
  const { locale, t: tc } = useI18n();
  const router = useRouter();

  // Build locale-aware label maps
  const marketLabels = Object.fromEntries(
    MARKETS.map((m) => [m, getMarketLabel(m, locale)])
  );
  const nicheLabels = Object.fromEntries(
    NICHES.map((n) => [n, tc("ui.common", NICHE_KEYS[n])])
  );
  const formatLabels = Object.fromEntries(
    CONTENT_FORMATS.map((f) => [f, tc("ui.common", FORMAT_KEYS[f])])
  );
  const [step, setStep] = useState(0);
  const [selectedPlaybook, setSelectedPlaybook] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});

  // Form state
  const [title, setTitle] = useState("");
  const [platforms, setPlatforms] = useState<string[]>([]);
  const [markets, setMarkets] = useState<string[]>([]);
  const [niches, setNiches] = useState<string[]>([]);
  const [description, setDescription] = useState("");
  const [requirements, setRequirements] = useState("");
  const [dos, setDos] = useState("");
  const [donts, setDonts] = useState("");
  const [deliverables, setDeliverables] = useState<{ format: string; quantity: number }[]>([
    { format: "short_video", quantity: 1 },
  ]);
  const [budgetMin, setBudgetMin] = useState("");
  const [budgetMax, setBudgetMax] = useState("");
  const [creatorsCount, setCreatorsCount] = useState("5");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [contentDeadline, setContentDeadline] = useState("");
  const [applicationDeadline, setApplicationDeadline] = useState("");
  const [usageRights, setUsageRights] = useState("brand_channels");
  const [maxRevisions, setMaxRevisions] = useState("2");
  const [complianceNotes, setComplianceNotes] = useState("");

  // Step validation
  function validateStep(s: number): boolean {
    const errs: Record<string, string> = {};
    if (s === 1) {
      if (!title.trim()) errs.title = t("error.titleRequired");
      if (platforms.length === 0) errs.platforms = t("error.platformRequired");
      if (markets.length === 0) errs.markets = t("error.marketRequired");
    }
    if (s === 2) {
      if (!description.trim()) errs.description = t("error.descriptionRequired");
    }
    if (s === 3) {
      if (!budgetMin || !budgetMax) errs.budget = t("error.budgetRequired");
      if (!startDate || !endDate) errs.dates = t("error.dateRequired");
    }
    setErrors(errs);
    return Object.keys(errs).length === 0;
  }

  function goNext() {
    if (validateStep(step)) setStep(step + 1);
  }

  function buildCampaignInput() {
    return {
      title: title.trim(),
      brief_description: description.trim(),
      brief_requirements: requirements.trim() || undefined,
      brief_dos: dos.trim() || undefined,
      brief_donts: donts.trim() || undefined,
      platforms,
      markets,
      niches,
      budget_min: Number(budgetMin) || 0,
      budget_max: Number(budgetMax) || 0,
      max_creators: Number(creatorsCount) || 5,
      application_deadline: applicationDeadline || contentDeadline || endDate,
      content_due_date: contentDeadline || endDate,
      posting_window_start: startDate || undefined,
      posting_window_end: endDate || undefined,
      usage_rights_duration: usageRights,
      usage_rights_territory: "worldwide",
      usage_rights_paid_ads: usageRights === "paid_ads" || usageRights === "full_rights",
      max_revisions: Number(maxRevisions) || 2,
      playbook_id: selectedPlaybook || undefined,
      deliverables: deliverables.map((d) => ({
        platform: platforms[0] || "tiktok",
        content_type: d.format,
        quantity: d.quantity,
      })),
    };
  }

  async function handleSaveDraft() {
    if (!title.trim()) {
      setErrors({ title: t("error.titleRequired") });
      setStep(1);
      return;
    }
    setSubmitting(true);
    try {
      const { id } = await createCampaign(buildCampaignInput());
      toast.success(t("success.saved"));
      router.push(`/b/campaigns/${id}`);
    } catch {
      toast.error(t("error.failed"));
    } finally {
      setSubmitting(false);
    }
  }

  async function handlePublish() {
    // Validate all steps
    for (let s = 1; s <= 3; s++) {
      if (!validateStep(s)) {
        setStep(s);
        return;
      }
    }
    setSubmitting(true);
    try {
      const { id } = await createCampaign(buildCampaignInput());
      await publishCampaign(id);
      toast.success(t("success.published"));
      router.push(`/b/campaigns/${id}`);
    } catch {
      toast.error(t("error.failed"));
    } finally {
      setSubmitting(false);
    }
  }

  function selectPlaybook(id: string | null) {
    setSelectedPlaybook(id);
    if (id) {
      const pb = playbooks.find((p) => p.id === id);
      if (pb) {
        setPlatforms(pb.defaults.platforms);
        setCreatorsCount(String(pb.defaults.creatorsCount));
        setMaxRevisions(String(pb.defaults.maxRevisions));
        setDeliverables(pb.defaults.formats.map((f) => ({ format: f, quantity: 1 })));
      }
    }
    setStep(1);
  }

  function addDeliverable() {
    setDeliverables([...deliverables, { format: "short_video", quantity: 1 }]);
  }

  function removeDeliverable(index: number) {
    setDeliverables(deliverables.filter((_, i) => i !== index));
  }

  // Resolve playbook title for review step
  const selectedPbTitle = selectedPlaybook
    ? t(playbooks.find((p) => p.id === selectedPlaybook)?.titleKey || "review.custom")
    : t("review.custom");

  return (
    <div className="mx-auto max-w-3xl px-4 py-6 sm:px-6 lg:px-8">
      {/* Header */}
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-slate-900">{t("title")}</h1>
        <p className="text-sm text-slate-500">
          {step === 0
            ? t("playbook.choose")
            : t("step.of", { step: String(step), total: String(STEP_KEYS.length - 1) })}
        </p>
      </div>

      {/* Progress bar */}
      {step > 0 && (
        <div className="mb-8">
          <div className="mb-2 flex justify-between text-xs text-slate-500">
            {STEP_KEYS.slice(1).map((key, i) => (
              <span key={key} className={i + 1 <= step ? "font-medium text-slate-900" : ""}>
                {t(key)}
              </span>
            ))}
          </div>
          <div className="h-1.5 w-full rounded-full bg-slate-100">
            <div
              className="h-1.5 rounded-full bg-slate-900 transition-all"
              style={{ width: `${(step / (STEP_KEYS.length - 1)) * 100}%` }}
            />
          </div>
        </div>
      )}

      {/* Step 0: Playbook Selection */}
      {step === 0 && (
        <div className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            {playbooks.map((pb) => (
              <button
                key={pb.id}
                onClick={() => selectPlaybook(pb.id)}
                className={`rounded-xl border-2 p-4 text-start transition-all hover:shadow-md ${
                  selectedPlaybook === pb.id
                    ? "border-slate-900 bg-slate-50"
                    : "border-slate-200 hover:border-slate-300"
                }`}
              >
                <div className={`mb-3 inline-flex size-10 items-center justify-center rounded-lg ${pb.color}`}>
                  <pb.icon className="size-5" />
                </div>
                <h3 className="mb-1 font-medium text-slate-900">{t(pb.titleKey)}</h3>
                <p className="text-sm text-slate-500">{t(pb.descKey)}</p>
              </button>
            ))}
            <button
              onClick={() => selectPlaybook(null)}
              className="rounded-xl border-2 border-dashed border-slate-300 p-4 text-start transition-all hover:border-slate-400 hover:bg-slate-50"
            >
              <div className="mb-3 inline-flex size-10 items-center justify-center rounded-lg bg-slate-100 text-slate-500">
                <Sparkles className="size-5" />
              </div>
              <h3 className="mb-1 font-medium text-slate-900">{t("playbook.scratch")}</h3>
              <p className="text-sm text-slate-500">{t("playbook.scratch.desc")}</p>
            </button>
          </div>
        </div>
      )}

      {/* Step 1: Basics */}
      {step === 1 && (
        <Card>
          <CardHeader>
            <CardTitle>{t("step.basics")}</CardTitle>
          </CardHeader>
          <CardContent className="space-y-6">
            <div>
              <Label htmlFor="title">{t("field.name")}</Label>
              <Input
                id="title"
                placeholder={t("field.name.placeholder")}
                value={title}
                onChange={(e) => { setTitle(e.target.value); setErrors((prev) => { const { title: _, ...rest } = prev; return rest; }); }}
                className={`mt-1.5 ${errors.title ? "border-red-500" : ""}`}
              />
              {errors.title && <p className="mt-1 text-xs text-red-500">{errors.title}</p>}
            </div>
            <div>
              <Label>{t("field.platforms")}</Label>
              <div className="mt-1.5">
                <MultiSelect
                  options={PLATFORM_LABELS}
                  selected={platforms}
                  onChange={(v) => { setPlatforms(v); setErrors((prev) => { const { platforms: _, ...rest } = prev; return rest; }); }}
                />
              </div>
              {errors.platforms && <p className="mt-1 text-xs text-red-500">{errors.platforms}</p>}
            </div>
            <div>
              <Label>{t("field.markets")}</Label>
              <div className="mt-1.5">
                <MultiSelect
                  options={marketLabels}
                  selected={markets}
                  onChange={(v) => { setMarkets(v); setErrors((prev) => { const { markets: _, ...rest } = prev; return rest; }); }}
                />
              </div>
              {errors.markets && <p className="mt-1 text-xs text-red-500">{errors.markets}</p>}
            </div>
            <div>
              <Label>{t("field.niches")}</Label>
              <div className="mt-1.5">
                <MultiSelect
                  options={nicheLabels}
                  selected={niches}
                  onChange={setNiches}
                />
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Step 2: Brief */}
      {step === 2 && (
        <Card>
          <CardHeader>
            <CardTitle>{t("step.brief")}</CardTitle>
          </CardHeader>
          <CardContent className="space-y-6">
            <div>
              <Label htmlFor="description">{t("field.briefDescription")}</Label>
              <Textarea
                id="description"
                rows={4}
                placeholder={t("field.briefDescription.placeholder")}
                value={description}
                onChange={(e) => { setDescription(e.target.value); setErrors((prev) => { const { description: _, ...rest } = prev; return rest; }); }}
                className={`mt-1.5 ${errors.description ? "border-red-500" : ""}`}
              />
              {errors.description && <p className="mt-1 text-xs text-red-500">{errors.description}</p>}
            </div>
            <div>
              <Label htmlFor="requirements">{t("field.briefRequirements")}</Label>
              <Textarea
                id="requirements"
                rows={3}
                placeholder={t("field.briefRequirements.placeholder")}
                value={requirements}
                onChange={(e) => setRequirements(e.target.value)}
                className="mt-1.5"
              />
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <Label htmlFor="dos">{t("field.dos")}</Label>
                <Textarea
                  id="dos"
                  rows={3}
                  placeholder={t("field.briefDos.placeholder")}
                  value={dos}
                  onChange={(e) => setDos(e.target.value)}
                  className="mt-1.5"
                />
              </div>
              <div>
                <Label htmlFor="donts">{t("field.donts")}</Label>
                <Textarea
                  id="donts"
                  rows={3}
                  placeholder={t("field.briefDonts.placeholder")}
                  value={donts}
                  onChange={(e) => setDonts(e.target.value)}
                  className="mt-1.5"
                />
              </div>
            </div>
            <Separator />
            <div>
              <div className="mb-3 flex items-center justify-between">
                <Label>{t("label.deliverables")}</Label>
                <Button variant="outline" size="sm" onClick={addDeliverable}>
                  <Plus className="size-3.5" /> {t("action.add")}
                </Button>
              </div>
              <div className="space-y-3">
                {deliverables.map((d, i) => (
                  <div key={i} className="flex items-center gap-3">
                    <Select
                      value={d.format}
                      onValueChange={(v) => {
                        if (!v) return;
                        const updated = [...deliverables];
                        updated[i] = { ...updated[i], format: v };
                        setDeliverables(updated);
                      }}
                    >
                      <SelectTrigger className="h-9 flex-1">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {Object.entries(formatLabels).map(([key, label]) => (
                          <SelectItem key={key} value={key}>{label}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <Input
                      type="number"
                      min={1}
                      value={d.quantity}
                      onChange={(e) => {
                        const updated = [...deliverables];
                        updated[i] = { ...updated[i], quantity: Number(e.target.value) };
                        setDeliverables(updated);
                      }}
                      className="w-20"
                    />
                    <span className="text-xs text-slate-500">{t("label.perCreator")}</span>
                    {deliverables.length > 1 && (
                      <Button variant="ghost" size="icon-sm" onClick={() => removeDeliverable(i)}>
                        <Trash2 className="size-3.5 text-slate-400" />
                      </Button>
                    )}
                  </div>
                ))}
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Step 3: Budget & Timeline */}
      {step === 3 && (
        <Card>
          <CardHeader>
            <CardTitle>{t("step.budgetTimeline")}</CardTitle>
          </CardHeader>
          <CardContent className="space-y-6">
            <div>
              <Label>{t("field.budgetRange")}</Label>
              <div className="mt-1.5 flex items-center gap-3">
                <Input
                  type="number"
                  placeholder={t("field.budgetMin")}
                  value={budgetMin}
                  onChange={(e) => setBudgetMin(e.target.value)}
                />
                <span className="text-slate-400">{t("field.budgetRange.to")}</span>
                <Input
                  type="number"
                  placeholder={t("field.budgetMax")}
                  value={budgetMax}
                  onChange={(e) => setBudgetMax(e.target.value)}
                />
              </div>
            </div>
            <div>
              <Label htmlFor="creatorsCount">{t("field.creatorsCount")}</Label>
              <Input
                id="creatorsCount"
                type="number"
                min={1}
                value={creatorsCount}
                onChange={(e) => setCreatorsCount(e.target.value)}
                className="mt-1.5 w-32"
              />
            </div>
            <Separator />
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              <div>
                <Label htmlFor="startDate">{t("field.campaignStart")}</Label>
                <Input
                  id="startDate"
                  type="date"
                  value={startDate}
                  onChange={(e) => { setStartDate(e.target.value); setErrors((prev) => { const { dates: _, ...rest } = prev; return rest; }); }}
                  className="mt-1.5"
                />
              </div>
              <div>
                <Label htmlFor="applicationDeadline">{t("field.applicationDeadline")}</Label>
                <Input
                  id="applicationDeadline"
                  type="date"
                  value={applicationDeadline}
                  onChange={(e) => setApplicationDeadline(e.target.value)}
                  className="mt-1.5"
                />
              </div>
              <div>
                <Label htmlFor="contentDeadline">{t("field.contentDeadline")}</Label>
                <Input
                  id="contentDeadline"
                  type="date"
                  value={contentDeadline}
                  onChange={(e) => setContentDeadline(e.target.value)}
                  className="mt-1.5"
                />
              </div>
              <div>
                <Label htmlFor="endDate">{t("field.campaignEnd")}</Label>
                <Input
                  id="endDate"
                  type="date"
                  value={endDate}
                  onChange={(e) => { setEndDate(e.target.value); setErrors((prev) => { const { dates: _, ...rest } = prev; return rest; }); }}
                  className="mt-1.5"
                />
              </div>
            </div>
            {errors.dates && <p className="mt-1 text-xs text-red-500">{errors.dates}</p>}
            {errors.budget && <p className="mt-1 text-xs text-red-500">{errors.budget}</p>}
          </CardContent>
        </Card>
      )}

      {/* Step 4: Settings */}
      {step === 4 && (
        <Card>
          <CardHeader>
            <CardTitle>{t("step.settings")}</CardTitle>
          </CardHeader>
          <CardContent className="space-y-6">
            <div>
              <Label>{t("field.usageRights")}</Label>
              <div className="mt-2 space-y-2">
                {usageRightsOptions.map((opt) => (
                  <label
                    key={opt.value}
                    className={`flex cursor-pointer items-start gap-3 rounded-lg border p-3 transition-colors ${
                      usageRights === opt.value
                        ? "border-slate-900 bg-slate-50"
                        : "border-slate-200 hover:bg-slate-50"
                    }`}
                  >
                    <input
                      type="radio"
                      name="usageRights"
                      value={opt.value}
                      checked={usageRights === opt.value}
                      onChange={(e) => setUsageRights(e.target.value)}
                      className="mt-0.5 accent-slate-900"
                    />
                    <div>
                      <p className="text-sm font-medium text-slate-900">{t(opt.labelKey)}</p>
                      <p className="text-xs text-slate-500">{t(opt.descKey)}</p>
                    </div>
                  </label>
                ))}
              </div>
            </div>
            <div>
              <Label htmlFor="maxRevisions">{t("field.maxRevisions")}</Label>
              <Input
                id="maxRevisions"
                type="number"
                min={0}
                max={5}
                value={maxRevisions}
                onChange={(e) => setMaxRevisions(e.target.value)}
                className="mt-1.5 w-32"
              />
              <p className="mt-1 text-xs text-slate-500">{t("field.maxRevisions.hint")}</p>
            </div>
            <div>
              <Label htmlFor="complianceNotes">{t("field.complianceNotes")}</Label>
              <Textarea
                id="complianceNotes"
                rows={3}
                placeholder={t("field.complianceNotes.placeholder")}
                value={complianceNotes}
                onChange={(e) => setComplianceNotes(e.target.value)}
                className="mt-1.5"
              />
            </div>
          </CardContent>
        </Card>
      )}

      {/* Step 5: Review & Publish */}
      {step === 5 && (
        <Card>
          <CardHeader>
            <CardTitle>{t("step.reviewPublish")}</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="rounded-lg bg-slate-50 p-4">
              <h3 className="mb-3 font-medium text-slate-900">{t("review.summary")}</h3>
              <dl className="space-y-2 text-sm">
                <div className="flex justify-between">
                  <dt className="text-slate-500">{t("review.label.title")}</dt>
                  <dd className="font-medium text-slate-900">{title || t("review.untitled")}</dd>
                </div>
                <div className="flex justify-between">
                  <dt className="text-slate-500">{t("review.label.playbook")}</dt>
                  <dd className="text-slate-700">{selectedPbTitle}</dd>
                </div>
                <div className="flex justify-between">
                  <dt className="text-slate-500">{t("review.label.platforms")}</dt>
                  <dd className="text-slate-700">
                    {platforms.map((p) => PLATFORM_LABELS[p as Platform]).join(", ") || t("review.none")}
                  </dd>
                </div>
                <div className="flex justify-between">
                  <dt className="text-slate-500">{t("review.label.markets")}</dt>
                  <dd className="text-slate-700">
                    {markets.map((m) => marketLabels[m as Market]).join(", ") || t("review.none")}
                  </dd>
                </div>
                <div className="flex justify-between">
                  <dt className="text-slate-500">{t("review.label.niches")}</dt>
                  <dd className="text-slate-700">
                    {niches.map((n) => nicheLabels[n as Niche]).join(", ") || t("review.none")}
                  </dd>
                </div>
                <Separator />
                <div className="flex justify-between">
                  <dt className="text-slate-500">{t("review.label.budget")}</dt>
                  <dd className="text-slate-700">{formatBudgetRange(Number(budgetMin) || 0, Number(budgetMax) || 0, locale)}</dd>
                </div>
                <div className="flex justify-between">
                  <dt className="text-slate-500">{t("review.label.creators")}</dt>
                  <dd className="text-slate-700">{creatorsCount}</dd>
                </div>
                <div className="flex justify-between">
                  <dt className="text-slate-500">{t("review.label.deliverables")}</dt>
                  <dd className="text-slate-700">
                    {deliverables.map((d) => `${d.quantity}x ${formatLabels[d.format as ContentFormat]}`).join(", ")}
                  </dd>
                </div>
                <div className="flex justify-between">
                  <dt className="text-slate-500">{t("review.label.timeline")}</dt>
                  <dd className="text-slate-700">
                    {startDate || t("review.tbd")} — {endDate || t("review.tbd")}
                  </dd>
                </div>
                <div className="flex justify-between">
                  <dt className="text-slate-500">{t("review.label.maxRevisions")}</dt>
                  <dd className="text-slate-700">{maxRevisions}</dd>
                </div>
              </dl>
            </div>
            <div className="rounded-lg border border-amber-200 bg-amber-50 p-3">
              <p className="text-sm text-amber-800">{t("review.publishWarning")}</p>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Navigation */}
      {step > 0 && (
        <div className="mt-6 flex items-center justify-between">
          <Button
            variant="outline"
            onClick={() => setStep(step - 1)}
          >
            <ArrowLeft className="size-4 rtl:rotate-180" />
            {step === 1 ? t("action.backToPlaybooks") : t("action.back")}
          </Button>
          {step < 5 ? (
            <Button onClick={goNext}>
              {t("action.next")}
              <ArrowRight className="size-4 rtl:rotate-180" />
            </Button>
          ) : (
            <div className="flex gap-3">
              <Button variant="outline" onClick={handleSaveDraft} disabled={submitting}>
                {submitting && <Loader2 className="size-4 animate-spin" />}
                {t("action.saveDraft")}
              </Button>
              <Button onClick={handlePublish} disabled={submitting}>
                {submitting ? (
                  <Loader2 className="size-4 animate-spin" />
                ) : (
                  <Check className="size-4" />
                )}
                {t("action.publish")}
              </Button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

"use client";

import { useState, useEffect, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  Building2,
  Globe,
  Mail,
  LogOut,
  Loader2,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { Badge } from "@/components/ui/badge";
import { MARKET_LABELS, INDUSTRY_LABELS } from "@/lib/constants";
import { useTranslation } from "@/lib/i18n";
import type { Market, Industry } from "@/lib/constants";
import { createClient } from "@/lib/supabase/client";
import { updateBrandProfile } from "@/app/actions/profile";
import { toast } from "sonner";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface BrandData {
  companyName: string;
  website: string;
  industry: string;
  contactName: string;
  contactEmail: string;
  description: string;
  targetMarkets: string[];
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export default function BrandSettingsPage() {
  const { t } = useTranslation("brand.settings");
  const { t: tc } = useTranslation("ui.common");
  const router = useRouter();
  const [data, setData] = useState<BrandData | null>(null);
  const [loading, setLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [isPending, startTransition] = useTransition();

  useEffect(() => {
    async function load() {
      const supabase = createClient();
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) return;

      const { data: brand } = await supabase
        .from("brand_profiles")
        .select(
          "company_name, website, industry, contact_name, contact_email, description, target_markets"
        )
        .eq("profile_id", user.id)
        .single();

      if (brand) {
        setData({
          companyName: brand.company_name || "",
          website: brand.website || "",
          industry: brand.industry || "",
          contactName: brand.contact_name || "",
          contactEmail: brand.contact_email || user.email || "",
          description: brand.description || "",
          targetMarkets: brand.target_markets || [],
        });
      }
      setLoading(false);
    }
    load();
  }, []);

  async function handleSave() {
    if (!data) return;
    setIsSaving(true);
    try {
      await updateBrandProfile({
        company_name: data.companyName,
        website: data.website,
        industry: data.industry,
        description: data.description,
        contact_name: data.contactName,
        contact_email: data.contactEmail,
        target_markets: data.targetMarkets,
      });
      toast.success(t("toast.saved"));
    } catch {
      toast.error(t("toast.error"));
    } finally {
      setIsSaving(false);
    }
  }

  async function handleSignOut() {
    const supabase = createClient();
    await supabase.auth.signOut();
    router.push("/login");
  }

  if (loading) {
    return (
      <div className="mx-auto max-w-3xl space-y-6 px-4 py-6 sm:px-6 lg:px-8">
        <div className="space-y-2">
          <div className="h-7 w-24 animate-pulse rounded bg-muted" />
          <div className="h-4 w-40 animate-pulse rounded bg-muted/50" />
        </div>
        {[1, 2, 3].map((i) => (
          <div
            key={i}
            className="rounded-xl border border-border/60 bg-card p-5"
          >
            <div className="mb-4 h-5 w-28 animate-pulse rounded bg-muted" />
            <div className="space-y-3">
              <div className="space-y-1.5">
                <div className="h-3 w-20 animate-pulse rounded bg-muted/50" />
                <div className="h-10 w-full animate-pulse rounded-lg bg-muted/50" />
              </div>
              <div className="space-y-1.5">
                <div className="h-3 w-24 animate-pulse rounded bg-muted/50" />
                <div className="h-10 w-full animate-pulse rounded-lg bg-muted/50" />
              </div>
            </div>
          </div>
        ))}
      </div>
    );
  }

  if (!data) return null;

  return (
    <div className="mx-auto max-w-3xl px-4 py-6 sm:px-6 lg:px-8">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-foreground">{t("title")}</h1>
        <p className="text-sm text-muted-foreground">{t("subtitle")}</p>
      </div>

      <div className="space-y-6">
        {/* Company Info */}
        <Card>
          <CardHeader>
            <div className="flex items-center gap-2">
              <Building2 className="size-5 text-muted-foreground" />
              <CardTitle>{t("section.company")}</CardTitle>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <Label htmlFor="companyName">{t("field.companyName")}</Label>
                <Input
                  id="companyName"
                  value={data.companyName}
                  onChange={(e) =>
                    setData({ ...data, companyName: e.target.value })
                  }
                  className="mt-1.5"
                />
              </div>
              <div>
                <Label htmlFor="website">{t("field.website")}</Label>
                <Input
                  id="website"
                  value={data.website}
                  onChange={(e) =>
                    setData({ ...data, website: e.target.value })
                  }
                  className="mt-1.5"
                />
              </div>
            </div>
            <div>
              <Label htmlFor="industry">{t("field.industry")}</Label>
              <select
                id="industry"
                value={data.industry}
                onChange={(e) =>
                  setData({ ...data, industry: e.target.value })
                }
                className="mt-1.5 h-8 w-full rounded-lg border border-input bg-transparent px-2.5 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
              >
                {Object.entries(INDUSTRY_LABELS).map(([key, label]) => (
                  <option key={key} value={key}>
                    {label}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <Label htmlFor="description">{t("field.description")}</Label>
              <textarea
                id="description"
                rows={3}
                value={data.description}
                onChange={(e) =>
                  setData({ ...data, description: e.target.value })
                }
                className="mt-1.5 w-full rounded-lg border border-input bg-transparent px-2.5 py-2 text-sm outline-none placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
              />
            </div>
            <div>
              <Label htmlFor="contactName">{t("field.contactName")}</Label>
              <Input
                id="contactName"
                value={data.contactName}
                onChange={(e) =>
                  setData({ ...data, contactName: e.target.value })
                }
                className="mt-1.5"
              />
            </div>
            <div className="pt-2">
              <Button onClick={handleSave} disabled={isSaving}>
                {isSaving && <Loader2 className="size-4 animate-spin" />}
                {tc("action.save")}
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Target Markets */}
        <Card>
          <CardHeader>
            <div className="flex items-center gap-2">
              <Globe className="size-5 text-muted-foreground" />
              <CardTitle>{t("section.markets")}</CardTitle>
            </div>
          </CardHeader>
          <CardContent>
            <p className="mb-3 text-sm text-muted-foreground">
              {t("markets.description")}
            </p>
            <div className="flex flex-wrap gap-2">
              {Object.entries(MARKET_LABELS).map(([key, label]) => {
                const isSelected = data.targetMarkets.includes(key);
                return (
                  <button
                    key={key}
                    type="button"
                    onClick={() => {
                      const markets = isSelected
                        ? data.targetMarkets.filter((m) => m !== key)
                        : [...data.targetMarkets, key];
                      setData({ ...data, targetMarkets: markets });
                    }}
                    className={`rounded-lg border px-3 py-1.5 text-sm transition-colors ${
                      isSelected
                        ? "border-primary bg-primary font-medium text-primary-foreground"
                        : "border-border text-muted-foreground hover:border-border hover:bg-muted/50"
                    }`}
                  >
                    {label}
                  </button>
                );
              })}
            </div>
          </CardContent>
        </Card>

        {/* Account */}
        <Card>
          <CardHeader>
            <div className="flex items-center gap-2">
              <Mail className="size-5 text-muted-foreground" />
              <CardTitle>{t("section.account")}</CardTitle>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <Label>{t("field.email")}</Label>
              <div className="mt-1.5 flex items-center gap-2">
                <Input defaultValue={data.contactEmail} disabled className="flex-1" />
                <Badge variant="secondary">Google</Badge>
              </div>
            </div>
            <Separator />
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-foreground">
                  {t("action.signOut")}
                </p>
              </div>
              <Button variant="outline" onClick={handleSignOut}>
                <LogOut className="size-4" />
                {tc("nav.logout")}
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

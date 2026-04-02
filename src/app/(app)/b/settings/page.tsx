"use client";

import { useState, useEffect, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  Building2,
  Globe,
  Mail,
  LogOut,
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

  async function handleSignOut() {
    const supabase = createClient();
    await supabase.auth.signOut();
    router.push("/login");
  }

  if (loading) {
    return (
      <div className="mx-auto max-w-3xl space-y-6 px-4 py-6 sm:px-6 lg:px-8">
        <div className="space-y-2">
          <div className="h-7 w-24 animate-pulse rounded bg-slate-100" />
          <div className="h-4 w-40 animate-pulse rounded bg-slate-50" />
        </div>
        {[1, 2, 3].map((i) => (
          <div
            key={i}
            className="rounded-xl border border-slate-200/60 bg-white p-5"
          >
            <div className="mb-4 h-5 w-28 animate-pulse rounded bg-slate-100" />
            <div className="space-y-3">
              <div className="space-y-1.5">
                <div className="h-3 w-20 animate-pulse rounded bg-slate-50" />
                <div className="h-10 w-full animate-pulse rounded-lg bg-slate-50" />
              </div>
              <div className="space-y-1.5">
                <div className="h-3 w-24 animate-pulse rounded bg-slate-50" />
                <div className="h-10 w-full animate-pulse rounded-lg bg-slate-50" />
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
        <h1 className="text-2xl font-bold text-slate-900">{t("title")}</h1>
        <p className="text-sm text-slate-500">{t("subtitle")}</p>
      </div>

      <div className="space-y-6">
        {/* Company Info */}
        <Card>
          <CardHeader>
            <div className="flex items-center gap-2">
              <Building2 className="size-5 text-slate-500" />
              <CardTitle>{t("section.company")}</CardTitle>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <Label htmlFor="companyName">{t("field.companyName")}</Label>
                <Input
                  id="companyName"
                  defaultValue={data.companyName}
                  className="mt-1.5"
                />
              </div>
              <div>
                <Label htmlFor="website">{t("field.website")}</Label>
                <Input
                  id="website"
                  defaultValue={data.website}
                  className="mt-1.5"
                />
              </div>
            </div>
            <div>
              <Label htmlFor="industry">{t("field.industry")}</Label>
              <select
                id="industry"
                defaultValue={data.industry}
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
                defaultValue={data.description}
                className="mt-1.5 w-full rounded-lg border border-input bg-transparent px-2.5 py-2 text-sm outline-none placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
              />
            </div>
            <div>
              <Label htmlFor="contactName">{t("field.contactName")}</Label>
              <Input
                id="contactName"
                defaultValue={data.contactName}
                className="mt-1.5"
              />
            </div>
            <div className="pt-2">
              <Button>{tc("action.save")}</Button>
            </div>
          </CardContent>
        </Card>

        {/* Target Markets */}
        <Card>
          <CardHeader>
            <div className="flex items-center gap-2">
              <Globe className="size-5 text-slate-500" />
              <CardTitle>{t("section.markets")}</CardTitle>
            </div>
          </CardHeader>
          <CardContent>
            <p className="mb-3 text-sm text-slate-500">
              {t("markets.description")}
            </p>
            <div className="flex flex-wrap gap-2">
              {Object.entries(MARKET_LABELS).map(([key, label]) => {
                const isSelected = data.targetMarkets.includes(key);
                return (
                  <button
                    key={key}
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
          </CardContent>
        </Card>

        {/* Account */}
        <Card>
          <CardHeader>
            <div className="flex items-center gap-2">
              <Mail className="size-5 text-slate-500" />
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
                <p className="text-sm font-medium text-slate-900">
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

"use client";

import { useState, useEffect, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import {
  Building2,
  Clock3,
  FileText,
  Globe,
  LogOut,
  Loader2,
  Mail,
  Send,
  ShieldCheck,
  UserPlus,
  UserMinus,
  Users,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { Badge } from "@/components/ui/badge";
import { NotificationEmailPreferencesPanel } from "@/components/shared/notification-email-preferences-panel";
import { MfaSettingsPanel } from "@/components/security/mfa-settings-panel";
import { PrivacyControlsPanel } from "@/components/security/privacy-controls-panel";
import { CampaignMarketPicker } from "@/components/campaigns/campaign-market-picker";
import {
  INDUSTRY_LABELS,
  INDUSTRIES,
  MARKETS,
  MARKET_SCOPE_OPTIONS,
  getMarketLabel,
  sanitizeCampaignMarkets,
  type CampaignMarket,
  type Industry,
} from "@/lib/constants";
import { hasBrandWorkspacePermission } from "@/lib/brand-permissions";
import { useTranslation } from "@/lib/i18n";
import { createClient, getBrowserUser } from "@/lib/supabase/client";
import {
  createBrandTeamInvitation,
  getBrandTeamSettings,
  removeBrandTeamMember,
  resendBrandTeamInvitation,
  revokeBrandTeamInvitation,
  updateBrandTeamMemberRole,
  type BrandTeamSettings,
} from "@/app/actions/brand-team";
import { updateBrandProfile } from "@/app/actions/profile";
import { toast } from "sonner";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface BrandData {
  companyName: string;
  website: string;
  industry: Industry | "";
  contactName: string;
  contactEmail: string;
  description: string;
  targetMarkets: CampaignMarket[];
}

const brandTeamInviteRoleOptions = ["admin", "manager", "viewer"] as const;
const brandTeamMemberRoleOptions = [
  "owner",
  "admin",
  "manager",
  "viewer",
] as const;
const teamRoleLabelKeys = {
  owner: "team.role.owner",
  admin: "team.role.admin",
  manager: "team.role.manager",
  viewer: "team.role.viewer",
} as const;
const teamRoleHelpKeys = {
  owner: "team.roleHelp.owner",
  admin: "team.roleHelp.admin",
  manager: "team.roleHelp.manager",
  viewer: "team.roleHelp.viewer",
} as const;
const rolePermissionItems = [
  {
    role: "admin",
    labelKey: teamRoleLabelKeys.admin,
    helpKey: teamRoleHelpKeys.admin,
  },
  {
    role: "manager",
    labelKey: teamRoleLabelKeys.manager,
    helpKey: teamRoleHelpKeys.manager,
  },
  {
    role: "viewer",
    labelKey: teamRoleLabelKeys.viewer,
    helpKey: teamRoleHelpKeys.viewer,
  },
] as const;

function formatTeamDate(date: string, locale: string) {
  return new Intl.DateTimeFormat(locale, {
    month: "short",
    day: "numeric",
  }).format(new Date(date));
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export default function BrandSettingsPage() {
  const { t, locale } = useTranslation("brand.settings");
  const { t: tc } = useTranslation("ui.common");
  const router = useRouter();
  const [data, setData] = useState<BrandData | null>(null);
  const [team, setTeam] = useState<BrandTeamSettings | null>(null);
  const [loading, setLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteRole, setInviteRole] =
    useState<(typeof brandTeamInviteRoleOptions)[number]>("manager");
  const [isInviting, setIsInviting] = useState(false);
  const [revokingInviteId, setRevokingInviteId] = useState<string | null>(null);
  const [resendingInviteId, setResendingInviteId] = useState<string | null>(
    null,
  );
  const [updatingMemberId, setUpdatingMemberId] = useState<string | null>(null);
  const [removingMemberId, setRemovingMemberId] = useState<string | null>(null);

  useEffect(() => {
    async function load() {
      const supabase = createClient();
      const {
        data: { user },
      } = await getBrowserUser();
      if (!user) return;

      const teamSettings = await getBrandTeamSettings();
      const brandResponse = await supabase
        .from("brand_profiles")
        .select(
          "company_name, website, industry, contact_name, contact_email, description, target_markets",
        )
        .eq("profile_id", teamSettings.workspaceBrandId)
        .single();

      const { data: brand } = brandResponse;

      if (brand) {
        setData({
          companyName: brand.company_name || "",
          website: brand.website || "",
          industry: INDUSTRIES.includes(brand.industry as Industry)
            ? (brand.industry as Industry)
            : "",
          contactName: brand.contact_name || "",
          contactEmail: brand.contact_email || user.email || "",
          description: brand.description || "",
          targetMarkets: sanitizeCampaignMarkets(brand.target_markets),
        });
      }
      setTeam(teamSettings);
      setLoading(false);
    }
    load();
  }, []);

  async function handleSave() {
    if (!data || !canManageProfile) return;
    setIsSaving(true);
    try {
      await updateBrandProfile({
        company_name: data.companyName,
        website: data.website,
        industry: data.industry || undefined,
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

  async function handleInviteTeamMember(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setIsInviting(true);
    try {
      await createBrandTeamInvitation({
        email: inviteEmail,
        role: inviteRole,
      });
      setInviteEmail("");
      setTeam(await getBrandTeamSettings());
      toast.success(t("team.inviteSent"));
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : t("team.inviteError"),
      );
    } finally {
      setIsInviting(false);
    }
  }

  async function handleRevokeInvite(invitationId: string) {
    setRevokingInviteId(invitationId);
    try {
      await revokeBrandTeamInvitation(invitationId);
      setTeam(await getBrandTeamSettings());
      toast.success(t("team.revokeSent"));
    } catch {
      toast.error(t("team.revokeError"));
    } finally {
      setRevokingInviteId(null);
    }
  }

  async function handleResendInvite(invitationId: string) {
    setResendingInviteId(invitationId);
    try {
      await resendBrandTeamInvitation(invitationId);
      setTeam(await getBrandTeamSettings());
      toast.success(t("team.resendSent"));
    } catch {
      toast.error(t("team.resendError"));
    } finally {
      setResendingInviteId(null);
    }
  }

  async function handleUpdateTeamMemberRole(
    memberId: string,
    role: (typeof brandTeamMemberRoleOptions)[number],
  ) {
    setUpdatingMemberId(memberId);
    try {
      await updateBrandTeamMemberRole({ memberId, role });
      setTeam(await getBrandTeamSettings());
      toast.success(t("team.roleSaved"));
    } catch {
      toast.error(t("team.roleError"));
    } finally {
      setUpdatingMemberId(null);
    }
  }

  async function handleRemoveTeamMember(memberId: string) {
    setRemovingMemberId(memberId);
    try {
      await removeBrandTeamMember(memberId);
      setTeam(await getBrandTeamSettings());
      toast.success(t("team.removeSent"));
    } catch {
      toast.error(t("team.removeError"));
    } finally {
      setRemovingMemberId(null);
    }
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

  const canManageTeam = hasBrandWorkspacePermission(
    team?.currentUserRole,
    "manage_team",
  );
  const canManageProfile = hasBrandWorkspacePermission(
    team?.currentUserRole,
    "manage_profile",
  );
  const marketOptions = MARKETS.map((market) => ({
    value: market,
    label: getMarketLabel(market, locale),
  }));
  const marketScopeOptions = MARKET_SCOPE_OPTIONS.map((scope) => ({
    value: scope.value,
    label: getMarketLabel(scope.value, locale),
  }));

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
            <div className="flex items-center justify-between gap-3">
              <div className="flex items-center gap-2">
                <Building2 className="size-5 text-muted-foreground" />
                <CardTitle>{t("section.company")}</CardTitle>
              </div>
              {!canManageProfile && (
                <Badge
                  variant="outline"
                  data-testid="brand-profile-readonly-badge"
                >
                  {t("team.readOnly")}
                </Badge>
              )}
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
                  disabled={!canManageProfile}
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
                  disabled={!canManageProfile}
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
                  setData({ ...data, industry: e.target.value as Industry })
                }
                disabled={!canManageProfile}
                className="mt-1.5 h-8 w-full rounded-lg border border-input bg-transparent px-2.5 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 disabled:cursor-not-allowed disabled:opacity-70"
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
                disabled={!canManageProfile}
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
                disabled={!canManageProfile}
                className="mt-1.5"
              />
            </div>
            {canManageProfile && (
              <div className="pt-2">
                <Button onClick={handleSave} disabled={isSaving}>
                  {isSaving && <Loader2 className="size-4 animate-spin" />}
                  {tc("action.save")}
                </Button>
              </div>
            )}
          </CardContent>
        </Card>

        <Card data-testid="brand-team-settings">
          <CardHeader>
            <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
              <div className="flex items-start gap-2">
                <Users className="mt-0.5 size-5 text-muted-foreground" />
                <div>
                  <CardTitle>{t("team.title")}</CardTitle>
                  <p className="mt-1 text-sm text-muted-foreground">
                    {t("team.currentAccess", {
                      role: t(
                        teamRoleLabelKeys[team?.currentUserRole ?? "viewer"],
                      ),
                    })}
                  </p>
                </div>
              </div>
              <div className="flex flex-wrap gap-2 text-xs text-muted-foreground">
                <Badge variant="secondary">
                  {t("team.memberCount", {
                    count: String(team?.members.length ?? 0),
                  })}
                </Badge>
                <Badge variant="secondary">
                  {t("team.pendingCount", {
                    count: String(team?.pendingInvitations.length ?? 0),
                  })}
                </Badge>
              </div>
            </div>
          </CardHeader>
          <CardContent className="space-y-5">
            {canManageTeam ? (
              <div className="space-y-3 rounded-xl border border-border/70 bg-muted/20 p-3">
                <form
                  data-testid="brand-team-invite-form"
                  onSubmit={handleInviteTeamMember}
                  className="grid gap-3 md:grid-cols-[minmax(0,1fr)_160px_auto]"
                >
                  <div className="space-y-1.5">
                    <Label htmlFor="teamInviteEmail">
                      {t("team.inviteEmail")}
                    </Label>
                    <Input
                      id="teamInviteEmail"
                      type="email"
                      value={inviteEmail}
                      onChange={(event) => setInviteEmail(event.target.value)}
                      placeholder="name@company.com"
                      required
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="teamInviteRole">
                      {t("team.inviteRole")}
                    </Label>
                    <select
                      id="teamInviteRole"
                      value={inviteRole}
                      onChange={(event) =>
                        setInviteRole(event.target.value as typeof inviteRole)
                      }
                      className="h-10 w-full rounded-lg border border-input bg-background px-3 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
                    >
                      {brandTeamInviteRoleOptions.map((role) => (
                        <option key={role} value={role}>
                          {t(teamRoleLabelKeys[role])}
                        </option>
                      ))}
                    </select>
                  </div>
                  <Button
                    type="submit"
                    className="self-end"
                    disabled={isInviting}
                  >
                    {isInviting ? (
                      <Loader2 className="size-4 animate-spin" />
                    ) : (
                      <UserPlus className="size-4" />
                    )}
                    {t("team.inviteCta")}
                  </Button>
                </form>

                <div data-testid="brand-team-role-guide" className="space-y-2">
                  <p className="text-xs font-medium text-muted-foreground">
                    {t("team.roleGuide")}
                  </p>
                  <div className="grid gap-2 sm:grid-cols-3">
                    {rolePermissionItems.map((item) => (
                      <div
                        key={item.role}
                        className={`rounded-lg border bg-background px-3 py-2 ${
                          inviteRole === item.role
                            ? "border-primary text-foreground"
                            : "border-border/70 text-muted-foreground"
                        }`}
                      >
                        <p className="text-sm font-semibold">
                          {t(item.labelKey)}
                        </p>
                        <p className="mt-1 text-xs leading-5">
                          {t(item.helpKey)}
                        </p>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            ) : (
              <div
                data-testid="brand-team-manage-unavailable"
                className="flex flex-col gap-2 rounded-xl border border-dashed border-border px-3 py-3 text-sm text-muted-foreground sm:flex-row sm:items-center sm:justify-between"
              >
                <span>{t("team.manageUnavailable")}</span>
                <Badge variant="outline">
                  {t(teamRoleLabelKeys[team?.currentUserRole ?? "viewer"])}
                </Badge>
              </div>
            )}

            <section data-testid="brand-team-active-members" className="space-y-2">
              <p className="text-sm font-medium text-foreground">
                {t("team.activeMembers")}
              </p>
              <div className="divide-y divide-border/70 rounded-xl border border-border/70">
                {(team?.members ?? []).map((member) => {
                  const canManageAcceptedMember =
                    canManageTeam &&
                    member.userId !== team?.currentUserId &&
                    (member.role !== "owner" ||
                      team?.currentUserRole === "owner");
                  const canRemoveAcceptedMember =
                    canManageAcceptedMember && member.role !== "owner";

                  return (
                    <div
                      key={member.id}
                      data-testid="brand-team-member-row"
                      className="grid gap-3 px-3 py-3 sm:grid-cols-[minmax(0,1fr)_minmax(220px,auto)]"
                    >
                      <div className="min-w-0">
                        <p className="truncate text-sm font-semibold text-foreground">
                          {member.name}
                        </p>
                        <p className="truncate text-sm text-muted-foreground">
                          {member.email}
                        </p>
                      </div>
                      <div className="flex items-center gap-2 sm:justify-end">
                        {canManageAcceptedMember ? (
                          <>
                            <select
                              value={member.role}
                              onChange={(event) =>
                                handleUpdateTeamMemberRole(
                                  member.id,
                                  event.target
                                    .value as (typeof brandTeamMemberRoleOptions)[number],
                                )
                              }
                              disabled={
                                updatingMemberId === member.id ||
                                removingMemberId === member.id
                              }
                              aria-label={t("team.changeRole")}
                              className="h-8 rounded-lg border border-input bg-background px-2.5 text-xs font-medium text-foreground outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
                            >
                              {team?.currentUserRole === "owner"
                                ? brandTeamMemberRoleOptions.map((role) => (
                                    <option key={role} value={role}>
                                      {t(teamRoleLabelKeys[role])}
                                    </option>
                                  ))
                                : brandTeamInviteRoleOptions.map((role) => (
                                    <option key={role} value={role}>
                                      {t(teamRoleLabelKeys[role])}
                                    </option>
                                  ))}
                            </select>
                            {canRemoveAcceptedMember && (
                              <Button
                                type="button"
                                variant="ghost"
                                size="icon"
                                className="size-8"
                                onClick={() =>
                                  handleRemoveTeamMember(member.id)
                                }
                                disabled={
                                  updatingMemberId === member.id ||
                                  removingMemberId === member.id
                                }
                                aria-label={t("team.remove")}
                              >
                                {removingMemberId === member.id ? (
                                  <Loader2 className="size-4 animate-spin" />
                                ) : (
                                  <UserMinus className="size-4" />
                                )}
                              </Button>
                            )}
                          </>
                        ) : (
                          <div className="flex flex-col items-start gap-1 sm:items-end">
                            <Badge variant="outline">
                              {t(teamRoleLabelKeys[member.role])}
                            </Badge>
                            <span className="max-w-xs text-xs leading-5 text-muted-foreground sm:text-end">
                              {t(teamRoleHelpKeys[member.role])}
                            </span>
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </section>

            <section data-testid="brand-team-pending-invites" className="space-y-2">
              <p className="text-sm font-medium text-foreground">
                {t("team.pending")}
              </p>
              {team?.pendingInvitations.length ? (
                <div className="divide-y divide-border/70 rounded-xl border border-border/70">
                  {team.pendingInvitations.map((invitation) => (
                    <div
                      key={invitation.id}
                      data-testid="brand-team-invite-row"
                      className="grid gap-3 px-3 py-3 sm:grid-cols-[minmax(0,1fr)_auto]"
                    >
                      <div className="min-w-0">
                        <div className="flex flex-wrap items-center gap-2">
                          <p className="truncate text-sm font-semibold text-foreground">
                            {invitation.email}
                          </p>
                          <Badge
                            variant={invitation.isExpired ? "outline" : "secondary"}
                          >
                            {invitation.isExpired
                              ? t("team.expired")
                              : t("team.status.pending")}
                          </Badge>
                        </div>
                        <div className="mt-1 flex flex-wrap gap-x-3 gap-y-1 text-xs text-muted-foreground">
                          <span className="inline-flex items-center gap-1">
                            <Clock3 className="size-3.5" />
                            {t("team.sent", {
                              date: formatTeamDate(
                                invitation.invitedAt,
                                locale,
                              ),
                            })}
                          </span>
                          <span>
                            {t("team.expires", {
                              date: formatTeamDate(
                                invitation.expiresAt,
                                locale,
                              ),
                            })}
                          </span>
                        </div>
                      </div>
                      <div className="flex flex-wrap items-center gap-2 sm:justify-end">
                        <Badge variant="secondary">
                          {t(teamRoleLabelKeys[invitation.role])}
                        </Badge>
                        {canManageTeam && (
                          <>
                            <Button
                              type="button"
                              variant="outline"
                              size="sm"
                              onClick={() => handleResendInvite(invitation.id)}
                              disabled={
                                revokingInviteId === invitation.id ||
                                resendingInviteId === invitation.id
                              }
                              aria-label={t("team.resend")}
                              className="h-8 px-2.5 text-xs"
                            >
                              {resendingInviteId === invitation.id ? (
                                <Loader2 className="size-3.5 animate-spin" />
                              ) : (
                                <Send className="size-3.5" />
                              )}
                              {t("team.resend")}
                            </Button>
                            <Button
                              type="button"
                              variant="ghost"
                              size="sm"
                              onClick={() => handleRevokeInvite(invitation.id)}
                              disabled={
                                revokingInviteId === invitation.id ||
                                resendingInviteId === invitation.id
                              }
                              aria-label={t("team.revoke")}
                              className="h-8 px-2.5 text-xs"
                            >
                              {revokingInviteId === invitation.id ? (
                                <Loader2 className="size-3.5 animate-spin" />
                              ) : (
                                <UserMinus className="size-3.5" />
                              )}
                              {t("team.revoke")}
                            </Button>
                          </>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="rounded-xl border border-dashed border-border px-3 py-3 text-sm text-muted-foreground">
                  {t("team.noInvites")}
                </p>
              )}
            </section>
          </CardContent>
        </Card>

        {/* Target Markets */}
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between gap-3">
              <div className="flex items-center gap-2">
                <Globe className="size-5 text-muted-foreground" />
                <CardTitle>{t("section.markets")}</CardTitle>
              </div>
              {!canManageProfile && (
                <Badge variant="outline">{t("team.readOnly")}</Badge>
              )}
            </div>
          </CardHeader>
          <CardContent className="space-y-3">
            <p className="mb-3 text-sm text-muted-foreground">
              {t("markets.description")}
            </p>
            {canManageProfile ? (
              <>
                <CampaignMarketPicker
                  testId="brand-settings-market-picker"
                  options={marketOptions}
                  scopeOptions={marketScopeOptions}
                  selected={data.targetMarkets}
                  selectedChipTone="subtle"
                  onChange={(targetMarkets) =>
                    setData({ ...data, targetMarkets })
                  }
                  copy={{
                    placeholder: t("markets.placeholder"),
                    selectedCount: t("markets.selected", {
                      count: String(data.targetMarkets.length),
                    }),
                    scopeLabel: t("markets.scope"),
                    searchPlaceholder: t("markets.search"),
                    empty: t("markets.empty"),
                  }}
                />
                <Button
                  type="button"
                  data-testid="brand-markets-save"
                  onClick={handleSave}
                  disabled={isSaving}
                >
                  {isSaving && <Loader2 className="size-4 animate-spin" />}
                  {tc("action.save")}
                </Button>
              </>
            ) : data.targetMarkets.length > 0 ? (
              <div className="flex flex-wrap gap-2">
                {data.targetMarkets.map((market) => (
                  <Badge key={market} variant="secondary">
                    {getMarketLabel(market, locale)}
                  </Badge>
                ))}
              </div>
            ) : (
              <p className="rounded-xl border border-dashed border-border px-3 py-3 text-sm text-muted-foreground">
                {t("markets.none")}
              </p>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <div className="flex items-center gap-2">
              <Mail className="size-5 text-muted-foreground" />
              <CardTitle>{t("section.notifications")}</CardTitle>
            </div>
          </CardHeader>
          <CardContent>
            <NotificationEmailPreferencesPanel />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <div className="flex items-center gap-2">
              <ShieldCheck className="size-5 text-muted-foreground" />
              <CardTitle>{t("section.security")}</CardTitle>
            </div>
          </CardHeader>
          <CardContent>
            <MfaSettingsPanel />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <div className="flex items-center gap-2">
              <FileText className="size-5 text-muted-foreground" />
              <CardTitle>{t("section.privacy")}</CardTitle>
            </div>
          </CardHeader>
          <CardContent>
            <PrivacyControlsPanel />
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
                <Input
                  defaultValue={data.contactEmail}
                  disabled
                  className="flex-1"
                />
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

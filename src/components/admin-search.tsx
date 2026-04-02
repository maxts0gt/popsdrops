"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import {
  Search,
  Users,
  Megaphone,
  ShieldCheck,
  BarChart3,
  FileText,
  Settings,
} from "lucide-react";
import {
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandSeparator,
} from "@/components/ui/command";
import { createClient } from "@/lib/supabase/client";

interface SearchResult {
  id: string;
  label: string;
  description?: string;
  href: string;
  icon: React.ComponentType<{ className?: string }>;
}

const quickActions: SearchResult[] = [
  { id: "approvals", label: "Review Approvals", href: "/admin/approvals", icon: ShieldCheck },
  { id: "users", label: "Manage Users", href: "/admin/users", icon: Users },
  { id: "campaigns", label: "View Campaigns", href: "/admin/campaigns", icon: Megaphone },
  { id: "analytics", label: "Analytics", href: "/admin/analytics", icon: BarChart3 },
  { id: "reports", label: "Reports", href: "/admin/reports", icon: FileText },
  { id: "settings", label: "Settings", href: "/admin/settings", icon: Settings },
];

export function AdminSearch() {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [userResults, setUserResults] = useState<SearchResult[]>([]);
  const [campaignResults, setCampaignResults] = useState<SearchResult[]>([]);
  const [searching, setSearching] = useState(false);
  const router = useRouter();
  const showSearchResults = query.length >= 2;

  // Keyboard shortcut: Cmd+K / Ctrl+K
  useEffect(() => {
    function down(e: KeyboardEvent) {
      if (e.key === "k" && (e.metaKey || e.ctrlKey)) {
        e.preventDefault();
        setOpen((o) => !o);
      }
    }
    document.addEventListener("keydown", down);
    return () => document.removeEventListener("keydown", down);
  }, []);

  // Debounced search against Supabase
  useEffect(() => {
    if (query.length < 2) return;

    let cancelled = false;

    const timer = setTimeout(async () => {
      setSearching(true);
      const supabase = createClient();

      const [usersRes, campaignsRes] = await Promise.all([
        supabase
          .from("profiles")
          .select("id, full_name, email, role, status")
          .or(`full_name.ilike.%${query}%,email.ilike.%${query}%`)
          .limit(5),
        supabase
          .from("campaigns")
          .select("id, title, status")
          .ilike("title", `%${query}%`)
          .limit(5),
      ]);

      if (cancelled) return;

      setUserResults(
        (usersRes.data ?? []).map((u) => ({
          id: u.id,
          label: u.full_name || u.email,
          description: `${u.role} · ${u.status} · ${u.email}`,
          href: "/admin/users",
          icon: Users,
        }))
      );

      setCampaignResults(
        (campaignsRes.data ?? []).map((c) => ({
          id: c.id,
          label: c.title,
          description: c.status,
          href: "/admin/campaigns",
          icon: Megaphone,
        }))
      );

      setSearching(false);
    }, 300);

    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [query]);

  function handleSelect(href: string) {
    setOpen(false);
    setQuery("");
    router.push(href);
  }

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className="flex w-full items-center gap-2 rounded-lg border border-border bg-muted/50 px-3 py-2 text-sm text-muted-foreground hover:bg-muted transition-colors"
      >
        <Search className="size-4" />
        <span className="flex-1 text-start">Search...</span>
        <kbd className="hidden rounded border border-border bg-background px-1.5 py-0.5 text-[10px] font-medium text-muted-foreground sm:inline">
          ⌘K
        </kbd>
      </button>

      <CommandDialog open={open} onOpenChange={setOpen} shouldFilter={false}>
        <CommandInput
          placeholder="Search users, campaigns, or navigate..."
          value={query}
          onValueChange={setQuery}
        />
        <CommandList>
          <CommandEmpty>
            {showSearchResults && searching
              ? "Searching..."
              : "No results found."}
          </CommandEmpty>

          {showSearchResults && userResults.length > 0 && (
            <CommandGroup heading="Users">
              {userResults.map((r) => (
                <CommandItem key={r.id} onSelect={() => handleSelect(r.href)}>
                  <r.icon className="me-2 size-4 text-muted-foreground" />
                  <div>
                    <p className="text-sm">{r.label}</p>
                    {r.description && (
                      <p className="text-xs text-muted-foreground">
                        {r.description}
                      </p>
                    )}
                  </div>
                </CommandItem>
              ))}
            </CommandGroup>
          )}

          {showSearchResults && campaignResults.length > 0 && (
            <CommandGroup heading="Campaigns">
              {campaignResults.map((r) => (
                <CommandItem key={r.id} onSelect={() => handleSelect(r.href)}>
                  <r.icon className="me-2 size-4 text-muted-foreground" />
                  <div>
                    <p className="text-sm">{r.label}</p>
                    {r.description && (
                      <p className="text-xs text-muted-foreground">
                        {r.description}
                      </p>
                    )}
                  </div>
                </CommandItem>
              ))}
            </CommandGroup>
          )}

          <CommandSeparator />

          <CommandGroup heading="Quick Actions">
            {quickActions.map((a) => (
              <CommandItem key={a.id} onSelect={() => handleSelect(a.href)}>
                <a.icon className="me-2 size-4 text-muted-foreground" />
                {a.label}
              </CommandItem>
            ))}
          </CommandGroup>
        </CommandList>
      </CommandDialog>
    </>
  );
}

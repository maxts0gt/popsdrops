"use client";

import { useEffect, useRef, useState } from "react";
import { ChevronDown, Plus, Search, X } from "lucide-react";
import { Input } from "@/components/ui/input";
import type { CampaignMarket, Market } from "@/lib/constants";

export type CampaignMarketPickerCopy = {
  placeholder: string;
  selectedCount: string;
  scopeLabel: string;
  searchPlaceholder: string;
  empty: string;
};

type CampaignMarketPickerOption = { value: Market; label: string };
type CampaignMarketPickerScopeOption = { value: CampaignMarket; label: string };

export function CampaignMarketPicker({
  options,
  scopeOptions,
  selected,
  onChange,
  copy,
  testId,
  selectedChipTone = "primary",
}: {
  options: CampaignMarketPickerOption[];
  scopeOptions: CampaignMarketPickerScopeOption[];
  selected: CampaignMarket[];
  onChange: (val: CampaignMarket[]) => void;
  copy: CampaignMarketPickerCopy;
  testId?: string;
  selectedChipTone?: "primary" | "subtle";
}) {
  const [isOpen, setIsOpen] = useState(false);
  const [marketSearch, setMarketSearch] = useState("");
  const dropdownPanelRef = useRef<HTMLDivElement | null>(null);
  const selectedSet = new Set(selected);
  const allOptions = [...scopeOptions, ...options];
  const optionByValue = new Map(
    allOptions.map((option) => [option.value, option]),
  );
  const selectedOptions = selected
    .map((market) => optionByValue.get(market))
    .filter(
      (option): option is CampaignMarketPickerScopeOption => Boolean(option),
    );
  const normalizedSearch = marketSearch.trim().toLowerCase();
  const availableOptions = options.filter(
    (option) =>
      !selectedSet.has(option.value) &&
      (!normalizedSearch ||
        option.label.toLowerCase().includes(normalizedSearch) ||
        option.value.includes(normalizedSearch)),
  );
  const selectedChipClassName =
    selectedChipTone === "subtle"
      ? "border-border bg-muted/40 text-foreground hover:bg-muted"
      : "border-primary bg-primary text-primary-foreground";
  const selectedChipIconClassName =
    selectedChipTone === "subtle" ? "text-muted-foreground" : "";

  function selectScope(scope: CampaignMarketPickerScopeOption) {
    if (selectedSet.has(scope.value)) {
      onChange(selected.filter((item) => item !== scope.value));
      return;
    }

    if (scope.value === "global") {
      onChange(["global"]);
      setMarketSearch("");
      return;
    }

    onChange([...selected.filter((item) => item !== "global"), scope.value]);
    setMarketSearch("");
  }

  function selectMarket(market: Market) {
    onChange([...selected.filter((item) => item !== "global"), market]);
    setMarketSearch("");
  }

  function removeMarket(market: CampaignMarket) {
    onChange(selected.filter((item) => item !== market));
  }

  useEffect(() => {
    if (!isOpen) return;

    requestAnimationFrame(() => {
      dropdownPanelRef.current?.scrollIntoView({
        block: "center",
        inline: "nearest",
        behavior: "auto",
      });
    });
  }, [isOpen]);

  return (
    <div data-testid={testId} className="space-y-2">
      <button
        type="button"
        onClick={() => setIsOpen((open) => !open)}
        className="flex h-10 w-full items-center justify-between rounded-lg border border-border bg-background px-3 text-sm text-muted-foreground transition-colors hover:bg-muted/40"
      >
        <span>
          {selectedOptions.length > 0 ? copy.selectedCount : copy.placeholder}
        </span>
        <ChevronDown
          className={`size-4 transition-transform ${isOpen ? "rotate-180" : ""}`}
        />
      </button>
      {isOpen && (
        <div
          ref={dropdownPanelRef}
          className="mt-2 w-full overflow-hidden rounded-xl border border-border bg-background shadow-lg"
        >
          <div className="border-b border-border p-2">
            <p className="px-1 pb-2 text-xs font-medium text-muted-foreground">
              {copy.scopeLabel}
            </p>
            <div data-testid="market-scope-list" className="flex flex-wrap gap-2">
              {scopeOptions.map((scope) => {
                const isSelected = selectedSet.has(scope.value);

                return (
                  <button
                    key={scope.value}
                    type="button"
                    onClick={() => selectScope(scope)}
                    className={`rounded-lg border px-3 py-1.5 text-sm font-medium transition-colors ${
                      isSelected
                        ? "border-primary bg-primary text-primary-foreground"
                        : "border-border bg-background text-muted-foreground hover:bg-muted/50"
                    }`}
                    aria-pressed={isSelected}
                  >
                    {scope.label}
                  </button>
                );
              })}
            </div>
          </div>
          <div className="border-b border-border p-2">
            <div className="flex items-center gap-2 rounded-lg border border-border bg-background px-3">
              <Search className="size-4 text-muted-foreground" />
              <Input
                value={marketSearch}
                onChange={(event) => setMarketSearch(event.target.value)}
                placeholder={copy.searchPlaceholder}
                className="h-9 border-0 px-0 shadow-none focus-visible:ring-0"
              />
            </div>
          </div>
          <div
            data-testid="market-country-list"
            className="h-[220px] overflow-y-auto p-1"
          >
            {availableOptions.length > 0 ? (
              availableOptions.map((option) => (
                <button
                  key={option.value}
                  type="button"
                  onClick={() => selectMarket(option.value)}
                  className="flex w-full items-center justify-between rounded-lg px-3 py-2.5 text-start text-sm text-foreground transition-colors hover:bg-muted"
                >
                  <span>{option.label}</span>
                  <Plus className="size-3.5 text-muted-foreground" />
                </button>
              ))
            ) : (
              <p className="px-3 py-6 text-center text-sm text-muted-foreground">
                {copy.empty}
              </p>
            )}
          </div>
        </div>
      )}
      {selectedOptions.length > 0 && (
        <div data-testid="selected-markets-list" className="flex flex-wrap gap-2 pt-1">
          {selectedOptions.map((option) => (
            <button
              key={option.value}
              type="button"
              onClick={() => removeMarket(option.value)}
              className={`inline-flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-sm font-medium transition-colors ${selectedChipClassName}`}
            >
              {option.label}
              <X className={`size-3 ${selectedChipIconClassName}`} />
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

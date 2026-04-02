"use client";

import { useState, useTransition } from "react";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
  SheetFooter,
} from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { NICHES, NICHE_LABELS, type Niche } from "@/lib/constants";
import { updateCreatorProfile } from "@/app/actions/profile";

const MAX_NICHES = 5;

interface EditNichesSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  currentNiches: string[];
  onSaved: (niches: string[]) => void;
}

export function EditNichesSheet({
  open,
  onOpenChange,
  currentNiches,
  onSaved,
}: EditNichesSheetProps) {
  const [selected, setSelected] = useState<Set<string>>(
    new Set(currentNiches)
  );
  const [isPending, startTransition] = useTransition();

  function toggle(niche: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(niche)) {
        next.delete(niche);
      } else if (next.size < MAX_NICHES) {
        next.add(niche);
      }
      return next;
    });
  }

  function handleSave() {
    const niches = Array.from(selected);
    startTransition(async () => {
      await updateCreatorProfile({ niches });
      onSaved(niches);
      onOpenChange(false);
    });
  }

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="bottom" className="max-h-[85vh] rounded-t-2xl">
        <SheetHeader>
          <SheetTitle>Select Niches</SheetTitle>
          <SheetDescription>
            Choose up to {MAX_NICHES} niches. Brands filter by these.
          </SheetDescription>
        </SheetHeader>

        <div className="flex-1 overflow-y-auto px-4">
          <div className="flex flex-wrap gap-2">
            {NICHES.map((niche) => {
              const isSelected = selected.has(niche);
              const atLimit = selected.size >= MAX_NICHES && !isSelected;
              return (
                <button
                  key={niche}
                  type="button"
                  onClick={() => toggle(niche)}
                  disabled={atLimit}
                  className={`rounded-full px-3.5 py-2 text-sm font-medium transition-all ${
                    isSelected
                      ? "bg-foreground text-white shadow-sm"
                      : atLimit
                        ? "cursor-not-allowed bg-muted/50 text-muted-foreground/70"
                        : "bg-muted/50 text-muted-foreground ring-1 ring-foreground/[0.06] hover:bg-muted"
                  }`}
                >
                  {NICHE_LABELS[niche]}
                </button>
              );
            })}
          </div>
          <p className="mt-3 text-xs text-muted-foreground/70">
            {selected.size} of {MAX_NICHES} selected
          </p>
        </div>

        <SheetFooter>
          <Button
            onClick={handleSave}
            disabled={isPending || selected.size === 0}
            className="w-full"
          >
            {isPending ? "Saving..." : "Save"}
          </Button>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  );
}

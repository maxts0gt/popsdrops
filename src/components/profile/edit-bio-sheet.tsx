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
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { updateCreatorProfile } from "@/app/actions/profile";

const MAX_BIO = 160;

interface EditBioSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  currentBio: string;
  onSaved: (bio: string) => void;
}

export function EditBioSheet({
  open,
  onOpenChange,
  currentBio,
  onSaved,
}: EditBioSheetProps) {
  const [bio, setBio] = useState(currentBio);
  const [isPending, startTransition] = useTransition();

  const remaining = MAX_BIO - bio.length;
  const overLimit = remaining < 0;

  function handleSave() {
    if (overLimit) return;
    startTransition(async () => {
      await updateCreatorProfile({ bio: bio.trim() });
      onSaved(bio.trim());
      onOpenChange(false);
    });
  }

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="bottom" className="rounded-t-2xl">
        <SheetHeader>
          <SheetTitle>Edit Bio</SheetTitle>
          <SheetDescription>
            A short description that appears on your media kit.
          </SheetDescription>
        </SheetHeader>

        <div className="px-4">
          <Label htmlFor="bio" className="sr-only">
            Bio
          </Label>
          <Textarea
            id="bio"
            value={bio}
            onChange={(e) => setBio(e.target.value)}
            placeholder="Tell brands what makes you unique..."
            className="min-h-24 resize-none text-sm"
            maxLength={MAX_BIO + 20}
            autoFocus
          />
          <div className="mt-1.5 flex justify-end">
            <span
              className={`text-xs tabular-nums ${
                overLimit
                  ? "font-medium text-red-500"
                  : remaining <= 20
                    ? "text-amber-500"
                    : "text-slate-400"
              }`}
            >
              {remaining}
            </span>
          </div>
        </div>

        <SheetFooter>
          <Button
            onClick={handleSave}
            disabled={isPending || overLimit}
            className="w-full"
          >
            {isPending ? "Saving..." : "Save"}
          </Button>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  );
}

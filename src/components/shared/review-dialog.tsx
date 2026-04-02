"use client";

import { useState, useTransition } from "react";
import { Star } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
  DialogClose,
  DialogTrigger,
} from "@/components/ui/dialog";
import { submitReview } from "@/app/actions/reviews";

interface ReviewDialogProps {
  campaignId: string;
  revieweeId: string;
  revieweeName: string;
  children: React.ReactNode;
}

export function ReviewDialog({
  campaignId,
  revieweeId,
  revieweeName,
  children,
}: ReviewDialogProps) {
  const [open, setOpen] = useState(false);
  const [rating, setRating] = useState(0);
  const [hoveredRating, setHoveredRating] = useState(0);
  const [comment, setComment] = useState("");
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function handleSubmit() {
    if (rating === 0) return;
    setError(null);

    startTransition(async () => {
      try {
        await submitReview({
          campaign_id: campaignId,
          reviewee_id: revieweeId,
          rating,
          comment: comment.trim() || undefined,
        });
        setOpen(false);
        setRating(0);
        setComment("");
      } catch (err) {
        setError(
          err instanceof Error ? err.message : "Failed to submit review"
        );
      }
    });
  }

  const displayRating = hoveredRating || rating;

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger render={<>{children}</>} />
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Rate {revieweeName}</DialogTitle>
          <DialogDescription>
            Share your experience working with {revieweeName} on this campaign.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-2">
          {/* Star rating */}
          <div className="flex flex-col items-center gap-2">
            <div className="flex gap-1">
              {[1, 2, 3, 4, 5].map((star) => (
                <button
                  key={star}
                  type="button"
                  className="rounded-sm p-0.5 transition-transform hover:scale-110 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                  onMouseEnter={() => setHoveredRating(star)}
                  onMouseLeave={() => setHoveredRating(0)}
                  onClick={() => setRating(star)}
                >
                  <Star
                    className={`size-7 transition-colors ${
                      star <= displayRating
                        ? "fill-amber-400 text-amber-400"
                        : "text-border"
                    }`}
                  />
                </button>
              ))}
            </div>
            {displayRating > 0 && (
              <p className="text-xs text-muted-foreground">
                {displayRating === 1 && "Poor"}
                {displayRating === 2 && "Below average"}
                {displayRating === 3 && "Average"}
                {displayRating === 4 && "Good"}
                {displayRating === 5 && "Excellent"}
              </p>
            )}
          </div>

          {/* Comment */}
          <Textarea
            placeholder="Optional — share details about your experience..."
            value={comment}
            onChange={(e) => setComment(e.target.value)}
            rows={3}
            maxLength={500}
          />

          {error && (
            <p className="text-xs text-red-600">{error}</p>
          )}
        </div>

        <DialogFooter>
          <DialogClose>
            <Button variant="ghost" size="sm">
              Cancel
            </Button>
          </DialogClose>
          <Button
            size="sm"
            disabled={rating === 0 || isPending}
            onClick={handleSubmit}
          >
            {isPending ? "Submitting..." : "Submit Review"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

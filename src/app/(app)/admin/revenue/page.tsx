import {
  DollarSign,
  Rocket,
  Clock,
} from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";

export default function AdminRevenuePage() {
  return (
    <div className="mx-auto max-w-4xl px-4 py-6 sm:px-6 lg:px-8">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-foreground">Revenue</h1>
        <p className="text-sm text-muted-foreground">Revenue tracking and subscription management</p>
      </div>

      <Card>
        <CardContent>
          <div className="py-16 text-center">
            <div className="mx-auto mb-4 flex size-16 items-center justify-center rounded-2xl bg-muted">
              <DollarSign className="size-8 text-muted-foreground/70" />
            </div>
            <h2 className="mb-2 text-xl font-bold text-foreground">Revenue tracking available when subscription plans launch</h2>
            <p className="mx-auto max-w-md text-sm text-muted-foreground">
              PopsDrops is currently free for all users. When brand subscription tiers are introduced,
              this dashboard will show MRR, churn, plan distribution, and revenue analytics.
            </p>

            <div className="mx-auto mt-8 grid max-w-lg gap-4 sm:grid-cols-2">
              <div className="rounded-lg border border-border p-4 text-left">
                <div className="mb-2 flex items-center gap-2">
                  <Rocket className="size-4 text-muted-foreground" />
                  <span className="text-sm font-medium text-foreground">Planned Features</span>
                </div>
                <ul className="space-y-1.5 text-xs text-muted-foreground">
                  <li>Monthly Recurring Revenue (MRR)</li>
                  <li>Subscription plan distribution</li>
                  <li>Churn rate and retention</li>
                  <li>Revenue per market breakdown</li>
                  <li>Per-campaign fee tracking</li>
                </ul>
              </div>
              <div className="rounded-lg border border-border p-4 text-left">
                <div className="mb-2 flex items-center gap-2">
                  <Clock className="size-4 text-amber-500" />
                  <span className="text-sm font-medium text-foreground">Current Model</span>
                </div>
                <ul className="space-y-1.5 text-xs text-muted-foreground">
                  <li>Influencers: Free forever</li>
                  <li>Brands: Free (early access)</li>
                  <li>Future: Per-campaign fees</li>
                  <li>Future: Subscription tiers</li>
                  <li>Brokerage: 10% offline commission</li>
                </ul>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

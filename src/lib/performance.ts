import type { MeasurementType } from "@/types/database";

const HOUR_IN_MS = 1000 * 60 * 60;

export function getMeasurementTypeForPublishedAt(
  publishedAt?: string | Date | null,
  now = new Date(),
): MeasurementType {
  const publishedDate = publishedAt ? new Date(publishedAt) : now;
  const hoursSincePublish = Math.max(
    0,
    (now.getTime() - publishedDate.getTime()) / HOUR_IN_MS,
  );

  if (hoursSincePublish > 720) return "extended_30d";
  if (hoursSincePublish > 168) return "final_7d";
  return "initial_48h";
}

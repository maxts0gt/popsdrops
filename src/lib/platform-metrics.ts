import type { Platform } from "@/lib/constants";

// ---------------------------------------------------------------------------
// Metric field types
// ---------------------------------------------------------------------------

export type MetricFieldType = "integer" | "decimal" | "percentage";

export type MetricKey =
  | "views"
  | "reach"
  | "impressions"
  | "likes"
  | "comments"
  | "shares"
  | "saves"
  | "sends"
  | "screenshots"
  | "replies"
  | "clicks"
  | "completion_rate"
  | "avg_watch_time_seconds"
  | "subscriber_gains";

export interface MetricField {
  key: MetricKey;
  label: string;
  description: string;
  required: boolean;
  type: MetricFieldType;
}

// ---------------------------------------------------------------------------
// Platform-specific metric configurations
// ---------------------------------------------------------------------------

export const PLATFORM_METRICS: Record<Platform, MetricField[]> = {
  tiktok: [
    {
      key: "views",
      label: "Views",
      description: "Total video plays (any duration counts as a view)",
      required: true,
      type: "integer",
    },
    {
      key: "likes",
      label: "Likes",
      description: "Total likes on the video",
      required: true,
      type: "integer",
    },
    {
      key: "comments",
      label: "Comments",
      description: "Total comments on the video",
      required: true,
      type: "integer",
    },
    {
      key: "shares",
      label: "Shares",
      description: "Times the video was shared to other apps or users",
      required: true,
      type: "integer",
    },
    {
      key: "saves",
      label: "Saves",
      description: "Times the video was bookmarked by viewers",
      required: true,
      type: "integer",
    },
    {
      key: "reach",
      label: "Profile Views",
      description: "Profile visits driven by this video",
      required: false,
      type: "integer",
    },
    {
      key: "completion_rate",
      label: "Completion Rate",
      description: "Percentage of viewers who watched the full video",
      required: true,
      type: "percentage",
    },
    {
      key: "avg_watch_time_seconds",
      label: "Avg Watch Time",
      description: "Average number of seconds viewers watched before scrolling",
      required: false,
      type: "decimal",
    },
  ],

  instagram: [
    {
      key: "reach",
      label: "Reach",
      description: "Unique accounts that saw this content",
      required: true,
      type: "integer",
    },
    {
      key: "impressions",
      label: "Impressions",
      description: "Total times this content was displayed (includes repeat views)",
      required: true,
      type: "integer",
    },
    {
      key: "likes",
      label: "Likes",
      description: "Total likes on the content",
      required: true,
      type: "integer",
    },
    {
      key: "comments",
      label: "Comments",
      description: "Total comments on the content",
      required: true,
      type: "integer",
    },
    {
      key: "shares",
      label: "Shares",
      description: "Times the content was shared via the share button",
      required: true,
      type: "integer",
    },
    {
      key: "saves",
      label: "Saves",
      description: "Times the content was saved to a collection",
      required: true,
      type: "integer",
    },
    {
      key: "sends",
      label: "Sends",
      description: "Times the content was shared via Direct Message",
      required: false,
      type: "integer",
    },
    {
      key: "replies",
      label: "Replies",
      description: "Direct replies to Stories (Stories only)",
      required: false,
      type: "integer",
    },
    {
      key: "screenshots",
      label: "Screenshots",
      description: "Times a Story was screenshotted (Stories only)",
      required: false,
      type: "integer",
    },
  ],

  youtube: [
    {
      key: "views",
      label: "Views",
      description: "Total views (counted after 30 seconds of watch time)",
      required: true,
      type: "integer",
    },
    {
      key: "impressions",
      label: "Impressions",
      description: "Times the video thumbnail was shown to viewers",
      required: false,
      type: "integer",
    },
    {
      key: "likes",
      label: "Likes",
      description: "Total likes on the video",
      required: true,
      type: "integer",
    },
    {
      key: "comments",
      label: "Comments",
      description: "Total comments on the video",
      required: true,
      type: "integer",
    },
    {
      key: "shares",
      label: "Shares",
      description: "Times the video was shared via YouTube's share button",
      required: false,
      type: "integer",
    },
    {
      key: "subscriber_gains",
      label: "Subscriber Gains",
      description: "New subscribers gained from this video",
      required: false,
      type: "integer",
    },
    {
      key: "avg_watch_time_seconds",
      label: "Avg Watch Time",
      description: "Average seconds watched per view (key retention metric)",
      required: true,
      type: "decimal",
    },
    {
      key: "completion_rate",
      label: "Completion Rate",
      description: "Percentage of viewers who watched the entire video",
      required: false,
      type: "percentage",
    },
    {
      key: "clicks",
      label: "Click-through Rate",
      description: "Percentage of impressions that resulted in a view",
      required: false,
      type: "percentage",
    },
  ],

  snapchat: [
    {
      key: "views",
      label: "Views",
      description: "Total views (counted after ~1 second of watch time)",
      required: true,
      type: "integer",
    },
    {
      key: "screenshots",
      label: "Screenshots",
      description: "Times the content was screenshotted",
      required: true,
      type: "integer",
    },
    {
      key: "replies",
      label: "Replies",
      description: "Direct replies to the Snap or Story",
      required: true,
      type: "integer",
    },
    {
      key: "shares",
      label: "Shares",
      description: "Times the content was shared to other users",
      required: false,
      type: "integer",
    },
    {
      key: "sends",
      label: "Sends",
      description: "Times the content was sent directly to friends",
      required: false,
      type: "integer",
    },
    {
      key: "completion_rate",
      label: "Completion Rate",
      description: "Percentage of viewers who watched the full Snap or Story",
      required: false,
      type: "percentage",
    },
    {
      key: "avg_watch_time_seconds",
      label: "Avg Watch Time",
      description: "Average seconds viewers spent on this content",
      required: false,
      type: "decimal",
    },
  ],

  facebook: [
    {
      key: "views",
      label: "Views",
      description: "Total video views (counted after 3 seconds of play time)",
      required: true,
      type: "integer",
    },
    {
      key: "reach",
      label: "Reach",
      description: "Unique accounts that saw this content in their feed",
      required: true,
      type: "integer",
    },
    {
      key: "impressions",
      label: "Impressions",
      description: "Total times this content appeared on screen (includes repeats)",
      required: false,
      type: "integer",
    },
    {
      key: "likes",
      label: "Likes / Reactions",
      description: "Total likes and reactions (love, haha, wow, sad, angry)",
      required: true,
      type: "integer",
    },
    {
      key: "comments",
      label: "Comments",
      description: "Total comments on the post",
      required: true,
      type: "integer",
    },
    {
      key: "shares",
      label: "Shares",
      description: "Times the content was shared to timelines or groups",
      required: true,
      type: "integer",
    },
    {
      key: "clicks",
      label: "Clicks",
      description: "Total clicks on the content, links, or call-to-action",
      required: false,
      type: "integer",
    },
  ],
};

// ---------------------------------------------------------------------------
// Platform-specific notes on how metrics are counted
// ---------------------------------------------------------------------------

export const PLATFORM_METRIC_NOTES: Record<Platform, string> = {
  tiktok:
    "TikTok counts any video play as a view, regardless of duration. " +
    "Completion rate is a key performance signal — it directly affects algorithmic reach.",
  instagram:
    "Instagram distinguishes Reach (unique accounts) from Impressions (total views including repeats). " +
    "Saves and Sends are strong engagement signals that boost algorithmic distribution.",
  youtube:
    "YouTube only counts a view after 30 seconds of watch time (or the full video if shorter). " +
    "Average watch time is the most important metric — it drives recommendations and search ranking.",
  snapchat:
    "Snapchat counts a view after roughly 1 second. " +
    "Screenshots and replies are the primary engagement signals since there are no public likes or comments.",
  facebook:
    "Facebook counts a video view after 3 seconds of play time. " +
    "Reach measures unique viewers while Impressions include repeat exposures to the same user.",
};

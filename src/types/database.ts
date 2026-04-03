// =============================================================================
// Database Type Definitions — maps to Supabase Postgres schema
// =============================================================================

// -----------------------------------------------------------------------------
// Enums
// -----------------------------------------------------------------------------

export type UserRole = 'creator' | 'brand' | 'admin';

export type UserStatus = 'pending' | 'approved' | 'rejected' | 'suspended';

export type CampaignStatus =
  | 'draft'
  | 'recruiting'
  | 'in_progress'
  | 'publishing'
  | 'monitoring'
  | 'completed'
  | 'paused'
  | 'cancelled';

export type ApplicationStatus =
  | 'pending'
  | 'accepted'
  | 'rejected'
  | 'withdrawn'
  | 'counter_offer';

export type SubmissionStatus =
  | 'draft'
  | 'submitted'
  | 'approved'
  | 'revision_requested'
  | 'published';

export type PlatformType =
  | 'tiktok'
  | 'instagram'
  | 'snapchat'
  | 'youtube'
  | 'facebook';

export type NotificationType =
  | 'account_approved'
  | 'account_rejected'
  | 'campaign_match'
  | 'application_received'
  | 'application_accepted'
  | 'application_rejected'
  | 'counter_offer'
  | 'content_submitted'
  | 'content_approved'
  | 'revision_requested'
  | 'new_message'
  | 'campaign_completed'
  | 'review_received'
  | 'content_due_soon'
  | 'payment_sent'
  | 'payment_received'
  | 'tier_upgrade'
  | 'waitlist_approved'
  | 'waitlist_rejected';

export type WaitlistType = 'brand' | 'creator';

export type WaitlistStatus = 'pending' | 'approved' | 'rejected';

export type PaymentStatusType = 'pending' | 'invoiced' | 'paid' | 'overdue';

export type CreatorTier = 'new' | 'rising' | 'established' | 'top';

export type MeasurementType = 'initial_48h' | 'final_7d' | 'extended_30d';

export type NotificationPriority = 'immediate' | 'batched';

export type ComplianceSeverity = 'required' | 'advisory';

export type FunctionExecutionStatus = 'success' | 'error';

export type SocialConnectionStatus = 'active' | 'expired' | 'revoked' | 'error';

export type MetricDataSource = 'manual' | 'api' | 'api_partial';

// -----------------------------------------------------------------------------
// JSONB field types
// -----------------------------------------------------------------------------

/** Social account data stored in creator_profiles platform columns */
export interface SocialAccount {
  url: string;
  handle: string;
  followers: number;
  verified: boolean;
}

/** Rate card: platform -> content_type -> rate in creator's rate_currency */
export type RateCard = Record<string, Record<string, number>>;

/** Audience demographics stored on social_connections */
export interface AudienceDemographicsData {
  ageRanges?: Record<string, number>;
  genderSplit?: Record<string, number>;
  topCountries?: Record<string, number>;
  topCities?: Record<string, number>;
}

/** Translated brief content keyed by language code (ar, fr, ru, kk, uz, tr) */
export type BriefTranslation = Record<
  string,
  {
    description: string;
    requirements: string;
    dos: string;
    donts: string;
  }
>;

// -----------------------------------------------------------------------------
// Table types — Supabase generated-types pattern
// -----------------------------------------------------------------------------

export interface Database {
  public: {
    Tables: {
      profiles: {
        Row: {
          id: string;
          role: UserRole;
          full_name: string;
          avatar_url: string | null;
          email: string;
          status: UserStatus;
          preferred_locale: string | null;
          onboarding_completed: boolean;
          approved_at: string | null;
          approved_by: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id: string;
          role: UserRole;
          full_name: string;
          avatar_url?: string | null;
          email: string;
          status?: UserStatus;
          preferred_locale?: string;
          onboarding_completed?: boolean;
          approved_at?: string | null;
          approved_by?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          role?: UserRole;
          full_name?: string;
          avatar_url?: string | null;
          email?: string;
          status?: UserStatus;
          preferred_locale?: string;
          onboarding_completed?: boolean;
          approved_at?: string | null;
          approved_by?: string | null;
          created_at?: string;
          updated_at?: string;
        };
      };

      creator_profiles: {
        Row: {
          id: string;
          profile_id: string;
          slug: string;
          bio: string | null;
          primary_market: string | null;
          tiktok: SocialAccount | null;
          instagram: SocialAccount | null;
          snapchat: SocialAccount | null;
          youtube: SocialAccount | null;
          facebook: SocialAccount | null;
          platforms: PlatformType[];
          niches: string[];
          markets: string[];
          languages: string[];
          content_formats: string[];
          rate_card: RateCard | null;
          rate_currency: string;
          rating: number;
          review_count: number;
          campaigns_completed: number;
          completion_rate: number;
          avg_response_time_hours: number | null;
          tier: CreatorTier;
          tier_evaluated_at: string | null;
          ranking_score: number;
          total_earned: number;
          profile_completeness: number;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          profile_id: string;
          slug: string;
          bio?: string | null;
          primary_market?: string | null;
          tiktok?: SocialAccount | null;
          instagram?: SocialAccount | null;
          snapchat?: SocialAccount | null;
          youtube?: SocialAccount | null;
          facebook?: SocialAccount | null;
          platforms?: PlatformType[];
          niches?: string[];
          markets?: string[];
          languages?: string[];
          content_formats?: string[];
          rate_card?: RateCard | null;
          rate_currency?: string;
          rating?: number;
          review_count?: number;
          campaigns_completed?: number;
          completion_rate?: number;
          avg_response_time_hours?: number | null;
          tier?: CreatorTier;
          tier_evaluated_at?: string | null;
          ranking_score?: number;
          total_earned?: number;
          profile_completeness?: number;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          profile_id?: string;
          slug?: string;
          bio?: string | null;
          primary_market?: string | null;
          tiktok?: SocialAccount | null;
          instagram?: SocialAccount | null;
          snapchat?: SocialAccount | null;
          youtube?: SocialAccount | null;
          facebook?: SocialAccount | null;
          platforms?: PlatformType[];
          niches?: string[];
          markets?: string[];
          languages?: string[];
          content_formats?: string[];
          rate_card?: RateCard | null;
          rate_currency?: string;
          rating?: number;
          review_count?: number;
          campaigns_completed?: number;
          completion_rate?: number;
          avg_response_time_hours?: number | null;
          tier?: CreatorTier;
          tier_evaluated_at?: string | null;
          ranking_score?: number;
          total_earned?: number;
          profile_completeness?: number;
          created_at?: string;
          updated_at?: string;
        };
      };

      brand_profiles: {
        Row: {
          id: string;
          profile_id: string;
          company_name: string;
          industry: string | null;
          target_markets: string[];
          platforms: string[];
          website: string | null;
          logo_url: string | null;
          description: string | null;
          budget_range: string | null;
          contact_name: string | null;
          contact_email: string | null;
          contact_phone: string | null;
          preferred_language: string;
          rating: number;
          review_count: number;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          profile_id: string;
          company_name: string;
          industry?: string | null;
          target_markets?: string[];
          platforms?: string[];
          website?: string | null;
          logo_url?: string | null;
          description?: string | null;
          budget_range?: string | null;
          contact_name?: string | null;
          contact_email?: string | null;
          contact_phone?: string | null;
          preferred_language?: string;
          rating?: number;
          review_count?: number;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          profile_id?: string;
          company_name?: string;
          industry?: string | null;
          target_markets?: string[];
          platforms?: string[];
          website?: string | null;
          logo_url?: string | null;
          description?: string | null;
          budget_range?: string | null;
          contact_name?: string | null;
          contact_email?: string | null;
          contact_phone?: string | null;
          preferred_language?: string;
          rating?: number;
          review_count?: number;
          created_at?: string;
          updated_at?: string;
        };
      };

      playbooks: {
        Row: {
          id: string;
          name: string;
          description: string | null;
          icon: string | null;
          defaults: Record<string, unknown>;
          published: boolean;
          sort_order: number;
          created_at: string;
        };
        Insert: {
          id?: string;
          name: string;
          description?: string | null;
          icon?: string | null;
          defaults: Record<string, unknown>;
          published?: boolean;
          sort_order?: number;
          created_at?: string;
        };
        Update: {
          id?: string;
          name?: string;
          description?: string | null;
          icon?: string | null;
          defaults?: Record<string, unknown>;
          published?: boolean;
          sort_order?: number;
          created_at?: string;
        };
      };

      campaigns: {
        Row: {
          id: string;
          brand_id: string;
          playbook_id: string | null;
          title: string;
          brief_description: string | null;
          brief_requirements: string | null;
          brief_dos: string | null;
          brief_donts: string | null;
          brief_translated: BriefTranslation | null;
          platforms: PlatformType[];
          markets: string[];
          niches: string[];
          budget_min: number | null;
          budget_max: number | null;
          budget_currency: string;
          max_creators: number | null;
          status: CampaignStatus;
          application_deadline: string | null;
          content_due_date: string | null;
          posting_window_start: string | null;
          posting_window_end: string | null;
          monitoring_end_date: string | null;
          usage_rights_duration: string | null;
          usage_rights_territory: string | null;
          usage_rights_paid_ads: boolean;
          max_revisions: number;
          compliance_notes: string | null;
          report_data: Record<string, unknown> | null;
          target_reach: number | null;
          target_engagement_rate: number | null;
          total_spend: number;
          created_at: string;
          updated_at: string;
          completed_at: string | null;
        };
        Insert: {
          id?: string;
          brand_id: string;
          playbook_id?: string | null;
          title: string;
          brief_description?: string | null;
          brief_requirements?: string | null;
          brief_dos?: string | null;
          brief_donts?: string | null;
          brief_translated?: BriefTranslation | null;
          platforms?: PlatformType[];
          markets?: string[];
          niches?: string[];
          budget_min?: number | null;
          budget_max?: number | null;
          budget_currency?: string;
          max_creators?: number | null;
          status?: CampaignStatus;
          application_deadline?: string | null;
          content_due_date?: string | null;
          posting_window_start?: string | null;
          posting_window_end?: string | null;
          monitoring_end_date?: string | null;
          usage_rights_duration?: string | null;
          usage_rights_territory?: string | null;
          usage_rights_paid_ads?: boolean;
          max_revisions?: number;
          compliance_notes?: string | null;
          report_data?: Record<string, unknown> | null;
          target_reach?: number | null;
          target_engagement_rate?: number | null;
          total_spend?: number;
          created_at?: string;
          updated_at?: string;
          completed_at?: string | null;
        };
        Update: {
          id?: string;
          brand_id?: string;
          playbook_id?: string | null;
          title?: string;
          brief_description?: string | null;
          brief_requirements?: string | null;
          brief_dos?: string | null;
          brief_donts?: string | null;
          brief_translated?: BriefTranslation | null;
          platforms?: PlatformType[];
          markets?: string[];
          niches?: string[];
          budget_min?: number | null;
          budget_max?: number | null;
          budget_currency?: string;
          max_creators?: number | null;
          status?: CampaignStatus;
          application_deadline?: string | null;
          content_due_date?: string | null;
          posting_window_start?: string | null;
          posting_window_end?: string | null;
          monitoring_end_date?: string | null;
          usage_rights_duration?: string | null;
          usage_rights_territory?: string | null;
          usage_rights_paid_ads?: boolean;
          max_revisions?: number;
          compliance_notes?: string | null;
          report_data?: Record<string, unknown> | null;
          target_reach?: number | null;
          target_engagement_rate?: number | null;
          total_spend?: number;
          created_at?: string;
          updated_at?: string;
          completed_at?: string | null;
        };
      };

      campaign_deliverables: {
        Row: {
          id: string;
          campaign_id: string;
          platform: PlatformType;
          content_type: string;
          quantity: number;
          notes: string | null;
          deadline: string | null;
        };
        Insert: {
          id?: string;
          campaign_id: string;
          platform: PlatformType;
          content_type: string;
          quantity?: number;
          notes?: string | null;
          deadline?: string | null;
        };
        Update: {
          id?: string;
          campaign_id?: string;
          platform?: PlatformType;
          content_type?: string;
          quantity?: number;
          notes?: string | null;
          deadline?: string | null;
        };
      };

      campaign_applications: {
        Row: {
          id: string;
          campaign_id: string;
          creator_id: string;
          proposed_rate: number | null;
          pitch: string | null;
          status: ApplicationStatus;
          counter_rate: number | null;
          counter_message: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          campaign_id: string;
          creator_id: string;
          proposed_rate?: number | null;
          pitch?: string | null;
          status?: ApplicationStatus;
          counter_rate?: number | null;
          counter_message?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          campaign_id?: string;
          creator_id?: string;
          proposed_rate?: number | null;
          pitch?: string | null;
          status?: ApplicationStatus;
          counter_rate?: number | null;
          counter_message?: string | null;
          created_at?: string;
          updated_at?: string;
        };
      };

      campaign_members: {
        Row: {
          id: string;
          campaign_id: string;
          creator_id: string;
          accepted_rate: number | null;
          payment_status: PaymentStatusType;
          payment_confirmed_at: string | null;
          joined_at: string;
        };
        Insert: {
          id?: string;
          campaign_id: string;
          creator_id: string;
          accepted_rate?: number | null;
          payment_status?: PaymentStatusType;
          payment_confirmed_at?: string | null;
          joined_at?: string;
        };
        Update: {
          id?: string;
          campaign_id?: string;
          creator_id?: string;
          accepted_rate?: number | null;
          payment_status?: PaymentStatusType;
          payment_confirmed_at?: string | null;
          joined_at?: string;
        };
      };

      content_submissions: {
        Row: {
          id: string;
          campaign_member_id: string;
          deliverable_id: string | null;
          content_url: string | null;
          caption: string | null;
          platform: PlatformType | null;
          status: SubmissionStatus;
          feedback: string | null;
          version: number;
          parent_submission_id: string | null;
          revision_count: number;
          submitted_at: string | null;
          reviewed_at: string | null;
          published_at: string | null;
          published_url: string | null;
          platform_post_id: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          campaign_member_id: string;
          deliverable_id?: string | null;
          content_url?: string | null;
          caption?: string | null;
          platform?: PlatformType | null;
          status?: SubmissionStatus;
          feedback?: string | null;
          version?: number;
          parent_submission_id?: string | null;
          revision_count?: number;
          submitted_at?: string | null;
          reviewed_at?: string | null;
          published_at?: string | null;
          published_url?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          campaign_member_id?: string;
          deliverable_id?: string | null;
          content_url?: string | null;
          caption?: string | null;
          platform?: PlatformType | null;
          status?: SubmissionStatus;
          feedback?: string | null;
          version?: number;
          parent_submission_id?: string | null;
          revision_count?: number;
          submitted_at?: string | null;
          reviewed_at?: string | null;
          published_at?: string | null;
          published_url?: string | null;
          created_at?: string;
          updated_at?: string;
        };
      };

      content_performance: {
        Row: {
          id: string;
          submission_id: string;
          measurement_type: MeasurementType;
          views: number | null;
          reach: number | null;
          impressions: number | null;
          likes: number | null;
          reactions: Record<string, number> | null;
          comments: number | null;
          shares: number | null;
          saves: number | null;
          sends: number | null;
          screenshots: number | null;
          replies: number | null;
          clicks: number | null;
          completion_rate: number | null;
          avg_watch_time_seconds: number | null;
          subscriber_gains: number | null;
          screenshot_url: string | null;
          data_source: MetricDataSource;
          reported_at: string;
          created_at: string;
        };
        Insert: {
          id?: string;
          submission_id: string;
          measurement_type: MeasurementType;
          views?: number | null;
          reach?: number | null;
          impressions?: number | null;
          likes?: number | null;
          reactions?: Record<string, number> | null;
          comments?: number | null;
          shares?: number | null;
          saves?: number | null;
          sends?: number | null;
          screenshots?: number | null;
          replies?: number | null;
          clicks?: number | null;
          completion_rate?: number | null;
          avg_watch_time_seconds?: number | null;
          subscriber_gains?: number | null;
          screenshot_url?: string | null;
          data_source?: MetricDataSource;
          reported_at: string;
          created_at?: string;
        };
        Update: {
          id?: string;
          submission_id?: string;
          measurement_type?: MeasurementType;
          views?: number | null;
          reach?: number | null;
          impressions?: number | null;
          likes?: number | null;
          reactions?: Record<string, number> | null;
          comments?: number | null;
          shares?: number | null;
          saves?: number | null;
          sends?: number | null;
          screenshots?: number | null;
          replies?: number | null;
          clicks?: number | null;
          completion_rate?: number | null;
          avg_watch_time_seconds?: number | null;
          subscriber_gains?: number | null;
          screenshot_url?: string | null;
          data_source?: MetricDataSource;
          reported_at?: string;
          created_at?: string;
        };
      };

      social_connections: {
        Row: {
          id: string;
          profile_id: string;
          platform: PlatformType;
          platform_user_id: string;
          platform_username: string | null;
          platform_display_name: string | null;
          platform_avatar_url: string | null;
          access_token_encrypted: string;
          refresh_token_encrypted: string | null;
          token_expires_at: string | null;
          scopes: string[];
          status: SocialConnectionStatus;
          error_message: string | null;
          last_refreshed_at: string | null;
          refresh_failures: number;
          followers_count: number | null;
          followers_updated_at: string | null;
          audience_demographics: AudienceDemographicsData | null;
          audience_demographics_updated_at: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          profile_id: string;
          platform: PlatformType;
          platform_user_id: string;
          platform_username?: string | null;
          platform_display_name?: string | null;
          platform_avatar_url?: string | null;
          access_token_encrypted: string;
          refresh_token_encrypted?: string | null;
          token_expires_at?: string | null;
          scopes?: string[];
          status?: SocialConnectionStatus;
          error_message?: string | null;
          last_refreshed_at?: string | null;
          refresh_failures?: number;
          followers_count?: number | null;
          followers_updated_at?: string | null;
          audience_demographics?: AudienceDemographicsData | null;
          audience_demographics_updated_at?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          profile_id?: string;
          platform?: PlatformType;
          platform_user_id?: string;
          platform_username?: string | null;
          platform_display_name?: string | null;
          platform_avatar_url?: string | null;
          access_token_encrypted?: string;
          refresh_token_encrypted?: string | null;
          token_expires_at?: string | null;
          scopes?: string[];
          status?: SocialConnectionStatus;
          error_message?: string | null;
          last_refreshed_at?: string | null;
          refresh_failures?: number;
          followers_count?: number | null;
          followers_updated_at?: string | null;
          audience_demographics?: AudienceDemographicsData | null;
          audience_demographics_updated_at?: string | null;
          created_at?: string;
          updated_at?: string;
        };
      };

      campaign_messages: {
        Row: {
          id: string;
          campaign_id: string;
          sender_id: string;
          content: string;
          created_at: string;
        };
        Insert: {
          id?: string;
          campaign_id: string;
          sender_id: string;
          content: string;
          created_at?: string;
        };
        Update: {
          id?: string;
          campaign_id?: string;
          sender_id?: string;
          content?: string;
          created_at?: string;
        };
      };

      reviews: {
        Row: {
          id: string;
          campaign_id: string;
          reviewer_id: string;
          reviewee_id: string;
          rating: number;
          comment: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          campaign_id: string;
          reviewer_id: string;
          reviewee_id: string;
          rating: number;
          comment?: string | null;
          created_at?: string;
        };
        Update: {
          id?: string;
          campaign_id?: string;
          reviewer_id?: string;
          reviewee_id?: string;
          rating?: number;
          comment?: string | null;
          created_at?: string;
        };
      };

      notifications: {
        Row: {
          id: string;
          user_id: string;
          type: NotificationType;
          title: string;
          body: string | null;
          read: boolean;
          data: Record<string, unknown> | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          type: NotificationType;
          title: string;
          body?: string | null;
          read?: boolean;
          data?: Record<string, unknown> | null;
          created_at?: string;
        };
        Update: {
          id?: string;
          user_id?: string;
          type?: NotificationType;
          title?: string;
          body?: string | null;
          read?: boolean;
          data?: Record<string, unknown> | null;
          created_at?: string;
        };
      };

      notification_queue: {
        Row: {
          id: string;
          notification_id: string | null;
          email: string;
          template: string;
          data: Record<string, unknown> | null;
          priority: NotificationPriority;
          processed_at: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          notification_id?: string | null;
          email: string;
          template: string;
          data?: Record<string, unknown> | null;
          priority: NotificationPriority;
          processed_at?: string | null;
          created_at?: string;
        };
        Update: {
          id?: string;
          notification_id?: string | null;
          email?: string;
          template?: string;
          data?: Record<string, unknown> | null;
          priority?: NotificationPriority;
          processed_at?: string | null;
          created_at?: string;
        };
      };

      market_benchmarks: {
        Row: {
          id: string;
          market: string;
          platform: PlatformType;
          content_format: string;
          follower_tier: CreatorTier;
          niche: string;
          avg_engagement_rate: number | null;
          avg_views: number | null;
          avg_cpe: number | null;
          avg_rate_usd: number | null;
          p25_rate: number | null;
          p75_rate: number | null;
          sample_size: number;
          updated_at: string;
        };
        Insert: {
          id?: string;
          market: string;
          platform: PlatformType;
          content_format: string;
          follower_tier: CreatorTier;
          niche: string;
          avg_engagement_rate?: number | null;
          avg_views?: number | null;
          avg_cpe?: number | null;
          avg_rate_usd?: number | null;
          p25_rate?: number | null;
          p75_rate?: number | null;
          sample_size?: number;
          updated_at?: string;
        };
        Update: {
          id?: string;
          market?: string;
          platform?: PlatformType;
          content_format?: string;
          follower_tier?: CreatorTier;
          niche?: string;
          avg_engagement_rate?: number | null;
          avg_views?: number | null;
          avg_cpe?: number | null;
          avg_rate_usd?: number | null;
          p25_rate?: number | null;
          p75_rate?: number | null;
          sample_size?: number;
          updated_at?: string;
        };
      };

      cultural_calendar: {
        Row: {
          id: string;
          market: string;
          event_name: string;
          start_date: string;
          end_date: string;
          marketing_notes: string | null;
          year: number;
        };
        Insert: {
          id?: string;
          market: string;
          event_name: string;
          start_date: string;
          end_date: string;
          marketing_notes?: string | null;
          year: number;
        };
        Update: {
          id?: string;
          market?: string;
          event_name?: string;
          start_date?: string;
          end_date?: string;
          marketing_notes?: string | null;
          year?: number;
        };
      };

      market_compliance: {
        Row: {
          id: string;
          market: string;
          requirement_title: string;
          description: string | null;
          severity: ComplianceSeverity;
          registration_url: string | null;
          updated_at: string;
        };
        Insert: {
          id?: string;
          market: string;
          requirement_title: string;
          description?: string | null;
          severity: ComplianceSeverity;
          registration_url?: string | null;
          updated_at?: string;
        };
        Update: {
          id?: string;
          market?: string;
          requirement_title?: string;
          description?: string | null;
          severity?: ComplianceSeverity;
          registration_url?: string | null;
          updated_at?: string;
        };
      };

      function_execution_log: {
        Row: {
          id: string;
          function_name: string;
          status: FunctionExecutionStatus;
          duration_ms: number | null;
          error_message: string | null;
          payload: Record<string, unknown> | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          function_name: string;
          status: FunctionExecutionStatus;
          duration_ms?: number | null;
          error_message?: string | null;
          payload?: Record<string, unknown> | null;
          created_at?: string;
        };
        Update: {
          id?: string;
          function_name?: string;
          status?: FunctionExecutionStatus;
          duration_ms?: number | null;
          error_message?: string | null;
          payload?: Record<string, unknown> | null;
          created_at?: string;
        };
      };

      waitlist: {
        Row: {
          id: string;
          type: WaitlistType;
          email: string;
          full_name: string;
          company_name: string | null;
          industry: string | null;
          website: string | null;
          budget_range: string | null;
          social_url: string | null;
          social_platform: PlatformType | null;
          follower_range: string | null;
          markets: string[];
          reason: string | null;
          referral_source: string | null;
          status: WaitlistStatus;
          reviewed_by: string | null;
          reviewed_at: string | null;
          rejection_reason: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          type: WaitlistType;
          email: string;
          full_name: string;
          company_name?: string | null;
          industry?: string | null;
          website?: string | null;
          budget_range?: string | null;
          social_url?: string | null;
          social_platform?: PlatformType | null;
          follower_range?: string | null;
          markets?: string[];
          reason?: string | null;
          referral_source?: string | null;
          status?: WaitlistStatus;
          reviewed_by?: string | null;
          reviewed_at?: string | null;
          rejection_reason?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          type?: WaitlistType;
          email?: string;
          full_name?: string;
          company_name?: string | null;
          industry?: string | null;
          website?: string | null;
          budget_range?: string | null;
          social_url?: string | null;
          social_platform?: PlatformType | null;
          follower_range?: string | null;
          markets?: string[];
          reason?: string | null;
          referral_source?: string | null;
          status?: WaitlistStatus;
          reviewed_by?: string | null;
          reviewed_at?: string | null;
          rejection_reason?: string | null;
          created_at?: string;
          updated_at?: string;
        };
      };
    };

    Enums: {
      user_role: UserRole;
      user_status: UserStatus;
      campaign_status: CampaignStatus;
      application_status: ApplicationStatus;
      submission_status: SubmissionStatus;
      platform_type: PlatformType;
      notification_type: NotificationType;
      payment_status_type: PaymentStatusType;
      creator_tier: CreatorTier;
      measurement_type: MeasurementType;
      waitlist_type: WaitlistType;
      waitlist_status: WaitlistStatus;
    };
  };
}

// -----------------------------------------------------------------------------
// Convenience aliases — Row types
// -----------------------------------------------------------------------------

export type Profile = Database['public']['Tables']['profiles']['Row'];
export type CreatorProfile = Database['public']['Tables']['creator_profiles']['Row'];
export type BrandProfile = Database['public']['Tables']['brand_profiles']['Row'];
export type Playbook = Database['public']['Tables']['playbooks']['Row'];
export type Campaign = Database['public']['Tables']['campaigns']['Row'];
export type CampaignDeliverable = Database['public']['Tables']['campaign_deliverables']['Row'];
export type CampaignApplication = Database['public']['Tables']['campaign_applications']['Row'];
export type CampaignMember = Database['public']['Tables']['campaign_members']['Row'];
export type ContentSubmission = Database['public']['Tables']['content_submissions']['Row'];
export type ContentPerformance = Database['public']['Tables']['content_performance']['Row'];
export type CampaignMessage = Database['public']['Tables']['campaign_messages']['Row'];
export type Review = Database['public']['Tables']['reviews']['Row'];
export type Notification = Database['public']['Tables']['notifications']['Row'];
export type NotificationQueueItem = Database['public']['Tables']['notification_queue']['Row'];
export type MarketBenchmark = Database['public']['Tables']['market_benchmarks']['Row'];
export type CulturalCalendarEvent = Database['public']['Tables']['cultural_calendar']['Row'];
export type MarketCompliance = Database['public']['Tables']['market_compliance']['Row'];
export type FunctionExecutionLog = Database['public']['Tables']['function_execution_log']['Row'];
export type Waitlist = Database['public']['Tables']['waitlist']['Row'];

// -----------------------------------------------------------------------------
// Convenience aliases — Insert types
// -----------------------------------------------------------------------------

export type ProfileInsert = Database['public']['Tables']['profiles']['Insert'];
export type CreatorProfileInsert = Database['public']['Tables']['creator_profiles']['Insert'];
export type BrandProfileInsert = Database['public']['Tables']['brand_profiles']['Insert'];
export type PlaybookInsert = Database['public']['Tables']['playbooks']['Insert'];
export type CampaignInsert = Database['public']['Tables']['campaigns']['Insert'];
export type CampaignDeliverableInsert = Database['public']['Tables']['campaign_deliverables']['Insert'];
export type CampaignApplicationInsert = Database['public']['Tables']['campaign_applications']['Insert'];
export type CampaignMemberInsert = Database['public']['Tables']['campaign_members']['Insert'];
export type ContentSubmissionInsert = Database['public']['Tables']['content_submissions']['Insert'];
export type ContentPerformanceInsert = Database['public']['Tables']['content_performance']['Insert'];
export type CampaignMessageInsert = Database['public']['Tables']['campaign_messages']['Insert'];
export type ReviewInsert = Database['public']['Tables']['reviews']['Insert'];
export type NotificationInsert = Database['public']['Tables']['notifications']['Insert'];
export type NotificationQueueItemInsert = Database['public']['Tables']['notification_queue']['Insert'];
export type MarketBenchmarkInsert = Database['public']['Tables']['market_benchmarks']['Insert'];
export type CulturalCalendarEventInsert = Database['public']['Tables']['cultural_calendar']['Insert'];
export type MarketComplianceInsert = Database['public']['Tables']['market_compliance']['Insert'];
export type FunctionExecutionLogInsert = Database['public']['Tables']['function_execution_log']['Insert'];
export type WaitlistInsert = Database['public']['Tables']['waitlist']['Insert'];

// -----------------------------------------------------------------------------
// Convenience aliases — Update types
// -----------------------------------------------------------------------------

export type ProfileUpdate = Database['public']['Tables']['profiles']['Update'];
export type CreatorProfileUpdate = Database['public']['Tables']['creator_profiles']['Update'];
export type BrandProfileUpdate = Database['public']['Tables']['brand_profiles']['Update'];
export type PlaybookUpdate = Database['public']['Tables']['playbooks']['Update'];
export type CampaignUpdate = Database['public']['Tables']['campaigns']['Update'];
export type CampaignDeliverableUpdate = Database['public']['Tables']['campaign_deliverables']['Update'];
export type CampaignApplicationUpdate = Database['public']['Tables']['campaign_applications']['Update'];
export type CampaignMemberUpdate = Database['public']['Tables']['campaign_members']['Update'];
export type ContentSubmissionUpdate = Database['public']['Tables']['content_submissions']['Update'];
export type ContentPerformanceUpdate = Database['public']['Tables']['content_performance']['Update'];
export type CampaignMessageUpdate = Database['public']['Tables']['campaign_messages']['Update'];
export type ReviewUpdate = Database['public']['Tables']['reviews']['Update'];
export type NotificationUpdate = Database['public']['Tables']['notifications']['Update'];
export type NotificationQueueItemUpdate = Database['public']['Tables']['notification_queue']['Update'];
export type MarketBenchmarkUpdate = Database['public']['Tables']['market_benchmarks']['Update'];
export type CulturalCalendarEventUpdate = Database['public']['Tables']['cultural_calendar']['Update'];
export type MarketComplianceUpdate = Database['public']['Tables']['market_compliance']['Update'];
export type FunctionExecutionLogUpdate = Database['public']['Tables']['function_execution_log']['Update'];
export type WaitlistUpdate = Database['public']['Tables']['waitlist']['Update'];

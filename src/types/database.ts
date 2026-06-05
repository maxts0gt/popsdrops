// =============================================================================
// Database Type Definitions - maps to Supabase Postgres schema
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

export type CampaignModeType = 'private' | 'sourced';

export type CampaignRecruitmentVisibility =
  | 'private_invite'
  | 'shortlist_invite'
  | 'open_applications';

export type CampaignResponsibilityKind =
  | 'owner'
  | 'approvals'
  | 'reporting'
  | 'billing';

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
  | 'account_suspended'
  | 'account_restored'
  | 'account_review_reopened'
  | 'campaign_match'
  | 'campaign_paused'
  | 'campaign_cancelled'
  | 'application_received'
  | 'application_accepted'
  | 'application_rejected'
  | 'counter_offer'
  | 'content_submitted'
  | 'content_approved'
  | 'revision_requested'
  | 'campaign_update'
  | 'campaign_completed'
  | 'review_received'
  | 'content_due_soon'
  | 'payment_sent'
  | 'payment_received'
  | 'tier_upgrade'
  | 'waitlist_approved'
  | 'waitlist_rejected'
  | 'report_correction_requested'
  | 'report_ready_for_review'
  | 'report_correction_resubmitted'
  | 'report_follow_up_requested'
  | 'data_deletion_scheduled'
  | 'data_deletion_completed'
  | 'data_export_ready'
  | 'privacy_request_denied';

export type WaitlistType = 'brand' | 'creator';

export type WaitlistStatus = 'pending' | 'approved' | 'rejected';

export type BrandTeamRole = 'owner' | 'admin' | 'manager' | 'viewer';

export type BrandTeamInvitationStatus =
  | 'pending'
  | 'accepted'
  | 'revoked'
  | 'expired';

export type LegalConsentSource =
  | 'login'
  | 'request_invite'
  | 'settings'
  | 'policy_update';

export type LegalConsentType =
  | 'terms_privacy_retention'
  | 'privacy_request';

export type DataRightsRequestType = 'export' | 'deletion' | 'correction';

export type DataRightsRequestStatus =
  | 'pending'
  | 'scheduled'
  | 'reviewing'
  | 'processing'
  | 'completed'
  | 'failed'
  | 'rejected'
  | 'cancelled';

export type PaymentStatusType =
  | 'pending'
  | 'invoiced'
  | 'paid'
  | 'overdue'
  | 'failed'
  | 'refunded'
  | 'disputed';

export type CreatorTier = 'new' | 'rising' | 'established' | 'top';

export type MeasurementType = 'initial_48h' | 'final_7d' | 'extended_30d';

export type NotificationPriority = 'immediate' | 'batched';

export type NotificationQueueStatus =
  | 'pending'
  | 'sent'
  | 'failed'
  | 'unsupported'
  | 'skipped'
  | 'archived';

export type ComplianceSeverity = 'required' | 'advisory';

export type FunctionExecutionStatus = 'success' | 'error';

export type CampaignBriefBlockType =
  | 'product_notes'
  | 'brand_vibe'
  | 'talking_points'
  | 'avoid_claims'
  | 'cta'
  | 'hashtags'
  | 'examples'
  | 'custom';

export type CampaignBriefVisibility = 'public' | 'member' | 'brand';

export type CampaignAssetType =
  | 'product_image'
  | 'brand_guideline'
  | 'reference_video'
  | 'sell_sheet'
  | 'logo'
  | 'document'
  | 'other';

export type CampaignAssetVisibility = 'public' | 'member' | 'brand';

export type CampaignAssetStatus = 'uploading' | 'ready' | 'archived';

export type CampaignReportingCadence =
  | 'final_only'
  | 'weekly'
  | 'daily_launch_window'
  | 'custom'
  | 'per_post';

export type CampaignReportTaskStatus =
  | 'pending'
  | 'submitted'
  | 'submitted_late'
  | 'verified'
  | 'needs_revision'
  | 'missed'
  | 'excused';

export type CampaignAgreementStatus = 'draft' | 'published' | 'archived';

export type CampaignAgreementGateMode =
  | 'rules_acknowledgement'
  | 'typed_signature'
  | 'brand_agreement'
  | 'rules_and_brand_agreement';

export type CampaignAgreementMemberStatus =
  | 'not_required'
  | 'pending'
  | 'signed'
  | 'needs_reacceptance';

export type PerformanceVerificationStatus =
  | 'submitted'
  | 'screenshot_verified'
  | 'brand_verified'
  | 'rejected';

export type PerformanceEvidenceType =
  | 'screenshot'
  | 'csv'
  | 'analytics_export'
  | 'document'
  | 'other';

export type PerformanceEvidenceVerificationStatus =
  | 'submitted'
  | 'verified'
  | 'rejected';

export type ReportingPlatform =
  | 'instagram'
  | 'tiktok'
  | 'youtube'
  | 'facebook'
  | 'snapchat'
  | 'x'
  | 'generic';

export type ReportingFieldType =
  | 'integer'
  | 'decimal'
  | 'percentage'
  | 'duration_seconds'
  | 'currency'
  | 'text';

export type ReportingEvidenceScope =
  | 'public'
  | 'native_insights'
  | 'brand_defined';

export type ReportingAccountRequirement =
  | 'public_post_ok'
  | 'native_insights_required'
  | 'business_or_creator_account_required'
  | 'brand_defined';

export type ReportingMetricSourceType =
  | 'creator_manual'
  | 'ai_extracted'
  | 'creator_confirmed'
  | 'brand_verified'
  | 'platform_api';

export type PerformanceAiExtractionStatus =
  | 'pending_confirmation'
  | 'accepted_by_creator'
  | 'edited_by_creator'
  | 'rejected_by_creator'
  | 'superseded';

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
// Table types - Supabase generated-types pattern
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

      legal_consents: {
        Row: {
          id: string;
          profile_id: string | null;
          email: string | null;
          consent_type: LegalConsentType;
          source: LegalConsentSource;
          terms_version: string;
          privacy_version: string;
          retention_version: string;
          locale: string;
          ip_hash: string | null;
          user_agent_hash: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          profile_id?: string | null;
          email?: string | null;
          consent_type?: LegalConsentType;
          source: LegalConsentSource;
          terms_version: string;
          privacy_version: string;
          retention_version: string;
          locale?: string;
          ip_hash?: string | null;
          user_agent_hash?: string | null;
          created_at?: string;
        };
        Update: {
          id?: string;
          profile_id?: string | null;
          email?: string | null;
          consent_type?: LegalConsentType;
          source?: LegalConsentSource;
          terms_version?: string;
          privacy_version?: string;
          retention_version?: string;
          locale?: string;
          ip_hash?: string | null;
          user_agent_hash?: string | null;
          created_at?: string;
        };
      };

      data_rights_requests: {
        Row: {
          id: string;
          profile_id: string;
          email: string;
          request_type: DataRightsRequestType;
          status: DataRightsRequestStatus;
          details: string | null;
          retention_note: string | null;
          scheduled_for: string | null;
          verification_due_at: string | null;
          reviewed_by: string | null;
          reviewed_at: string | null;
          processed_at: string | null;
          processing_error: string | null;
          completed_at: string | null;
          export_storage_bucket: string;
          export_storage_path: string | null;
          export_file_name: string | null;
          export_mime_type: string | null;
          export_expires_at: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          profile_id: string;
          email: string;
          request_type: DataRightsRequestType;
          status?: DataRightsRequestStatus;
          details?: string | null;
          retention_note?: string | null;
          scheduled_for?: string | null;
          verification_due_at?: string | null;
          reviewed_by?: string | null;
          reviewed_at?: string | null;
          processed_at?: string | null;
          processing_error?: string | null;
          completed_at?: string | null;
          export_storage_bucket?: string;
          export_storage_path?: string | null;
          export_file_name?: string | null;
          export_mime_type?: string | null;
          export_expires_at?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          profile_id?: string;
          email?: string;
          request_type?: DataRightsRequestType;
          status?: DataRightsRequestStatus;
          details?: string | null;
          retention_note?: string | null;
          scheduled_for?: string | null;
          verification_due_at?: string | null;
          reviewed_by?: string | null;
          reviewed_at?: string | null;
          processed_at?: string | null;
          processing_error?: string | null;
          completed_at?: string | null;
          export_storage_bucket?: string;
          export_storage_path?: string | null;
          export_file_name?: string | null;
          export_mime_type?: string | null;
          export_expires_at?: string | null;
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

      brand_team_members: {
        Row: {
          id: string;
          brand_id: string;
          user_id: string;
          role: BrandTeamRole;
          invited_by: string | null;
          accepted_at: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          brand_id: string;
          user_id: string;
          role?: BrandTeamRole;
          invited_by?: string | null;
          accepted_at?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          brand_id?: string;
          user_id?: string;
          role?: BrandTeamRole;
          invited_by?: string | null;
          accepted_at?: string | null;
          created_at?: string;
          updated_at?: string;
        };
      };

      brand_team_invitations: {
        Row: {
          id: string;
          brand_id: string;
          email: string;
          role: BrandTeamRole;
          status: BrandTeamInvitationStatus;
          invited_by: string;
          invited_at: string;
          expires_at: string;
          revoked_at: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          brand_id: string;
          email: string;
          role?: BrandTeamRole;
          status?: BrandTeamInvitationStatus;
          invited_by: string;
          invited_at?: string;
          expires_at?: string;
          revoked_at?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          brand_id?: string;
          email?: string;
          role?: BrandTeamRole;
          status?: BrandTeamInvitationStatus;
          invited_by?: string;
          invited_at?: string;
          expires_at?: string;
          revoked_at?: string | null;
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
          campaign_mode: CampaignModeType;
          recruitment_visibility: CampaignRecruitmentVisibility;
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
          creator_sourcing_required: boolean;
          service_fee_cents: number;
          service_fee_currency: string;
          service_fee_status: PaymentStatusType;
          service_fee_checkout_session_id: string | null;
          service_fee_payment_intent_id: string | null;
          service_fee_charge_id: string | null;
          service_fee_paid_at: string | null;
          service_fee_failed_at: string | null;
          service_fee_refunded_at: string | null;
          service_fee_disputed_at: string | null;
          service_fee_last_event_id: string | null;
          service_fee_last_event_type: string | null;
          service_fee_last_event_at: string | null;
          service_package_snapshot: Record<string, unknown>;
          status: CampaignStatus;
          application_deadline: string | null;
          content_due_date: string | null;
          performance_due_date: string | null;
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
          campaign_mode?: CampaignModeType;
          recruitment_visibility?: CampaignRecruitmentVisibility;
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
          creator_sourcing_required?: boolean;
          service_fee_cents?: number;
          service_fee_currency?: string;
          service_fee_status?: PaymentStatusType;
          service_fee_checkout_session_id?: string | null;
          service_fee_payment_intent_id?: string | null;
          service_fee_charge_id?: string | null;
          service_fee_paid_at?: string | null;
          service_fee_failed_at?: string | null;
          service_fee_refunded_at?: string | null;
          service_fee_disputed_at?: string | null;
          service_fee_last_event_id?: string | null;
          service_fee_last_event_type?: string | null;
          service_fee_last_event_at?: string | null;
          service_package_snapshot?: Record<string, unknown>;
          status?: CampaignStatus;
          application_deadline?: string | null;
          content_due_date?: string | null;
          performance_due_date?: string | null;
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
          campaign_mode?: CampaignModeType;
          recruitment_visibility?: CampaignRecruitmentVisibility;
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
          creator_sourcing_required?: boolean;
          service_fee_cents?: number;
          service_fee_currency?: string;
          service_fee_status?: PaymentStatusType;
          service_fee_checkout_session_id?: string | null;
          service_fee_payment_intent_id?: string | null;
          service_fee_charge_id?: string | null;
          service_fee_paid_at?: string | null;
          service_fee_failed_at?: string | null;
          service_fee_refunded_at?: string | null;
          service_fee_disputed_at?: string | null;
          service_fee_last_event_id?: string | null;
          service_fee_last_event_type?: string | null;
          service_fee_last_event_at?: string | null;
          service_package_snapshot?: Record<string, unknown>;
          status?: CampaignStatus;
          application_deadline?: string | null;
          content_due_date?: string | null;
          performance_due_date?: string | null;
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

      campaign_payment_events: {
        Row: {
          id: string;
          campaign_id: string;
          provider: string;
          event_id: string;
          event_type: string;
          service_fee_status: PaymentStatusType | null;
          checkout_session_id: string | null;
          payment_intent_id: string | null;
          charge_id: string | null;
          amount_cents: number | null;
          currency: string | null;
          event_summary: Record<string, unknown>;
          received_at: string;
        };
        Insert: {
          id?: string;
          campaign_id: string;
          provider?: string;
          event_id: string;
          event_type: string;
          service_fee_status?: PaymentStatusType | null;
          checkout_session_id?: string | null;
          payment_intent_id?: string | null;
          charge_id?: string | null;
          amount_cents?: number | null;
          currency?: string | null;
          event_summary?: Record<string, unknown>;
          received_at?: string;
        };
        Update: {
          id?: string;
          campaign_id?: string;
          provider?: string;
          event_id?: string;
          event_type?: string;
          service_fee_status?: PaymentStatusType | null;
          checkout_session_id?: string | null;
          payment_intent_id?: string | null;
          charge_id?: string | null;
          amount_cents?: number | null;
          currency?: string | null;
          event_summary?: Record<string, unknown>;
          received_at?: string;
        };
      };

      enterprise_concierge_requests: {
        Row: {
          id: string;
          brand_id: string;
          campaign_title: string;
          campaign_mode: CampaignModeType;
          requested_creator_count: number;
          market_count: number;
          markets: string[];
          platforms: string[];
          creator_budget_cents: number;
          product_value_cents: number;
          fulfillment_budget_cents: number;
          service_estimate: Record<string, unknown>;
          note: string | null;
          status: string;
          quoted_service_fee_cents: number | null;
          quoted_service_fee_currency: string;
          quote_note: string | null;
          quoted_at: string | null;
          reviewed_by: string | null;
          reviewed_at: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          brand_id: string;
          campaign_title: string;
          campaign_mode?: CampaignModeType;
          requested_creator_count: number;
          market_count: number;
          markets?: string[];
          platforms?: string[];
          creator_budget_cents?: number;
          product_value_cents?: number;
          fulfillment_budget_cents?: number;
          service_estimate: Record<string, unknown>;
          note?: string | null;
          status?: string;
          quoted_service_fee_cents?: number | null;
          quoted_service_fee_currency?: string;
          quote_note?: string | null;
          quoted_at?: string | null;
          reviewed_by?: string | null;
          reviewed_at?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          brand_id?: string;
          campaign_title?: string;
          campaign_mode?: CampaignModeType;
          requested_creator_count?: number;
          market_count?: number;
          markets?: string[];
          platforms?: string[];
          creator_budget_cents?: number;
          product_value_cents?: number;
          fulfillment_budget_cents?: number;
          service_estimate?: Record<string, unknown>;
          note?: string | null;
          status?: string;
          quoted_service_fee_cents?: number | null;
          quoted_service_fee_currency?: string;
          quote_note?: string | null;
          quoted_at?: string | null;
          reviewed_by?: string | null;
          reviewed_at?: string | null;
          created_at?: string;
          updated_at?: string;
        };
      };

      campaign_responsibility_assignments: {
        Row: {
          id: string;
          campaign_id: string;
          brand_team_member_id: string;
          responsibility: CampaignResponsibilityKind;
          assigned_by: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          campaign_id: string;
          brand_team_member_id: string;
          responsibility: CampaignResponsibilityKind;
          assigned_by?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          campaign_id?: string;
          brand_team_member_id?: string;
          responsibility?: CampaignResponsibilityKind;
          assigned_by?: string | null;
          created_at?: string;
          updated_at?: string;
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

      campaign_creator_invites: {
        Row: {
          id: string;
          campaign_id: string;
          contact_type: 'email' | 'handle';
          contact_value: string;
          normalized_contact: string;
          status: 'manual' | 'queued' | 'sent' | 'failed';
          queued_email_id: string | null;
          invited_by: string;
          invited_at: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          campaign_id: string;
          contact_type: 'email' | 'handle';
          contact_value: string;
          normalized_contact: string;
          status?: 'manual' | 'queued' | 'sent' | 'failed';
          queued_email_id?: string | null;
          invited_by: string;
          invited_at?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          campaign_id?: string;
          contact_type?: 'email' | 'handle';
          contact_value?: string;
          normalized_contact?: string;
          status?: 'manual' | 'queued' | 'sent' | 'failed';
          queued_email_id?: string | null;
          invited_by?: string;
          invited_at?: string | null;
          created_at?: string;
          updated_at?: string;
        };
      };

      campaign_agreements: {
        Row: {
          id: string;
          campaign_id: string;
          created_by: string;
          version: number;
          status: CampaignAgreementStatus;
          gate_mode: CampaignAgreementGateMode;
          title: string;
          rules: Record<string, unknown>;
          agreement_body: string | null;
          preview_enabled: boolean;
          preview_summary: Record<string, unknown>;
          file_bucket: 'campaign-agreements' | null;
          file_path: string | null;
          file_name: string | null;
          file_mime_type: 'application/pdf' | null;
          file_size_bytes: number | null;
          file_sha256: string | null;
          content_hash: string;
          requires_typed_name: boolean;
          requires_reacceptance: boolean;
          published_at: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          campaign_id: string;
          created_by: string;
          version: number;
          status?: CampaignAgreementStatus;
          gate_mode: CampaignAgreementGateMode;
          title: string;
          rules?: Record<string, unknown>;
          agreement_body?: string | null;
          preview_enabled?: boolean;
          preview_summary?: Record<string, unknown>;
          file_bucket?: 'campaign-agreements' | null;
          file_path?: string | null;
          file_name?: string | null;
          file_mime_type?: 'application/pdf' | null;
          file_size_bytes?: number | null;
          file_sha256?: string | null;
          content_hash: string;
          requires_typed_name?: boolean;
          requires_reacceptance?: boolean;
          published_at?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          campaign_id?: string;
          created_by?: string;
          version?: number;
          status?: CampaignAgreementStatus;
          gate_mode?: CampaignAgreementGateMode;
          title?: string;
          rules?: Record<string, unknown>;
          agreement_body?: string | null;
          preview_enabled?: boolean;
          preview_summary?: Record<string, unknown>;
          file_bucket?: 'campaign-agreements' | null;
          file_path?: string | null;
          file_name?: string | null;
          file_mime_type?: 'application/pdf' | null;
          file_size_bytes?: number | null;
          file_sha256?: string | null;
          content_hash?: string;
          requires_typed_name?: boolean;
          requires_reacceptance?: boolean;
          published_at?: string | null;
          created_at?: string;
          updated_at?: string;
        };
      };

      campaign_agreement_acceptances: {
        Row: {
          id: string;
          agreement_id: string;
          campaign_id: string;
          campaign_member_id: string;
          application_id: string | null;
          creator_id: string;
          typed_name: string;
          accepted_rules: Record<string, unknown>;
          accepted_content_hash: string;
          accepted_version: number;
          ip_hash: string | null;
          user_agent: string | null;
          accepted_at: string;
          revoked_at: string | null;
        };
        Insert: {
          id?: string;
          agreement_id: string;
          campaign_id: string;
          campaign_member_id: string;
          application_id?: string | null;
          creator_id: string;
          typed_name: string;
          accepted_rules?: Record<string, unknown>;
          accepted_content_hash: string;
          accepted_version: number;
          ip_hash?: string | null;
          user_agent?: string | null;
          accepted_at?: string;
          revoked_at?: string | null;
        };
        Update: {
          id?: string;
          agreement_id?: string;
          campaign_id?: string;
          campaign_member_id?: string;
          application_id?: string | null;
          creator_id?: string;
          typed_name?: string;
          accepted_rules?: Record<string, unknown>;
          accepted_content_hash?: string;
          accepted_version?: number;
          ip_hash?: string | null;
          user_agent?: string | null;
          accepted_at?: string;
          revoked_at?: string | null;
        };
      };

      campaign_brief_blocks: {
        Row: {
          id: string;
          campaign_id: string;
          block_type: CampaignBriefBlockType;
          title: string;
          body: string | null;
          items: unknown[];
          visibility: CampaignBriefVisibility;
          sort_order: number;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          campaign_id: string;
          block_type: CampaignBriefBlockType;
          title: string;
          body?: string | null;
          items?: unknown[];
          visibility?: CampaignBriefVisibility;
          sort_order?: number;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          campaign_id?: string;
          block_type?: CampaignBriefBlockType;
          title?: string;
          body?: string | null;
          items?: unknown[];
          visibility?: CampaignBriefVisibility;
          sort_order?: number;
          created_at?: string;
          updated_at?: string;
        };
      };

      campaign_assets: {
        Row: {
          id: string;
          campaign_id: string;
          uploaded_by: string;
          title: string;
          description: string | null;
          asset_type: CampaignAssetType;
          bucket_id: 'campaign-assets';
          storage_path: string;
          file_name: string;
          mime_type: string;
          size_bytes: number;
          visibility: CampaignAssetVisibility;
          status: CampaignAssetStatus;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          campaign_id: string;
          uploaded_by: string;
          title: string;
          description?: string | null;
          asset_type: CampaignAssetType;
          bucket_id?: 'campaign-assets';
          storage_path: string;
          file_name: string;
          mime_type: string;
          size_bytes: number;
          visibility?: CampaignAssetVisibility;
          status?: CampaignAssetStatus;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          campaign_id?: string;
          uploaded_by?: string;
          title?: string;
          description?: string | null;
          asset_type?: CampaignAssetType;
          bucket_id?: 'campaign-assets';
          storage_path?: string;
          file_name?: string;
          mime_type?: string;
          size_bytes?: number;
          visibility?: CampaignAssetVisibility;
          status?: CampaignAssetStatus;
          created_at?: string;
          updated_at?: string;
        };
      };

      reporting_metric_definitions: {
        Row: {
          id: string;
          platform: ReportingPlatform;
          metric_key: string;
          label: string;
          field_type: ReportingFieldType;
          evidence_scope: ReportingEvidenceScope;
          is_default: boolean;
          is_private_metric: boolean;
          sort_order: number;
          created_at: string;
        };
        Insert: {
          id?: string;
          platform: ReportingPlatform;
          metric_key: string;
          label: string;
          field_type: ReportingFieldType;
          evidence_scope: ReportingEvidenceScope;
          is_default?: boolean;
          is_private_metric?: boolean;
          sort_order?: number;
          created_at?: string;
        };
        Update: {
          id?: string;
          platform?: ReportingPlatform;
          metric_key?: string;
          label?: string;
          field_type?: ReportingFieldType;
          evidence_scope?: ReportingEvidenceScope;
          is_default?: boolean;
          is_private_metric?: boolean;
          sort_order?: number;
          created_at?: string;
        };
      };

      campaign_reporting_requirements: {
        Row: {
          id: string;
          campaign_id: string;
          platform: ReportingPlatform;
          platform_label: string | null;
          content_format: string;
          account_requirement: ReportingAccountRequirement;
          evidence_types: string[];
          required_metric_keys: string[];
          ai_extraction_allowed: boolean;
          creator_confirmation_required: boolean;
          sort_order: number;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          campaign_id: string;
          platform: ReportingPlatform;
          platform_label?: string | null;
          content_format: string;
          account_requirement?: ReportingAccountRequirement;
          evidence_types?: string[];
          required_metric_keys?: string[];
          ai_extraction_allowed?: boolean;
          creator_confirmation_required?: boolean;
          sort_order?: number;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          campaign_id?: string;
          platform?: ReportingPlatform;
          platform_label?: string | null;
          content_format?: string;
          account_requirement?: ReportingAccountRequirement;
          evidence_types?: string[];
          required_metric_keys?: string[];
          ai_extraction_allowed?: boolean;
          creator_confirmation_required?: boolean;
          sort_order?: number;
          created_at?: string;
          updated_at?: string;
        };
      };

      campaign_reporting_plans: {
        Row: {
          id: string;
          campaign_id: string;
          cadence: CampaignReportingCadence;
          required_evidence: string[];
          required_metrics: Record<string, unknown>;
          report_template_id: string | null;
          report_preset_id: string;
          report_chart_mode_id: string;
          report_block_ids: string[];
          report_presentation: Record<string, unknown>;
          grace_period_hours: number;
          starts_at: string | null;
          ends_at: string | null;
          custom_due_dates: string[];
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          campaign_id: string;
          cadence?: CampaignReportingCadence;
          required_evidence?: string[];
          required_metrics?: Record<string, unknown>;
          report_template_id?: string | null;
          report_preset_id?: string;
          report_chart_mode_id?: string;
          report_block_ids?: string[];
          report_presentation?: Record<string, unknown>;
          grace_period_hours?: number;
          starts_at?: string | null;
          ends_at?: string | null;
          custom_due_dates?: string[];
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          campaign_id?: string;
          cadence?: CampaignReportingCadence;
          required_evidence?: string[];
          required_metrics?: Record<string, unknown>;
          report_template_id?: string | null;
          report_preset_id?: string;
          report_chart_mode_id?: string;
          report_block_ids?: string[];
          report_presentation?: Record<string, unknown>;
          grace_period_hours?: number;
          starts_at?: string | null;
          ends_at?: string | null;
          custom_due_dates?: string[];
          created_at?: string;
          updated_at?: string;
        };
      };

      campaign_report_share_links: {
        Row: {
          id: string;
          campaign_id: string;
          created_by: string;
          token_hash: string;
          token_prefix: string;
          label: string;
          expires_at: string | null;
          revoked_at: string | null;
          last_viewed_at: string | null;
          view_count: number;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          campaign_id: string;
          created_by: string;
          token_hash: string;
          token_prefix: string;
          label?: string;
          expires_at?: string | null;
          revoked_at?: string | null;
          last_viewed_at?: string | null;
          view_count?: number;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          campaign_id?: string;
          created_by?: string;
          token_hash?: string;
          token_prefix?: string;
          label?: string;
          expires_at?: string | null;
          revoked_at?: string | null;
          last_viewed_at?: string | null;
          view_count?: number;
          created_at?: string;
          updated_at?: string;
        };
      };

      campaign_report_tasks: {
        Row: {
          id: string;
          campaign_id: string;
          campaign_member_id: string;
          task_key: string;
          period_start: string | null;
          period_end: string | null;
          due_at: string;
          status: CampaignReportTaskStatus;
          submitted_at: string | null;
          verified_at: string | null;
          missed_at: string | null;
          excused_at: string | null;
          review_note: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          campaign_id: string;
          campaign_member_id: string;
          task_key: string;
          period_start?: string | null;
          period_end?: string | null;
          due_at: string;
          status?: CampaignReportTaskStatus;
          submitted_at?: string | null;
          verified_at?: string | null;
          missed_at?: string | null;
          excused_at?: string | null;
          review_note?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          campaign_id?: string;
          campaign_member_id?: string;
          task_key?: string;
          period_start?: string | null;
          period_end?: string | null;
          due_at?: string;
          status?: CampaignReportTaskStatus;
          submitted_at?: string | null;
          verified_at?: string | null;
          missed_at?: string | null;
          excused_at?: string | null;
          review_note?: string | null;
          created_at?: string;
          updated_at?: string;
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
          report_task_id: string | null;
          verification_status: PerformanceVerificationStatus;
          verified_at: string | null;
          verified_by: string | null;
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
          report_task_id?: string | null;
          verification_status?: PerformanceVerificationStatus;
          verified_at?: string | null;
          verified_by?: string | null;
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
          report_task_id?: string | null;
          verification_status?: PerformanceVerificationStatus;
          verified_at?: string | null;
          verified_by?: string | null;
          reported_at?: string;
          created_at?: string;
        };
      };

      content_performance_metric_values: {
        Row: {
          id: string;
          performance_id: string;
          report_task_id: string | null;
          platform: ReportingPlatform;
          metric_key: string;
          metric_label: string;
          metric_value: number | null;
          metric_text: string | null;
          source_type: ReportingMetricSourceType;
          extraction_confidence: number | null;
          confirmed_by_creator: boolean;
          confirmed_at: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          performance_id: string;
          report_task_id?: string | null;
          platform: ReportingPlatform;
          metric_key: string;
          metric_label: string;
          metric_value?: number | null;
          metric_text?: string | null;
          source_type?: ReportingMetricSourceType;
          extraction_confidence?: number | null;
          confirmed_by_creator?: boolean;
          confirmed_at?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          performance_id?: string;
          report_task_id?: string | null;
          platform?: ReportingPlatform;
          metric_key?: string;
          metric_label?: string;
          metric_value?: number | null;
          metric_text?: string | null;
          source_type?: ReportingMetricSourceType;
          extraction_confidence?: number | null;
          confirmed_by_creator?: boolean;
          confirmed_at?: string | null;
          created_at?: string;
          updated_at?: string;
        };
      };

      content_performance_evidence: {
        Row: {
          id: string;
          campaign_id: string;
          campaign_member_id: string;
          report_task_id: string;
          submission_id: string | null;
          performance_id: string | null;
          uploaded_by: string;
          evidence_type: PerformanceEvidenceType;
          bucket_id: 'campaign-evidence';
          storage_path: string;
          file_name: string;
          mime_type: string;
          size_bytes: number;
          verification_status: PerformanceEvidenceVerificationStatus;
          review_note: string | null;
          reviewed_by: string | null;
          reviewed_at: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          campaign_id: string;
          campaign_member_id: string;
          report_task_id: string;
          submission_id?: string | null;
          performance_id?: string | null;
          uploaded_by: string;
          evidence_type: PerformanceEvidenceType;
          bucket_id?: 'campaign-evidence';
          storage_path: string;
          file_name: string;
          mime_type: string;
          size_bytes: number;
          verification_status?: PerformanceEvidenceVerificationStatus;
          review_note?: string | null;
          reviewed_by?: string | null;
          reviewed_at?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          campaign_id?: string;
          campaign_member_id?: string;
          report_task_id?: string;
          submission_id?: string | null;
          performance_id?: string | null;
          uploaded_by?: string;
          evidence_type?: PerformanceEvidenceType;
          bucket_id?: 'campaign-evidence';
          storage_path?: string;
          file_name?: string;
          mime_type?: string;
          size_bytes?: number;
          verification_status?: PerformanceEvidenceVerificationStatus;
          review_note?: string | null;
          reviewed_by?: string | null;
          reviewed_at?: string | null;
          created_at?: string;
          updated_at?: string;
        };
      };

      content_performance_ai_extractions: {
        Row: {
          id: string;
          evidence_id: string;
          report_task_id: string;
          platform: ReportingPlatform;
          model: string;
          input_sha256: string;
          extracted_metrics: Record<string, unknown>;
          confidence_summary: Record<string, unknown>;
          status: PerformanceAiExtractionStatus;
          created_at: string;
        };
        Insert: {
          id?: string;
          evidence_id: string;
          report_task_id: string;
          platform: ReportingPlatform;
          model: string;
          input_sha256: string;
          extracted_metrics: Record<string, unknown>;
          confidence_summary?: Record<string, unknown>;
          status?: PerformanceAiExtractionStatus;
          created_at?: string;
        };
        Update: {
          id?: string;
          evidence_id?: string;
          report_task_id?: string;
          platform?: ReportingPlatform;
          model?: string;
          input_sha256?: string;
          extracted_metrics?: Record<string, unknown>;
          confidence_summary?: Record<string, unknown>;
          status?: PerformanceAiExtractionStatus;
          created_at?: string;
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
          status: NotificationQueueStatus;
          attempt_count: number;
          last_error: string | null;
          processed_reason: string | null;
          delivered_at: string | null;
          processed_at: string | null;
          updated_at: string;
          created_at: string;
        };
        Insert: {
          id?: string;
          notification_id?: string | null;
          email: string;
          template: string;
          data?: Record<string, unknown> | null;
          priority: NotificationPriority;
          status?: NotificationQueueStatus;
          attempt_count?: number;
          last_error?: string | null;
          processed_reason?: string | null;
          delivered_at?: string | null;
          processed_at?: string | null;
          updated_at?: string;
          created_at?: string;
        };
        Update: {
          id?: string;
          notification_id?: string | null;
          email?: string;
          template?: string;
          data?: Record<string, unknown> | null;
          priority?: NotificationPriority;
          status?: NotificationQueueStatus;
          attempt_count?: number;
          last_error?: string | null;
          processed_reason?: string | null;
          delivered_at?: string | null;
          processed_at?: string | null;
          updated_at?: string;
          created_at?: string;
        };
      };

      notification_email_preferences: {
        Row: {
          user_id: string;
          email_messages: boolean;
          email_campaign_activity: boolean;
          email_reports: boolean;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          user_id: string;
          email_messages?: boolean;
          email_campaign_activity?: boolean;
          email_reports?: boolean;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          user_id?: string;
          email_messages?: boolean;
          email_campaign_activity?: boolean;
          email_reports?: boolean;
          created_at?: string;
          updated_at?: string;
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

    Views: {
      campaign_member_agreement_status: {
        Row: {
          campaign_id: string;
          campaign_member_id: string;
          creator_id: string;
          agreement_id: string | null;
          agreement_version: number | null;
          status: CampaignAgreementMemberStatus;
          accepted_at: string | null;
          typed_name: string | null;
        };
        Insert: never;
        Update: never;
      };
    };

    Functions: Record<string, never>;

    Enums: {
      user_role: UserRole;
      user_status: UserStatus;
      campaign_status: CampaignStatus;
      campaign_mode_type: CampaignModeType;
      campaign_recruitment_visibility: CampaignRecruitmentVisibility;
      application_status: ApplicationStatus;
      submission_status: SubmissionStatus;
      platform_type: PlatformType;
      notification_type: NotificationType;
      payment_status_type: PaymentStatusType;
      creator_tier: CreatorTier;
      measurement_type: MeasurementType;
      waitlist_type: WaitlistType;
      waitlist_status: WaitlistStatus;
      brand_team_role: BrandTeamRole;
      brand_team_invitation_status: BrandTeamInvitationStatus;
    };
  };
}

// -----------------------------------------------------------------------------
// Convenience aliases - Row types
// -----------------------------------------------------------------------------

export type Profile = Database['public']['Tables']['profiles']['Row'];
export type CreatorProfile = Database['public']['Tables']['creator_profiles']['Row'];
export type BrandProfile = Database['public']['Tables']['brand_profiles']['Row'];
export type Playbook = Database['public']['Tables']['playbooks']['Row'];
export type Campaign = Database['public']['Tables']['campaigns']['Row'];
export type EnterpriseConciergeRequest = Database['public']['Tables']['enterprise_concierge_requests']['Row'];
export type CampaignResponsibilityAssignment = Database['public']['Tables']['campaign_responsibility_assignments']['Row'];
export type CampaignDeliverable = Database['public']['Tables']['campaign_deliverables']['Row'];
export type CampaignApplication = Database['public']['Tables']['campaign_applications']['Row'];
export type CampaignMember = Database['public']['Tables']['campaign_members']['Row'];
export type CampaignAgreement = Database['public']['Tables']['campaign_agreements']['Row'];
export type CampaignAgreementAcceptance = Database['public']['Tables']['campaign_agreement_acceptances']['Row'];
export type CampaignMemberAgreementStatus = Database['public']['Views']['campaign_member_agreement_status']['Row'];
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
// Convenience aliases - Insert types
// -----------------------------------------------------------------------------

export type ProfileInsert = Database['public']['Tables']['profiles']['Insert'];
export type CreatorProfileInsert = Database['public']['Tables']['creator_profiles']['Insert'];
export type BrandProfileInsert = Database['public']['Tables']['brand_profiles']['Insert'];
export type PlaybookInsert = Database['public']['Tables']['playbooks']['Insert'];
export type CampaignInsert = Database['public']['Tables']['campaigns']['Insert'];
export type EnterpriseConciergeRequestInsert = Database['public']['Tables']['enterprise_concierge_requests']['Insert'];
export type CampaignResponsibilityAssignmentInsert = Database['public']['Tables']['campaign_responsibility_assignments']['Insert'];
export type CampaignDeliverableInsert = Database['public']['Tables']['campaign_deliverables']['Insert'];
export type CampaignApplicationInsert = Database['public']['Tables']['campaign_applications']['Insert'];
export type CampaignMemberInsert = Database['public']['Tables']['campaign_members']['Insert'];
export type CampaignAgreementInsert = Database['public']['Tables']['campaign_agreements']['Insert'];
export type CampaignAgreementAcceptanceInsert = Database['public']['Tables']['campaign_agreement_acceptances']['Insert'];
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
// Convenience aliases - Update types
// -----------------------------------------------------------------------------

export type ProfileUpdate = Database['public']['Tables']['profiles']['Update'];
export type CreatorProfileUpdate = Database['public']['Tables']['creator_profiles']['Update'];
export type BrandProfileUpdate = Database['public']['Tables']['brand_profiles']['Update'];
export type PlaybookUpdate = Database['public']['Tables']['playbooks']['Update'];
export type CampaignUpdate = Database['public']['Tables']['campaigns']['Update'];
export type EnterpriseConciergeRequestUpdate = Database['public']['Tables']['enterprise_concierge_requests']['Update'];
export type CampaignResponsibilityAssignmentUpdate = Database['public']['Tables']['campaign_responsibility_assignments']['Update'];
export type CampaignDeliverableUpdate = Database['public']['Tables']['campaign_deliverables']['Update'];
export type CampaignApplicationUpdate = Database['public']['Tables']['campaign_applications']['Update'];
export type CampaignMemberUpdate = Database['public']['Tables']['campaign_members']['Update'];
export type CampaignAgreementUpdate = Database['public']['Tables']['campaign_agreements']['Update'];
export type CampaignAgreementAcceptanceUpdate = Database['public']['Tables']['campaign_agreement_acceptances']['Update'];
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

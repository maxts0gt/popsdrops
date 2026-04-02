-- ============================================================
-- 013_seed_kazakh_korean_demo.sql
-- Add Kazakh creator + Korean brand + campaign for demo scenario.
-- ============================================================

DO $$
DECLARE
  -- Kazakh creator
  dana_id    uuid := 'a0000000-0000-0000-0000-000000000005';
  -- Korean brand
  haneul_id  uuid := 'b0000000-0000-0000-0000-000000000005';
  -- Campaign
  kbeauty_campaign_id uuid := 'c0000000-0000-0000-0000-000000000007';
  central_asia_campaign_id uuid := 'c0000000-0000-0000-0000-000000000008';
BEGIN

-- ============================================================
-- KAZAKH CREATOR: Dana Nurzhanova
-- Lifestyle/beauty creator from Almaty. TikTok + Instagram.
-- Trilingual: Kazakh, Russian, English.
-- ============================================================

INSERT INTO auth.users (id, instance_id, aud, role, email, encrypted_password, email_confirmed_at, created_at, updated_at, confirmation_token, raw_app_meta_data, raw_user_meta_data)
VALUES (
  dana_id,
  '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated',
  'dana@demo.popsdrops.com', '', now(), now(), now(), '',
  '{"provider":"email","providers":["email"]}'::jsonb,
  '{"full_name":"Dana Nurzhanova"}'::jsonb
) ON CONFLICT (id) DO NOTHING;

INSERT INTO profiles (id, role, full_name, email, status, onboarding_completed) VALUES
  (dana_id, 'creator', 'Dana Nurzhanova', 'dana@demo.popsdrops.com', 'approved', true)
ON CONFLICT (id) DO UPDATE SET
  full_name = EXCLUDED.full_name, email = EXCLUDED.email,
  status = EXCLUDED.status, onboarding_completed = EXCLUDED.onboarding_completed;

INSERT INTO creator_profiles (
  profile_id, slug, bio, primary_market,
  tiktok, instagram, youtube,
  platforms, niches, markets, languages, content_formats,
  rate_card, rate_currency,
  rating, review_count, campaigns_completed, completion_rate,
  tier, ranking_score, total_earned, profile_completeness
) VALUES (
  dana_id,
  'danan',
  'Almaty-based lifestyle and beauty creator. I share authentic skincare routines, OOTD styling, and city life in Central Asia. Trilingual content for the new Silk Road generation.',
  'kazakhstan',
  '{"url": "https://tiktok.com/@dananurzhanova", "handle": "@dananurzhanova", "followers": 94200, "verified": false}'::jsonb,
  '{"url": "https://instagram.com/dananurzhanova", "handle": "@dananurzhanova", "followers": 67800, "verified": false}'::jsonb,
  '{"url": "https://youtube.com/@dananurzhanova", "handle": "@dananurzhanova", "followers": 12400, "verified": false}'::jsonb,
  ARRAY['tiktok', 'instagram', 'youtube']::platform_type[],
  ARRAY['beauty', 'fashion', 'lifestyle']::text[],
  ARRAY['kazakhstan', 'uzbekistan', 'russia']::text[],
  ARRAY['Kazakh', 'Russian', 'English']::text[],
  ARRAY['short_video', 'reel', 'story']::text[],
  '{"tiktok": {"short_video": 120}, "instagram": {"reel": 150, "story": 60, "post": 100}, "youtube": {"video": 350}}'::jsonb,
  'USD',
  4.6, 7, 5, 0.93,
  'rising', 68.0, 2850.00, 0.92
) ON CONFLICT (profile_id) DO UPDATE SET
  bio = EXCLUDED.bio,
  tiktok = EXCLUDED.tiktok,
  instagram = EXCLUDED.instagram,
  youtube = EXCLUDED.youtube,
  platforms = EXCLUDED.platforms,
  niches = EXCLUDED.niches,
  markets = EXCLUDED.markets,
  languages = EXCLUDED.languages,
  rating = EXCLUDED.rating,
  review_count = EXCLUDED.review_count,
  campaigns_completed = EXCLUDED.campaigns_completed,
  tier = EXCLUDED.tier,
  total_earned = EXCLUDED.total_earned;


-- ============================================================
-- KOREAN BRAND: Haneul Cosmetics (하늘 코스메틱스)
-- Premium K-beauty expanding into Central Asia + CIS markets.
-- ============================================================

INSERT INTO auth.users (id, instance_id, aud, role, email, encrypted_password, email_confirmed_at, created_at, updated_at, confirmation_token, raw_app_meta_data, raw_user_meta_data)
VALUES (
  haneul_id,
  '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated',
  'brand5@demo.popsdrops.com', '', now(), now(), now(), '',
  '{"provider":"email","providers":["email"]}'::jsonb,
  '{"full_name":"Haneul Cosmetics"}'::jsonb
) ON CONFLICT (id) DO NOTHING;

INSERT INTO profiles (id, role, full_name, email, status, onboarding_completed) VALUES
  (haneul_id, 'brand', 'Haneul Cosmetics', 'brand5@demo.popsdrops.com', 'approved', true)
ON CONFLICT (id) DO UPDATE SET
  full_name = EXCLUDED.full_name, role = EXCLUDED.role,
  status = EXCLUDED.status, onboarding_completed = EXCLUDED.onboarding_completed;

INSERT INTO brand_profiles (profile_id, company_name, industry, target_markets, website, description, rating, review_count) VALUES
  (haneul_id, 'Haneul Cosmetics', 'beauty_skincare',
   ARRAY['south_korea', 'kazakhstan', 'uzbekistan', 'russia', 'japan'],
   'https://haneulcosmetics.kr',
   'Seoul-based premium skincare. Glass skin essentials crafted with Korean innovation. Expanding into Central Asia and the Silk Road markets.',
   4.8, 15)
ON CONFLICT (profile_id) DO UPDATE SET
  company_name = EXCLUDED.company_name,
  industry = EXCLUDED.industry,
  target_markets = EXCLUDED.target_markets,
  description = EXCLUDED.description,
  rating = EXCLUDED.rating,
  review_count = EXCLUDED.review_count;


-- ============================================================
-- CAMPAIGN 1: K-Beauty Glow Ritual — Central Asia Launch
-- Korean brand targeting Kazakhstan creators.
-- ============================================================

INSERT INTO campaigns (
  id, brand_id, title,
  brief_description, brief_requirements, brief_dos, brief_donts,
  platforms, markets, niches,
  budget_min, budget_max, budget_currency, max_creators,
  status,
  application_deadline, content_due_date,
  posting_window_start, posting_window_end,
  usage_rights_duration, usage_rights_territory, usage_rights_paid_ads,
  max_revisions, created_at, updated_at
) VALUES (
  kbeauty_campaign_id,
  haneul_id,
  'Glass Skin Ritual — Central Asia Launch',
  'Introduce the Haneul Glass Skin Set to your audience. Show your real morning or evening skincare routine using all 3 products: Toner, Serum, and Moisture Barrier Cream. We want authentic "get ready with me" content that feels natural and relatable — not a product review, but a lifestyle moment.',
  E'Use all 3 products from the Glass Skin Set in order (toner → serum → cream).\nShow before/after skin texture if comfortable.\nMention @haneulcosmetics and #GlassSkinRitual.\nInclude the link in bio or swipe-up where available.',
  E'Film in natural light — golden hour, window light, or bathroom mirror.\nShare your honest first impression.\nSpeak in your native language (Kazakh, Russian, or both).\nShow the product packaging and texture close-ups.',
  E'No filters that alter skin texture.\nNo competitor products in frame.\nNo medical or dermatological claims.\nNo AI-generated voiceover — we want your real voice.',
  ARRAY['tiktok', 'instagram']::platform_type[],
  ARRAY['kazakhstan', 'uzbekistan', 'russia']::text[],
  ARRAY['beauty', 'lifestyle']::text[],
  100, 300, 'USD', 8,
  'recruiting',
  (now() + interval '14 days')::date,
  (now() + interval '28 days')::date,
  (now() + interval '30 days')::date,
  (now() + interval '44 days')::date,
  '6_months', 'worldwide', false,
  2, now(), now()
) ON CONFLICT (id) DO UPDATE SET
  title = EXCLUDED.title,
  brief_description = EXCLUDED.brief_description,
  brief_requirements = EXCLUDED.brief_requirements,
  brief_dos = EXCLUDED.brief_dos,
  brief_donts = EXCLUDED.brief_donts,
  platforms = EXCLUDED.platforms,
  markets = EXCLUDED.markets,
  status = EXCLUDED.status,
  budget_min = EXCLUDED.budget_min,
  budget_max = EXCLUDED.budget_max,
  application_deadline = EXCLUDED.application_deadline,
  content_due_date = EXCLUDED.content_due_date;

-- Deliverables for Glass Skin campaign
INSERT INTO campaign_deliverables (campaign_id, platform, content_type, quantity, notes) VALUES
  (kbeauty_campaign_id, 'tiktok', 'short_video', 1, 'GRWM skincare routine — 30 to 60 seconds'),
  (kbeauty_campaign_id, 'instagram', 'reel', 1, 'Before/after skin texture or routine close-up')
ON CONFLICT DO NOTHING;


-- ============================================================
-- CAMPAIGN 2: Seoul Street Style × Almaty
-- Fashion-adjacent campaign from Korean brand.
-- ============================================================

INSERT INTO campaigns (
  id, brand_id, title,
  brief_description, brief_requirements, brief_dos, brief_donts,
  platforms, markets, niches,
  budget_min, budget_max, budget_currency, max_creators,
  status,
  application_deadline, content_due_date,
  posting_window_start, posting_window_end,
  usage_rights_duration, usage_rights_territory, usage_rights_paid_ads,
  max_revisions, created_at, updated_at
) VALUES (
  central_asia_campaign_id,
  haneul_id,
  'Haneul × Almaty — City Skin Diaries',
  'Document your day in Almaty while incorporating the Haneul Moisture Barrier Cream into your routine. We want to see the city through your eyes — your morning coffee, the mountains, the streets — with one moment featuring the product naturally. Think lifestyle content with a skincare beat, not a product ad.',
  E'Feature the Moisture Barrier Cream at least once in the video.\nTag @haneulcosmetics and #CityGlow.\nCaption in your language — no translation needed.',
  E'Show real Almaty — the places you actually go.\nKeep it candid and cinematic.\nYour voice, your style.',
  E'No studio setups.\nNo hard-sell voiceover.\nNo product-only shots without lifestyle context.',
  ARRAY['tiktok', 'instagram']::platform_type[],
  ARRAY['kazakhstan']::text[],
  ARRAY['lifestyle', 'beauty', 'travel']::text[],
  80, 200, 'USD', 5,
  'recruiting',
  (now() + interval '10 days')::date,
  (now() + interval '21 days')::date,
  (now() + interval '23 days')::date,
  (now() + interval '37 days')::date,
  '3_months', 'kazakhstan', false,
  2, now(), now()
) ON CONFLICT (id) DO UPDATE SET
  title = EXCLUDED.title,
  brief_description = EXCLUDED.brief_description,
  status = EXCLUDED.status;

-- Deliverables for City Skin Diaries
INSERT INTO campaign_deliverables (campaign_id, platform, content_type, quantity, notes) VALUES
  (central_asia_campaign_id, 'tiktok', 'short_video', 1, 'Day-in-my-life Almaty vlog with product moment — 30 to 90 seconds'),
  (central_asia_campaign_id, 'instagram', 'story', 3, 'Story series: morning routine → city moment → evening wind-down')
ON CONFLICT DO NOTHING;


-- ============================================================
-- CULTURAL CALENDAR: Korean holidays
-- ============================================================

INSERT INTO cultural_calendar (market, event_name, start_date, end_date, marketing_notes, year) VALUES
  ('south_korea', 'Seollal (Lunar New Year)', '2027-01-26', '2027-01-28', 'Major gift-giving season. Family-focused campaigns perform well. K-beauty gift sets peak.', 2027),
  ('south_korea', 'Chuseok (Harvest Festival)', '2026-09-24', '2026-09-26', 'Second largest holiday. Thanksgiving equivalent. Premium product gifting peak.', 2026)
ON CONFLICT DO NOTHING;


END $$;

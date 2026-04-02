-- ============================================================
-- 007_seed_demo_creators.sql
-- Seed demo creator profiles for development and preview.
-- Uses Supabase Auth admin API UUIDs (deterministic for idempotency).
-- ============================================================

-- Demo user UUIDs (deterministic, used across profiles + creator_profiles)
-- Must exist in auth.users first (profiles.id FK → auth.users.id)
-- The public media kit page (/c/[slug]) uses anon key + RLS SELECT policy.

DO $$
DECLARE
  sarah_id   uuid := 'a0000000-0000-0000-0000-000000000001';
  youssef_id uuid := 'a0000000-0000-0000-0000-000000000002';
  aiko_id    uuid := 'a0000000-0000-0000-0000-000000000003';
  carlos_id  uuid := 'a0000000-0000-0000-0000-000000000004';
BEGIN

-- ============================================================
-- AUTH USERS (minimal records to satisfy FK constraint)
-- ============================================================

INSERT INTO auth.users (id, instance_id, aud, role, email, encrypted_password, email_confirmed_at, created_at, updated_at, confirmation_token, raw_app_meta_data, raw_user_meta_data)
VALUES
  (sarah_id,   '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'sarah@demo.popsdrops.com',   '', now(), now(), now(), '', '{"provider":"email","providers":["email"]}'::jsonb, '{"full_name":"Sarah Kaya"}'::jsonb),
  (youssef_id, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'youssef@demo.popsdrops.com', '', now(), now(), now(), '', '{"provider":"email","providers":["email"]}'::jsonb, '{"full_name":"Youssef Benali"}'::jsonb),
  (aiko_id,    '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'aiko@demo.popsdrops.com',    '', now(), now(), now(), '', '{"provider":"email","providers":["email"]}'::jsonb, '{"full_name":"Aiko Tanaka"}'::jsonb),
  (carlos_id,  '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'carlos@demo.popsdrops.com',  '', now(), now(), now(), '', '{"provider":"email","providers":["email"]}'::jsonb, '{"full_name":"Carlos Mendes"}'::jsonb)
ON CONFLICT (id) DO NOTHING;

-- ============================================================
-- PROFILES (base user records)
-- ============================================================

INSERT INTO profiles (id, role, full_name, email, status, onboarding_completed) VALUES
  (sarah_id,   'creator', 'Sarah Kaya',      'sarah@demo.popsdrops.com',   'approved', true),
  (youssef_id, 'creator', 'Youssef Benali',  'youssef@demo.popsdrops.com', 'approved', true),
  (aiko_id,    'creator', 'Aiko Tanaka',     'aiko@demo.popsdrops.com',    'approved', true),
  (carlos_id,  'creator', 'Carlos Mendes',   'carlos@demo.popsdrops.com',  'approved', true)
ON CONFLICT (id) DO UPDATE SET
  full_name = EXCLUDED.full_name,
  email = EXCLUDED.email,
  status = EXCLUDED.status,
  onboarding_completed = EXCLUDED.onboarding_completed;

-- ============================================================
-- CREATOR PROFILES
-- ============================================================

-- Sarah Kaya — Beauty & lifestyle, Istanbul
INSERT INTO creator_profiles (
  profile_id, slug, bio, primary_market,
  tiktok, instagram, youtube,
  platforms, niches, markets, languages, content_formats,
  rate_card, rate_currency,
  rating, review_count, campaigns_completed, completion_rate,
  tier, ranking_score, total_earned, profile_completeness
) VALUES (
  sarah_id,
  'sarahk',
  'Beauty & lifestyle creator based in Istanbul. Skincare routines, fashion hauls, and daily life in Turkey. Bilingual content in Turkish and English.',
  'turkey',
  '{"url": "https://tiktok.com/@sarahkaya", "handle": "@sarahkaya", "followers": 45200, "verified": true}'::jsonb,
  '{"url": "https://instagram.com/sarah.kaya", "handle": "@sarah.kaya", "followers": 28400, "verified": true}'::jsonb,
  '{"url": "https://youtube.com/@sarahkaya", "handle": "Sarah Kaya", "followers": 8900, "verified": false}'::jsonb,
  ARRAY['tiktok', 'instagram', 'youtube']::platform_type[],
  ARRAY['beauty', 'fashion', 'lifestyle'],
  ARRAY['turkey', 'united_kingdom', 'germany'],
  ARRAY['Turkish', 'English'],
  ARRAY['short_video', 'reel', 'story', 'long_video'],
  '{"tiktok": {"short_video": 275}, "instagram": {"reel": 200, "story": 100}, "youtube": {"long_video": 500}}'::jsonb,
  'USD',
  4.8, 12, 8, 95.0,
  'rising', 72.0, 3400.00, 95
)
ON CONFLICT (profile_id) DO UPDATE SET
  slug = EXCLUDED.slug,
  bio = EXCLUDED.bio,
  primary_market = EXCLUDED.primary_market,
  tiktok = EXCLUDED.tiktok,
  instagram = EXCLUDED.instagram,
  youtube = EXCLUDED.youtube,
  platforms = EXCLUDED.platforms,
  niches = EXCLUDED.niches,
  markets = EXCLUDED.markets,
  languages = EXCLUDED.languages,
  content_formats = EXCLUDED.content_formats,
  rate_card = EXCLUDED.rate_card,
  rate_currency = EXCLUDED.rate_currency,
  rating = EXCLUDED.rating,
  review_count = EXCLUDED.review_count,
  campaigns_completed = EXCLUDED.campaigns_completed,
  completion_rate = EXCLUDED.completion_rate,
  tier = EXCLUDED.tier,
  ranking_score = EXCLUDED.ranking_score,
  total_earned = EXCLUDED.total_earned,
  profile_completeness = EXCLUDED.profile_completeness;

-- Youssef Benali — Food & travel, Dubai
INSERT INTO creator_profiles (
  profile_id, slug, bio, primary_market,
  tiktok, instagram, snapchat,
  platforms, niches, markets, languages, content_formats,
  rate_card, rate_currency,
  rating, review_count, campaigns_completed, completion_rate,
  tier, ranking_score, total_earned, profile_completeness
) VALUES (
  youssef_id,
  'youssefb',
  'Food & travel creator exploring the best eats across the Middle East and Europe. Street food, hidden gems, and culinary adventures.',
  'uae',
  '{"url": "https://tiktok.com/@youssefbenali", "handle": "@youssefbenali", "followers": 12400, "verified": true}'::jsonb,
  '{"url": "https://instagram.com/youssef.benali", "handle": "@youssef.benali", "followers": 8100, "verified": true}'::jsonb,
  '{"url": "https://snapchat.com/youssefb", "handle": "youssefb", "followers": 6700, "verified": false}'::jsonb,
  ARRAY['tiktok', 'instagram', 'snapchat']::platform_type[],
  ARRAY['food', 'travel', 'lifestyle'],
  ARRAY['uae', 'saudi_arabia', 'france'],
  ARRAY['Arabic', 'English', 'French'],
  ARRAY['short_video', 'reel', 'story'],
  '{"tiktok": {"short_video": 140}, "instagram": {"reel": 115, "story": 70}, "snapchat": {"story": 80}}'::jsonb,
  'USD',
  4.6, 4, 3, 100.0,
  'new', 45.0, 980.00, 90
)
ON CONFLICT (profile_id) DO UPDATE SET
  slug = EXCLUDED.slug,
  bio = EXCLUDED.bio,
  primary_market = EXCLUDED.primary_market,
  tiktok = EXCLUDED.tiktok,
  instagram = EXCLUDED.instagram,
  snapchat = EXCLUDED.snapchat,
  platforms = EXCLUDED.platforms,
  niches = EXCLUDED.niches,
  markets = EXCLUDED.markets,
  languages = EXCLUDED.languages,
  content_formats = EXCLUDED.content_formats,
  rate_card = EXCLUDED.rate_card,
  rate_currency = EXCLUDED.rate_currency,
  rating = EXCLUDED.rating,
  review_count = EXCLUDED.review_count,
  campaigns_completed = EXCLUDED.campaigns_completed,
  completion_rate = EXCLUDED.completion_rate,
  tier = EXCLUDED.tier,
  ranking_score = EXCLUDED.ranking_score,
  total_earned = EXCLUDED.total_earned,
  profile_completeness = EXCLUDED.profile_completeness;

-- Aiko Tanaka — Tech & gaming, Tokyo
INSERT INTO creator_profiles (
  profile_id, slug, bio, primary_market,
  tiktok, instagram, youtube,
  platforms, niches, markets, languages, content_formats,
  rate_card, rate_currency,
  rating, review_count, campaigns_completed, completion_rate,
  tier, ranking_score, total_earned, profile_completeness
) VALUES (
  aiko_id,
  'aikot',
  'Tech reviewer and gaming creator in Tokyo. Unboxings, gadget comparisons, and gaming setups. Content in Japanese and English.',
  'japan',
  '{"url": "https://tiktok.com/@aikotanaka", "handle": "@aikotanaka", "followers": 67800, "verified": true}'::jsonb,
  '{"url": "https://instagram.com/aiko.tanaka", "handle": "@aiko.tanaka", "followers": 34200, "verified": true}'::jsonb,
  '{"url": "https://youtube.com/@aikotanaka", "handle": "Aiko Tanaka", "followers": 21500, "verified": true}'::jsonb,
  ARRAY['tiktok', 'instagram', 'youtube']::platform_type[],
  ARRAY['tech', 'gaming', 'lifestyle'],
  ARRAY['japan', 'south_korea', 'united_states'],
  ARRAY['Japanese', 'English'],
  ARRAY['short_video', 'reel', 'long_video', 'post'],
  '{"tiktok": {"short_video": 350}, "instagram": {"reel": 280, "post": 150}, "youtube": {"long_video": 800}}'::jsonb,
  'USD',
  4.9, 22, 15, 98.0,
  'established', 88.0, 12500.00, 100
)
ON CONFLICT (profile_id) DO UPDATE SET
  slug = EXCLUDED.slug,
  bio = EXCLUDED.bio,
  primary_market = EXCLUDED.primary_market,
  tiktok = EXCLUDED.tiktok,
  instagram = EXCLUDED.instagram,
  youtube = EXCLUDED.youtube,
  platforms = EXCLUDED.platforms,
  niches = EXCLUDED.niches,
  markets = EXCLUDED.markets,
  languages = EXCLUDED.languages,
  content_formats = EXCLUDED.content_formats,
  rate_card = EXCLUDED.rate_card,
  rate_currency = EXCLUDED.rate_currency,
  rating = EXCLUDED.rating,
  review_count = EXCLUDED.review_count,
  campaigns_completed = EXCLUDED.campaigns_completed,
  completion_rate = EXCLUDED.completion_rate,
  tier = EXCLUDED.tier,
  ranking_score = EXCLUDED.ranking_score,
  total_earned = EXCLUDED.total_earned,
  profile_completeness = EXCLUDED.profile_completeness;

-- Carlos Mendes — Fitness & lifestyle, São Paulo
INSERT INTO creator_profiles (
  profile_id, slug, bio, primary_market,
  tiktok, instagram, youtube,
  platforms, niches, markets, languages, content_formats,
  rate_card, rate_currency,
  rating, review_count, campaigns_completed, completion_rate,
  tier, ranking_score, total_earned, profile_completeness
) VALUES (
  carlos_id,
  'carlosm',
  'Fitness coach and lifestyle creator in São Paulo. Workout routines, nutrition tips, and wellness content. Portuguese and English.',
  'brazil',
  '{"url": "https://tiktok.com/@carlosmendes", "handle": "@carlosmendes", "followers": 89300, "verified": true}'::jsonb,
  '{"url": "https://instagram.com/carlos.mendes", "handle": "@carlos.mendes", "followers": 52100, "verified": true}'::jsonb,
  '{"url": "https://youtube.com/@carlosmendes", "handle": "Carlos Mendes", "followers": 15800, "verified": true}'::jsonb,
  ARRAY['tiktok', 'instagram', 'youtube']::platform_type[],
  ARRAY['fitness', 'health', 'lifestyle'],
  ARRAY['brazil', 'portugal', 'united_states'],
  ARRAY['Portuguese', 'English', 'Spanish'],
  ARRAY['short_video', 'reel', 'long_video', 'story'],
  '{"tiktok": {"short_video": 300}, "instagram": {"reel": 240, "story": 120}, "youtube": {"long_video": 650}}'::jsonb,
  'USD',
  4.7, 18, 12, 92.0,
  'established', 82.0, 8900.00, 100
)
ON CONFLICT (profile_id) DO UPDATE SET
  slug = EXCLUDED.slug,
  bio = EXCLUDED.bio,
  primary_market = EXCLUDED.primary_market,
  tiktok = EXCLUDED.tiktok,
  instagram = EXCLUDED.instagram,
  youtube = EXCLUDED.youtube,
  platforms = EXCLUDED.platforms,
  niches = EXCLUDED.niches,
  markets = EXCLUDED.markets,
  languages = EXCLUDED.languages,
  content_formats = EXCLUDED.content_formats,
  rate_card = EXCLUDED.rate_card,
  rate_currency = EXCLUDED.rate_currency,
  rating = EXCLUDED.rating,
  review_count = EXCLUDED.review_count,
  campaigns_completed = EXCLUDED.campaigns_completed,
  completion_rate = EXCLUDED.completion_rate,
  tier = EXCLUDED.tier,
  ranking_score = EXCLUDED.ranking_score,
  total_earned = EXCLUDED.total_earned,
  profile_completeness = EXCLUDED.profile_completeness;

END $$;

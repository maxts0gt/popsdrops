-- ============================================================
-- 009_seed_demo_brands_campaigns.sql
-- Seed demo brand accounts and open campaigns for testing
-- the creator discover flow.
-- ============================================================

-- ---------------------------------------------------------------------------
-- 1. Brand auth.users (FK requirement)
-- ---------------------------------------------------------------------------

INSERT INTO auth.users (id, email, raw_user_meta_data, created_at, updated_at, instance_id, aud, role)
VALUES
  ('b0000000-0000-0000-0000-000000000001', 'brand1@demo.popsdrops.com',
   '{"full_name": "Lumière Beauty"}', now(), now(),
   '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated'),
  ('b0000000-0000-0000-0000-000000000002', 'brand2@demo.popsdrops.com',
   '{"full_name": "Wanderlust Co."}', now(), now(),
   '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated'),
  ('b0000000-0000-0000-0000-000000000003', 'brand3@demo.popsdrops.com',
   '{"full_name": "NovaTech"}', now(), now(),
   '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated'),
  ('b0000000-0000-0000-0000-000000000004', 'brand4@demo.popsdrops.com',
   '{"full_name": "Maison Sportif"}', now(), now(),
   '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated')
ON CONFLICT (id) DO NOTHING;

-- ---------------------------------------------------------------------------
-- 2. Brand profiles
-- ---------------------------------------------------------------------------

INSERT INTO profiles (id, role, full_name, email, status, onboarding_completed) VALUES
  ('b0000000-0000-0000-0000-000000000001', 'brand', 'Lumière Beauty', 'brand1@demo.popsdrops.com', 'approved', true),
  ('b0000000-0000-0000-0000-000000000002', 'brand', 'Wanderlust Co.', 'brand2@demo.popsdrops.com', 'approved', true),
  ('b0000000-0000-0000-0000-000000000003', 'brand', 'NovaTech', 'brand3@demo.popsdrops.com', 'approved', true),
  ('b0000000-0000-0000-0000-000000000004', 'brand', 'Maison Sportif', 'brand4@demo.popsdrops.com', 'approved', true)
ON CONFLICT (id) DO UPDATE SET
  full_name = EXCLUDED.full_name,
  role = EXCLUDED.role,
  status = EXCLUDED.status,
  onboarding_completed = EXCLUDED.onboarding_completed;

INSERT INTO brand_profiles (profile_id, company_name, industry, target_markets, website, description, rating, review_count) VALUES
  ('b0000000-0000-0000-0000-000000000001', 'Lumière Beauty', 'beauty_skincare',
   ARRAY['turkey', 'uae', 'france', 'saudi_arabia'],
   'https://lumierebeauty.com',
   'French-inspired skincare brand expanding across Europe and the Middle East. Clean formulations, luxury positioning.',
   4.7, 23),
  ('b0000000-0000-0000-0000-000000000002', 'Wanderlust Co.', 'travel_hospitality',
   ARRAY['japan', 'brazil', 'spain', 'thailand'],
   'https://wanderlust.co',
   'Travel gear and accessories for the modern explorer. Lightweight, sustainable, designed for every climate.',
   4.5, 15),
  ('b0000000-0000-0000-0000-000000000003', 'NovaTech', 'technology',
   ARRAY['us', 'germany', 'south_korea', 'japan'],
   'https://novatech.io',
   'Consumer electronics brand. Headphones, smart home, wearables. Targeting Gen Z through creator partnerships.',
   4.3, 8),
  ('b0000000-0000-0000-0000-000000000004', 'Maison Sportif', 'fashion_apparel',
   ARRAY['france', 'uk', 'brazil', 'turkey'],
   'https://maisonsportif.com',
   'Luxury athleisure brand. Performance fabrics meet Parisian design. Worn by athletes and tastemakers worldwide.',
   4.8, 31)
ON CONFLICT (profile_id) DO UPDATE SET company_name = EXCLUDED.company_name;

-- ---------------------------------------------------------------------------
-- 3. Open campaigns (status = 'recruiting')
-- ---------------------------------------------------------------------------

INSERT INTO campaigns (id, brand_id, title, brief_description, brief_requirements, brief_dos, brief_donts, platforms, markets, niches, budget_min, budget_max, budget_currency, max_creators, status, application_deadline, content_due_date, posting_window_start, posting_window_end) VALUES

-- Campaign 1: Lumière Beauty — Skincare Routine
('c0000000-0000-0000-0000-000000000001',
 'b0000000-0000-0000-0000-000000000001',
 'Summer Glow Skincare Routine',
 'Create an authentic skincare routine video featuring our new Summer Glow collection. Show your morning routine incorporating the Vitamin C serum, SPF moisturizer, and lip treatment.',
 'Must show product packaging clearly. Mention SPF importance. Include a before/after or routine sequence. Tag @lumierebeauty.',
 'Be authentic — use your real morning routine. Show texture and application. Good natural lighting.',
 'No competitor products visible. No medical claims. No heavy filters that alter skin appearance.',
 ARRAY['tiktok', 'instagram']::platform_type[],
 ARRAY['turkey', 'uae', 'france'],
 ARRAY['beauty', 'lifestyle'],
 150, 400, 'USD', 8, 'recruiting',
 now() + interval '14 days',
 now() + interval '28 days',
 now() + interval '30 days',
 now() + interval '44 days'),

-- Campaign 2: Wanderlust Co. — Travel Essentials
('c0000000-0000-0000-0000-000000000002',
 'b0000000-0000-0000-0000-000000000002',
 'Pack Light, Go Far — Travel Essentials',
 'Show how you pack for a trip using Wanderlust Co. essentials. Focus on the compression cube set and our new weather-resistant daypack. Any destination works.',
 'Feature at least 2 Wanderlust products. Show packing process or travel transition (home to destination). Use branded hashtag #WanderlustReady.',
 'Film in real travel context. Show the products in action, not just unboxing. Storytelling over product shots.',
 'No fast fashion or throwaway aesthetics. No misleading size claims. No competitor logos.',
 ARRAY['tiktok', 'youtube']::platform_type[],
 ARRAY['japan', 'brazil', 'spain'],
 ARRAY['travel', 'lifestyle'],
 200, 600, 'USD', 5, 'recruiting',
 now() + interval '10 days',
 now() + interval '24 days',
 now() + interval '26 days',
 now() + interval '40 days'),

-- Campaign 3: NovaTech — Headphones Launch
('c0000000-0000-0000-0000-000000000003',
 'b0000000-0000-0000-0000-000000000003',
 'NovaPods Pro Launch — Everyday Sound',
 'Introduce the NovaPods Pro to your audience. Focus on real daily use — commute, gym, gaming, study. We want authentic reactions and genuine impressions, not scripted reviews.',
 'Show unboxing or first impression moment. Demonstrate ANC in a noisy environment. Mention 40h battery life and multipoint pairing. Tag @novatech.',
 'Be honest about your experience. Show the product in your real environment. Comparison content welcome if fair.',
 'No scripted "wow" reactions. No false claims about specs. No opening with "NovaTech sent me this."',
 ARRAY['youtube', 'tiktok', 'instagram']::platform_type[],
 ARRAY['us', 'germany', 'south_korea', 'japan'],
 ARRAY['tech', 'gaming', 'lifestyle'],
 300, 800, 'USD', 10, 'recruiting',
 now() + interval '21 days',
 now() + interval '35 days',
 now() + interval '37 days',
 now() + interval '51 days'),

-- Campaign 4: Maison Sportif — Collection Drop
('c0000000-0000-0000-0000-000000000004',
 'b0000000-0000-0000-0000-000000000004',
 'SS26 Collection — Move in Style',
 'Style the new SS26 athleisure collection your way. We want to see how different creators interpret luxury sportswear for their lifestyle — studio, street, travel, wherever you move.',
 'Wear at least 2 pieces from SS26 collection. Show outfit in motion (workout, walk, dance, sport). Tag @maisonsportif and #MoveInStyle.',
 'Make it your own — we chose you for your style. Natural settings over studios. Movement over poses.',
 'No gym mirror selfies as the hero shot. No heavy editing that misrepresents colors. No pairing with fast-fashion items.',
 ARRAY['instagram', 'tiktok']::platform_type[],
 ARRAY['france', 'uk', 'brazil', 'turkey'],
 ARRAY['fashion', 'fitness', 'lifestyle'],
 250, 700, 'USD', 6, 'recruiting',
 now() + interval '12 days',
 now() + interval '26 days',
 now() + interval '28 days',
 now() + interval '42 days'),

-- Campaign 5: Lumière Beauty — Lip Collection (in_progress, for variety)
('c0000000-0000-0000-0000-000000000005',
 'b0000000-0000-0000-0000-000000000001',
 'New Lip Vault — Colour Stories',
 'Create a lip colour story featuring 3+ shades from the new Lip Vault collection. Show swatches, application, and your top pick.',
 'Swatch at least 3 shades. Show application close-up. Name your favourite and why. Tag @lumierebeauty.',
 'Creative freedom on concept — GRWM, ranking, lookbook all welcome. Show true-to-life colour.',
 'No misleading colour representation. No competitor dupes comparison. No AI lip filters.',
 ARRAY['instagram', 'tiktok']::platform_type[],
 ARRAY['turkey', 'france'],
 ARRAY['beauty', 'fashion'],
 180, 350, 'USD', 4, 'in_progress',
 now() - interval '5 days',
 now() + interval '10 days',
 now() + interval '12 days',
 now() + interval '26 days'),

-- Campaign 6: NovaTech — Smart Home (completed, for variety)
('c0000000-0000-0000-0000-000000000006',
 'b0000000-0000-0000-0000-000000000003',
 'Smart Home Setup Tour',
 'Give a tour of your smart home setup featuring NovaTech Hub and at least 2 connected devices. Focus on daily convenience, not just specs.',
 'Show NovaTech Hub as the center. Demonstrate voice control or app control. Mention cross-device compatibility.',
 'Show real daily use. Morning routine or evening wind-down narratives work great.',
 'No competing smart home ecosystems in shot. No over-promising automation capabilities.',
 ARRAY['youtube']::platform_type[],
 ARRAY['us', 'germany'],
 ARRAY['tech', 'lifestyle'],
 500, 1200, 'USD', 3, 'completed',
 now() - interval '60 days',
 now() - interval '30 days',
 now() - interval '28 days',
 now() - interval '14 days')

ON CONFLICT (id) DO UPDATE SET title = EXCLUDED.title;

-- ---------------------------------------------------------------------------
-- 4. Campaign deliverables for recruiting campaigns
-- ---------------------------------------------------------------------------

INSERT INTO campaign_deliverables (campaign_id, platform, content_type, quantity, notes) VALUES
  -- Campaign 1
  ('c0000000-0000-0000-0000-000000000001', 'tiktok', 'short_video', 1, '30-60 second routine video'),
  ('c0000000-0000-0000-0000-000000000001', 'instagram', 'reel', 1, 'Reel with product close-ups'),
  -- Campaign 2
  ('c0000000-0000-0000-0000-000000000002', 'tiktok', 'short_video', 1, 'Packing or travel transition'),
  ('c0000000-0000-0000-0000-000000000002', 'youtube', 'long_video', 1, 'Travel vlog featuring products'),
  -- Campaign 3
  ('c0000000-0000-0000-0000-000000000003', 'youtube', 'long_video', 1, 'Review or first impressions'),
  ('c0000000-0000-0000-0000-000000000003', 'tiktok', 'short_video', 1, 'Quick take or comparison'),
  ('c0000000-0000-0000-0000-000000000003', 'instagram', 'reel', 1, 'ANC demo reel'),
  -- Campaign 4
  ('c0000000-0000-0000-0000-000000000004', 'instagram', 'reel', 2, 'Outfit in motion'),
  ('c0000000-0000-0000-0000-000000000004', 'tiktok', 'short_video', 1, 'Styling or OOTD'),
  -- Campaign 5
  ('c0000000-0000-0000-0000-000000000005', 'instagram', 'reel', 1, 'Lip colour story'),
  ('c0000000-0000-0000-0000-000000000005', 'tiktok', 'short_video', 1, 'Swatches and top pick'),
  -- Campaign 6
  ('c0000000-0000-0000-0000-000000000006', 'youtube', 'long_video', 1, 'Smart home tour')
ON CONFLICT DO NOTHING;

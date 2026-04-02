-- ============================================================
-- 003_seed_data.sql
-- PopsDrops: seed data for playbooks, cultural calendar, compliance
-- ============================================================

-- ============================================================
-- PLAYBOOKS
-- ============================================================

INSERT INTO playbooks (name, description, icon, defaults, sort_order) VALUES
(
  'Product Seeding Review',
  'Send your product to creators for honest, authentic reviews. Great for building trust and generating UGC.',
  'package',
  '{
    "platforms": ["tiktok", "instagram"],
    "niches": [],
    "budget_range": "100-300",
    "timeline_days": 14,
    "max_creators": 5,
    "brief_template": "We''d love for you to try our product and share your honest review with your audience. Show the unboxing, your first impressions, and how you use it in your daily routine. Be authentic — your audience trusts your genuine opinion."
  }'::jsonb,
  1
),
(
  'Brand Awareness Launch',
  'Maximize reach across multiple platforms for a new brand or product launch. Ideal for market entry.',
  'megaphone',
  '{
    "platforms": ["tiktok", "instagram", "snapchat"],
    "niches": [],
    "budget_range": "200-500",
    "timeline_days": 28,
    "max_creators": 10,
    "brief_template": "Help us introduce our brand to your audience! Create content that showcases our brand story and values while connecting it to your unique style and voice."
  }'::jsonb,
  2
),
(
  'Ramadan Special',
  'Culturally-aware campaign template optimized for the holy month. Pre-set timing and content guidelines.',
  'moon',
  '{
    "platforms": ["tiktok", "instagram", "snapchat"],
    "niches": [],
    "budget_range": "150-400",
    "timeline_days": 14,
    "max_creators": 8,
    "brief_template": "Create Ramadan-themed content that resonates with your audience during the holy month. Focus on themes of generosity, family, and community. Be mindful of cultural sensitivities and posting times (after iftar is peak engagement)."
  }'::jsonb,
  3
),
(
  'Seasonal Collection Drop',
  'Fast-turnaround campaign for limited drops, seasonal launches, or flash sales.',
  'zap',
  '{
    "platforms": ["tiktok", "instagram"],
    "niches": [],
    "budget_range": "100-250",
    "timeline_days": 7,
    "max_creators": 5,
    "brief_template": "Our new collection just dropped and we want to create buzz! Show off your favorite pieces, style them your way, and drive your audience to check out the collection before it sells out."
  }'::jsonb,
  4
),
(
  'UGC Content Creation',
  'Commission high-quality user-generated content for your brand''s own channels and paid ads.',
  'video',
  '{
    "platforms": ["tiktok", "instagram"],
    "niches": [],
    "budget_range": "50-200",
    "timeline_days": 21,
    "max_creators": 15,
    "usage_rights": true,
    "brief_template": "We need authentic, high-quality video content featuring our product for use on our brand channels and in paid advertising. Focus on natural lighting, genuine reactions, and showing the product in real-life use."
  }'::jsonb,
  5
);

-- ============================================================
-- CULTURAL CALENDAR (2026-2027)
-- ============================================================

INSERT INTO cultural_calendar (market, event_name, start_date, end_date, marketing_notes, year) VALUES
-- Ramadan & Eid 2026
('MENA', 'Ramadan 2026', '2026-02-18', '2026-03-19',
 'Peak engagement after iftar (7-11pm local). Avoid food/drink content during fasting hours. Themes: generosity, family, spirituality. CPMs increase 20-40%. Plan campaigns to launch 1-2 weeks before Ramadan.',
 2026),
('MENA', 'Eid al-Fitr 2026', '2026-03-20', '2026-03-22',
 'Celebration period — fashion, beauty, food, and gift content perform exceptionally well. High purchasing intent. Short campaign window: plan content in advance.',
 2026),
('MENA', 'Eid al-Adha 2026', '2026-05-27', '2026-05-30',
 'Family-focused celebration. Travel, fashion, and food content peak. Many users travel so engagement patterns shift.',
 2026),

-- National Days 2026
('Saudi Arabia', 'Saudi National Day', '2026-09-23', '2026-09-23',
 'Massive engagement spike. Green-themed content. Patriotic sentiment drives sharing. Brands with local presence see 3-5x engagement. Plan 2-3 weeks ahead.',
 2026),
('UAE', 'UAE National Day', '2026-12-02', '2026-12-02',
 'Red/green/white themed content. High brand activity. Premium CPMs. Great time for brand awareness campaigns targeting UAE.',
 2026),

-- Central Asia 2026
('Central Asia', 'Nauryz (Nowruz)', '2026-03-22', '2026-03-22',
 'Persian/Turkic New Year. Major holiday in Kazakhstan, Uzbekistan, Kyrgyzstan. Spring renewal themes. Family gatherings. Food and fashion content performs well.',
 2026),

-- Morocco specific 2026
('Morocco', 'Throne Day', '2026-07-30', '2026-07-30',
 'National holiday celebrating the king''s accession. Patriotic content, celebrations. Good timing for Morocco-focused campaigns.',
 2026),

-- Egypt specific 2026
('Egypt', 'Revolution Day', '2026-07-23', '2026-07-23',
 'National holiday. Patriotic sentiment. Good for Egypt-focused brand campaigns.',
 2026),

-- Ramadan & Eid 2027
('MENA', 'Ramadan 2027', '2027-02-08', '2027-03-09',
 'Plan campaigns starting January. Peak engagement after iftar. Themes: generosity, family, spirituality. CPMs increase 20-40%.',
 2027),
('MENA', 'Eid al-Fitr 2027', '2027-03-10', '2027-03-12',
 'Post-Ramadan celebration. Fashion, beauty, food, and gift content peak. High purchasing intent.',
 2027),

-- National Days 2027
('Saudi Arabia', 'Saudi National Day', '2027-09-23', '2027-09-23',
 'Massive engagement spike. Green-themed content. Patriotic sentiment drives sharing.',
 2027),
('UAE', 'UAE National Day', '2027-12-02', '2027-12-02',
 'Red/green/white themed content. High brand activity. Premium CPMs.',
 2027),

-- Central Asia 2027
('Central Asia', 'Nauryz (Nowruz)', '2027-03-22', '2027-03-22',
 'Persian/Turkic New Year celebration. Spring themes. Family gatherings.',
 2027);

-- ============================================================
-- MARKET COMPLIANCE
-- ============================================================

INSERT INTO market_compliance (market, requirement_title, description, severity, registration_url) VALUES
(
  'Saudi Arabia',
  'Influencer Registration Required',
  'Influencers must register with the Ministry of Commerce. Fines up to SAR 500,000 for non-compliance. Registration is mandatory for anyone receiving compensation for promotional content.',
  'required',
  'https://mc.gov.sa'
),
(
  'UAE',
  'Trade License Required',
  'Content creators require a trade license from the National Media Council. This applies to both UAE residents and those creating content targeting UAE audiences from within the country.',
  'required',
  NULL
),
(
  'Morocco',
  'Data Protection (Loi 09-08)',
  'Personal data handling must comply with Morocco''s data protection law (Loi 09-08). Brands collecting user data through influencer campaigns must ensure proper consent and data handling procedures.',
  'advisory',
  NULL
),
(
  'Egypt',
  'Advertising Disclosure',
  'Sponsored content should be clearly labeled as advertising. While enforcement is evolving, best practice is to include clear disclosure in both Arabic and English where applicable.',
  'advisory',
  NULL
);

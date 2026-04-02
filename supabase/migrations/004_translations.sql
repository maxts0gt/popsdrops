-- ============================================================
-- 004_translations.sql
-- AI-generated translation cache for multi-language support
-- ============================================================

-- Translation cache table
CREATE TABLE translations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  page_key text NOT NULL,           -- e.g. 'marketing.landing', 'ui.common', 'campaign.{uuid}'
  locale text NOT NULL,             -- e.g. 'ar', 'fr', 'ru', 'tr', 'kk', 'uz', 'ja'
  strings jsonb NOT NULL DEFAULT '{}',  -- translated key-value pairs
  source_hash text NOT NULL,        -- hash of English source for cache invalidation
  overrides jsonb DEFAULT '{}',     -- human-corrected translations (takes precedence)
  generated_by text DEFAULT 'gemini-2.0-flash', -- model used
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),

  UNIQUE(page_key, locale)
);

-- Translation glossary per language (consistency)
CREATE TABLE translation_glossary (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  locale text NOT NULL,
  term text NOT NULL,               -- English term
  translation text NOT NULL,        -- Approved translation
  context text,                     -- Usage context hint
  created_at timestamptz DEFAULT now(),

  UNIQUE(locale, term)
);

-- Index for fast lookups
CREATE INDEX idx_translations_lookup ON translations(page_key, locale);
CREATE INDEX idx_translations_locale ON translations(locale);
CREATE INDEX idx_glossary_locale ON translation_glossary(locale);

-- Updated_at trigger
CREATE TRIGGER translations_updated_at
  BEFORE UPDATE ON translations
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- RLS
ALTER TABLE translations ENABLE ROW LEVEL SECURITY;
ALTER TABLE translation_glossary ENABLE ROW LEVEL SECURITY;

-- Everyone can read translations
CREATE POLICY "translations_read" ON translations
  FOR SELECT USING (true);

-- Only service role / edge functions can write translations
CREATE POLICY "translations_insert" ON translations
  FOR INSERT WITH CHECK (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin')
  );

CREATE POLICY "translations_update" ON translations
  FOR UPDATE USING (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin')
  );

-- Glossary readable by all, writable by admin
CREATE POLICY "glossary_read" ON translation_glossary
  FOR SELECT USING (true);

CREATE POLICY "glossary_write" ON translation_glossary
  FOR INSERT WITH CHECK (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin')
  );

-- Seed glossary with core terms
INSERT INTO translation_glossary (locale, term, translation, context) VALUES
  -- Arabic
  ('ar', 'campaign', 'حملة', 'Marketing campaign'),
  ('ar', 'creator', 'صانع محتوى', 'Content creator / influencer'),
  ('ar', 'brand', 'علامة تجارية', 'Brand / company'),
  ('ar', 'brief', 'ملخص الحملة', 'Campaign brief document'),
  ('ar', 'deliverable', 'محتوى مطلوب', 'Content deliverable'),
  ('ar', 'engagement', 'تفاعل', 'Social media engagement'),
  ('ar', 'reach', 'وصول', 'Content reach / impressions'),
  ('ar', 'application', 'طلب', 'Campaign application'),
  ('ar', 'review', 'تقييم', 'Post-campaign review/rating'),
  ('ar', 'dashboard', 'لوحة التحكم', 'User dashboard'),
  -- French
  ('fr', 'campaign', 'campagne', 'Marketing campaign'),
  ('fr', 'creator', 'créateur', 'Content creator'),
  ('fr', 'brand', 'marque', 'Brand / company'),
  ('fr', 'brief', 'brief', 'Campaign brief'),
  ('fr', 'deliverable', 'livrable', 'Content deliverable'),
  ('fr', 'engagement', 'engagement', 'Social media engagement'),
  ('fr', 'reach', 'portée', 'Content reach'),
  -- Russian
  ('ru', 'campaign', 'кампания', 'Marketing campaign'),
  ('ru', 'creator', 'креатор', 'Content creator'),
  ('ru', 'brand', 'бренд', 'Brand / company'),
  ('ru', 'brief', 'бриф', 'Campaign brief'),
  ('ru', 'deliverable', 'материал', 'Content deliverable'),
  ('ru', 'engagement', 'вовлечённость', 'Social media engagement'),
  ('ru', 'reach', 'охват', 'Content reach'),
  -- Turkish
  ('tr', 'campaign', 'kampanya', 'Marketing campaign'),
  ('tr', 'creator', 'içerik üreticisi', 'Content creator'),
  ('tr', 'brand', 'marka', 'Brand / company'),
  ('tr', 'brief', 'brief', 'Campaign brief'),
  -- Japanese
  ('ja', 'campaign', 'キャンペーン', 'Marketing campaign'),
  ('ja', 'creator', 'クリエイター', 'Content creator'),
  ('ja', 'brand', 'ブランド', 'Brand / company'),
  ('ja', 'brief', 'ブリーフ', 'Campaign brief'),
  ('ja', 'engagement', 'エンゲージメント', 'Social media engagement'),
  ('ja', 'reach', 'リーチ', 'Content reach')
ON CONFLICT (locale, term) DO NOTHING;

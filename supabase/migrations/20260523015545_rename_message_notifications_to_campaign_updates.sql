-- Rename legacy message notifications to campaign updates.
-- The product is email-notification based, not chat-based.

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM pg_enum e
    JOIN pg_type t ON t.oid = e.enumtypid
    WHERE t.typname = 'notification_type'
      AND e.enumlabel = 'new_message'
  ) AND NOT EXISTS (
    SELECT 1
    FROM pg_enum e
    JOIN pg_type t ON t.oid = e.enumtypid
    WHERE t.typname = 'notification_type'
      AND e.enumlabel = 'campaign_update'
  ) THEN
    ALTER TYPE notification_type RENAME VALUE 'new_message' TO 'campaign_update';
  ELSIF NOT EXISTS (
    SELECT 1
    FROM pg_enum e
    JOIN pg_type t ON t.oid = e.enumtypid
    WHERE t.typname = 'notification_type'
      AND e.enumlabel = 'campaign_update'
  ) THEN
    ALTER TYPE notification_type ADD VALUE 'campaign_update';
  END IF;
END $$;

UPDATE notification_queue
SET template = 'campaign_update'
WHERE template = 'new_message';

CREATE OR REPLACE FUNCTION queue_notification_email()
RETURNS trigger AS $$
DECLARE
  _email text;
BEGIN
  SELECT email INTO _email FROM profiles WHERE id = NEW.user_id;

  INSERT INTO notification_queue (notification_id, email, template, data, priority)
  VALUES (
    NEW.id,
    _email,
    NEW.type::text,
    jsonb_build_object('title', NEW.title, 'body', NEW.body, 'data', NEW.data),
    'immediate'
  );

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

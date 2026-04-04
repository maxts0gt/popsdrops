-- ---------------------------------------------------------------------------
-- accept_counter_offer RPC
-- Called by mobile creators to atomically accept a counter-offer.
-- Updates the application status and inserts a campaign_members row.
-- SECURITY DEFINER so it can insert into campaign_members (service-role only table).
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.accept_counter_offer(p_application_id UUID)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_app RECORD;
BEGIN
  -- Fetch and lock the application row
  SELECT
    ca.id,
    ca.campaign_id,
    ca.creator_id,
    ca.status,
    ca.counter_rate
  INTO v_app
  FROM campaign_applications ca
  WHERE ca.id = p_application_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Application not found';
  END IF;

  -- Verify the caller is the application creator
  IF v_app.creator_id != auth.uid() THEN
    RAISE EXCEPTION 'Not authorized';
  END IF;

  -- Verify the application is in counter_offer status
  IF v_app.status != 'counter_offer' THEN
    RAISE EXCEPTION 'No counter-offer to respond to';
  END IF;

  -- Verify counter_rate exists
  IF v_app.counter_rate IS NULL THEN
    RAISE EXCEPTION 'Counter-offer is missing a proposed rate';
  END IF;

  -- Update application to accepted
  UPDATE campaign_applications
  SET status = 'accepted', updated_at = NOW()
  WHERE id = p_application_id;

  -- Insert campaign member (or update if somehow exists)
  INSERT INTO campaign_members (campaign_id, creator_id, accepted_rate)
  VALUES (v_app.campaign_id, v_app.creator_id, v_app.counter_rate)
  ON CONFLICT (campaign_id, creator_id)
  DO UPDATE SET accepted_rate = EXCLUDED.accepted_rate;
END;
$$;

-- Grant execute to authenticated users (RLS in function body via auth.uid())
GRANT EXECUTE ON FUNCTION public.accept_counter_offer(UUID) TO authenticated;

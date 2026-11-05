-- =============================================================================
-- MUTUAL LIVE GUARDIAN LOCATION SHARING TABLE
-- Allows registered users to invite each other by email, accept, and stream
-- mutual live GPS coordinates in real-time.
-- =============================================================================

CREATE TABLE IF NOT EXISTS public.location_shares (
  id uuid primary key default gen_random_uuid(),
  sender_id uuid references auth.users(id) on delete cascade not null,
  sender_email text not null,
  sender_name text,
  receiver_id uuid references auth.users(id) on delete cascade,
  receiver_email text not null,
  receiver_name text,
  status text not null default 'pending', -- 'pending', 'accepted', 'declined', 'stopped'
  sender_lat double precision,
  sender_lng double precision,
  sender_updated_at timestamptz,
  receiver_lat double precision,
  receiver_lng double precision,
  receiver_updated_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

CREATE INDEX IF NOT EXISTS idx_location_shares_sender ON public.location_shares(sender_id, status);
CREATE INDEX IF NOT EXISTS idx_location_shares_receiver ON public.location_shares(receiver_id, status);
CREATE INDEX IF NOT EXISTS idx_location_shares_emails ON public.location_shares(lower(sender_email), lower(receiver_email));

ALTER TABLE public.location_shares ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view relevant location shares" ON public.location_shares;
CREATE POLICY "Users can view relevant location shares" ON public.location_shares FOR SELECT
TO authenticated
USING (
  auth.uid() = sender_id OR 
  auth.uid() = receiver_id OR 
  lower(auth.jwt() ->> 'email') = lower(receiver_email) OR 
  lower(auth.jwt() ->> 'email') = lower(sender_email)
);

DROP POLICY IF EXISTS "Users can insert location shares" ON public.location_shares;
CREATE POLICY "Users can insert location shares" ON public.location_shares FOR INSERT
TO authenticated
WITH CHECK (auth.uid() = sender_id);

DROP POLICY IF EXISTS "Users can update relevant location shares" ON public.location_shares;
CREATE POLICY "Users can update relevant location shares" ON public.location_shares FOR UPDATE
TO authenticated
USING (
  auth.uid() = sender_id OR 
  auth.uid() = receiver_id OR 
  lower(auth.jwt() ->> 'email') = lower(receiver_email)
);

DROP POLICY IF EXISTS "Users can delete relevant location shares" ON public.location_shares;
CREATE POLICY "Users can delete relevant location shares" ON public.location_shares FOR DELETE
TO authenticated
USING (
  auth.uid() = sender_id OR 
  auth.uid() = receiver_id OR 
  lower(auth.jwt() ->> 'email') = lower(receiver_email)
);

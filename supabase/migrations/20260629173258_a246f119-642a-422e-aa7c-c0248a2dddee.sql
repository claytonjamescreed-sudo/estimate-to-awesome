ALTER TABLE public.client_requests
  ADD COLUMN IF NOT EXISTS shipped_at timestamptz,
  ADD COLUMN IF NOT EXISTS commit_ref text;
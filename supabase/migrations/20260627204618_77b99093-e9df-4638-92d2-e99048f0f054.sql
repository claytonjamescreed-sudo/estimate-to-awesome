CREATE TYPE public.client_request_type AS ENUM ('bug','feature','other');
CREATE TYPE public.client_request_status AS ENUM ('new','in_progress','resolved','wont_fix');

CREATE TABLE public.client_requests (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  submitter_user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  submitter_name TEXT NOT NULL,
  submitter_email TEXT NOT NULL,
  type public.client_request_type NOT NULL DEFAULT 'bug',
  title TEXT NOT NULL,
  description TEXT NOT NULL,
  page_url TEXT,
  status public.client_request_status NOT NULL DEFAULT 'new',
  admin_notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.client_requests TO authenticated;
GRANT INSERT ON public.client_requests TO anon;
GRANT ALL ON public.client_requests TO service_role;

ALTER TABLE public.client_requests ENABLE ROW LEVEL SECURITY;

-- Anyone (even anon) can submit a request
CREATE POLICY "Anyone can submit a request"
  ON public.client_requests FOR INSERT
  TO anon, authenticated
  WITH CHECK (true);

-- Only admins can read
CREATE POLICY "Admins can read all requests"
  ON public.client_requests FOR SELECT
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

-- Only admins can update
CREATE POLICY "Admins can update requests"
  ON public.client_requests FOR UPDATE
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- Only admins can delete
CREATE POLICY "Admins can delete requests"
  ON public.client_requests FOR DELETE
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

CREATE TRIGGER client_requests_set_updated_at
  BEFORE UPDATE ON public.client_requests
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE INDEX client_requests_status_idx ON public.client_requests(status, created_at DESC);
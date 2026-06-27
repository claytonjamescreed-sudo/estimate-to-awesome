
-- Enums
CREATE TYPE public.app_role AS ENUM ('admin', 'user');
CREATE TYPE public.proposal_status AS ENUM ('draft', 'sent', 'won', 'lost', 'archived');

-- updated_at trigger function
CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql SET search_path = public AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END;
$$;

-- ============ profiles ============
CREATE TABLE public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email TEXT,
  full_name TEXT,
  avatar_url TEXT,
  job_title TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE ON public.profiles TO authenticated;
GRANT ALL ON public.profiles TO service_role;
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Profiles are readable by signed in users" ON public.profiles
  FOR SELECT TO authenticated USING (true);
CREATE POLICY "Users can update own profile" ON public.profiles
  FOR UPDATE TO authenticated USING (auth.uid() = id) WITH CHECK (auth.uid() = id);
CREATE TRIGGER profiles_set_updated_at BEFORE UPDATE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ============ user_roles ============
CREATE TABLE public.user_roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role public.app_role NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (user_id, role)
);
GRANT SELECT ON public.user_roles TO authenticated;
GRANT ALL ON public.user_roles TO service_role;
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.has_role(_user_id UUID, _role public.app_role)
RETURNS BOOLEAN LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = _user_id AND role = _role)
$$;

CREATE POLICY "Users can view own roles" ON public.user_roles
  FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Admins can view all roles" ON public.user_roles
  FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Admins can manage roles" ON public.user_roles
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- New-user handler: create profile + default role + admin if first/verified gosavi.ca
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  user_count BIGINT;
BEGIN
  INSERT INTO public.profiles (id, email, full_name, avatar_url)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.raw_user_meta_data->>'name', split_part(NEW.email,'@',1)),
    NEW.raw_user_meta_data->>'avatar_url'
  )
  ON CONFLICT (id) DO NOTHING;

  INSERT INTO public.user_roles (user_id, role) VALUES (NEW.id, 'user')
  ON CONFLICT DO NOTHING;

  SELECT count(*) INTO user_count FROM auth.users;
  IF user_count <= 1 THEN
    INSERT INTO public.user_roles (user_id, role) VALUES (NEW.id, 'admin')
    ON CONFLICT DO NOTHING;
  END IF;
  RETURN NEW;
END;
$$;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- Grant admin to verified @gosavi.ca emails (on insert or on confirmation)
CREATE OR REPLACE FUNCTION public.grant_admin_for_gosavi()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NEW.email_confirmed_at IS NOT NULL
     AND lower(split_part(NEW.email, '@', 2)) = 'gosavi.ca' THEN
    INSERT INTO public.user_roles (user_id, role) VALUES (NEW.id, 'admin')
    ON CONFLICT (user_id, role) DO NOTHING;
  END IF;
  RETURN NEW;
END;
$$;
CREATE TRIGGER on_auth_user_confirmed_grant_admin
  AFTER UPDATE OF email_confirmed_at ON auth.users
  FOR EACH ROW WHEN (OLD.email_confirmed_at IS NULL AND NEW.email_confirmed_at IS NOT NULL)
  EXECUTE FUNCTION public.grant_admin_for_gosavi();

-- ============ clients ============
CREATE TABLE public.clients (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  contact_name TEXT,
  email TEXT,
  phone TEXT,
  address TEXT,
  website TEXT,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.clients TO authenticated;
GRANT ALL ON public.clients TO service_role;
ALTER TABLE public.clients ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Owners read clients" ON public.clients
  FOR SELECT TO authenticated USING (auth.uid() = owner_id OR public.has_role(auth.uid(),'admin'));
CREATE POLICY "Owners insert clients" ON public.clients
  FOR INSERT TO authenticated WITH CHECK (auth.uid() = owner_id);
CREATE POLICY "Owners update clients" ON public.clients
  FOR UPDATE TO authenticated USING (auth.uid() = owner_id OR public.has_role(auth.uid(),'admin'))
  WITH CHECK (auth.uid() = owner_id OR public.has_role(auth.uid(),'admin'));
CREATE POLICY "Owners delete clients" ON public.clients
  FOR DELETE TO authenticated USING (auth.uid() = owner_id OR public.has_role(auth.uid(),'admin'));
CREATE TRIGGER clients_set_updated_at BEFORE UPDATE ON public.clients
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ============ proposals ============
CREATE TABLE public.proposals (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  client_id UUID REFERENCES public.clients(id) ON DELETE SET NULL,
  title TEXT NOT NULL,
  project_code TEXT,
  status public.proposal_status NOT NULL DEFAULT 'draft',
  total_amount NUMERIC(12,2) NOT NULL DEFAULT 0,
  currency TEXT NOT NULL DEFAULT 'CAD',
  content JSONB NOT NULL DEFAULT '{}'::jsonb,
  sent_at TIMESTAMPTZ,
  decided_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.proposals TO authenticated;
GRANT ALL ON public.proposals TO service_role;
ALTER TABLE public.proposals ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Owners read proposals" ON public.proposals
  FOR SELECT TO authenticated USING (auth.uid() = owner_id OR public.has_role(auth.uid(),'admin'));
CREATE POLICY "Owners insert proposals" ON public.proposals
  FOR INSERT TO authenticated WITH CHECK (auth.uid() = owner_id);
CREATE POLICY "Owners update proposals" ON public.proposals
  FOR UPDATE TO authenticated USING (auth.uid() = owner_id OR public.has_role(auth.uid(),'admin'))
  WITH CHECK (auth.uid() = owner_id OR public.has_role(auth.uid(),'admin'));
CREATE POLICY "Owners delete proposals" ON public.proposals
  FOR DELETE TO authenticated USING (auth.uid() = owner_id OR public.has_role(auth.uid(),'admin'));
CREATE TRIGGER proposals_set_updated_at BEFORE UPDATE ON public.proposals
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE INDEX proposals_owner_status_idx ON public.proposals (owner_id, status);

-- ============ proposal_revisions ============
CREATE TABLE public.proposal_revisions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  proposal_id UUID NOT NULL REFERENCES public.proposals(id) ON DELETE CASCADE,
  version INTEGER NOT NULL,
  snapshot JSONB NOT NULL,
  note TEXT,
  created_by UUID NOT NULL REFERENCES auth.users(id) ON DELETE SET DEFAULT DEFAULT '00000000-0000-0000-0000-000000000000',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (proposal_id, version)
);
GRANT SELECT, INSERT, DELETE ON public.proposal_revisions TO authenticated;
GRANT ALL ON public.proposal_revisions TO service_role;
ALTER TABLE public.proposal_revisions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Owners read revisions" ON public.proposal_revisions
  FOR SELECT TO authenticated USING (
    EXISTS (SELECT 1 FROM public.proposals p WHERE p.id = proposal_id
            AND (p.owner_id = auth.uid() OR public.has_role(auth.uid(),'admin')))
  );
CREATE POLICY "Owners insert revisions" ON public.proposal_revisions
  FOR INSERT TO authenticated WITH CHECK (
    EXISTS (SELECT 1 FROM public.proposals p WHERE p.id = proposal_id
            AND (p.owner_id = auth.uid() OR public.has_role(auth.uid(),'admin')))
  );

-- ============ estimate_uploads ============
CREATE TABLE public.estimate_uploads (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  proposal_id UUID NOT NULL REFERENCES public.proposals(id) ON DELETE CASCADE,
  uploaded_by UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  file_path TEXT NOT NULL,
  original_name TEXT,
  status TEXT NOT NULL DEFAULT 'uploaded',
  parsed_json JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.estimate_uploads TO authenticated;
GRANT ALL ON public.estimate_uploads TO service_role;
ALTER TABLE public.estimate_uploads ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Owners read uploads" ON public.estimate_uploads
  FOR SELECT TO authenticated USING (
    EXISTS (SELECT 1 FROM public.proposals p WHERE p.id = proposal_id
            AND (p.owner_id = auth.uid() OR public.has_role(auth.uid(),'admin')))
  );
CREATE POLICY "Owners insert uploads" ON public.estimate_uploads
  FOR INSERT TO authenticated WITH CHECK (
    auth.uid() = uploaded_by AND
    EXISTS (SELECT 1 FROM public.proposals p WHERE p.id = proposal_id AND p.owner_id = auth.uid())
  );
CREATE POLICY "Owners delete uploads" ON public.estimate_uploads
  FOR DELETE TO authenticated USING (
    EXISTS (SELECT 1 FROM public.proposals p WHERE p.id = proposal_id
            AND (p.owner_id = auth.uid() OR public.has_role(auth.uid(),'admin')))
  );

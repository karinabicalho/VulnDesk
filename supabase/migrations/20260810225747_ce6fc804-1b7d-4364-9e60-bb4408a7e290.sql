
-- ENUMS
CREATE TYPE public.app_role AS ENUM ('pentester','client');
CREATE TYPE public.company_status AS ENUM ('active','inactive');
CREATE TYPE public.project_type AS ENUM ('web','api','mobile','infra','redteam','va','other');
CREATE TYPE public.project_status AS ENUM ('planned','in_progress','finished','archived');
CREATE TYPE public.severity AS ENUM ('critical','high','medium','low','informational');
CREATE TYPE public.finding_status AS ENUM ('open','in_progress','resolved','accepted_risk','false_positive','closed');
CREATE TYPE public.evidence_type AS ENUM ('image','file','text');

-- COMPANIES
CREATE TABLE public.companies (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  identifier text NOT NULL DEFAULT '',
  description text NOT NULL DEFAULT '',
  status public.company_status NOT NULL DEFAULT 'active',
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.companies TO authenticated;
GRANT ALL ON public.companies TO service_role;

-- PROFILES
CREATE TABLE public.profiles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid UNIQUE,
  email text NOT NULL UNIQUE,
  full_name text NOT NULL DEFAULT '',
  company_id uuid REFERENCES public.companies(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.profiles TO authenticated;
GRANT ALL ON public.profiles TO service_role;

-- USER ROLES
CREATE TABLE public.user_roles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  role public.app_role NOT NULL,
  UNIQUE (user_id, role)
);
GRANT SELECT ON public.user_roles TO authenticated;
GRANT ALL ON public.user_roles TO service_role;

-- DEMO ACCOUNT MAPPING (server-side only)
CREATE TABLE public.demo_accounts (
  email text PRIMARY KEY,
  full_name text NOT NULL,
  role public.app_role NOT NULL,
  company_id uuid REFERENCES public.companies(id) ON DELETE SET NULL
);
GRANT ALL ON public.demo_accounts TO service_role;

-- PROJECTS
CREATE TABLE public.projects (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  name text NOT NULL,
  description text NOT NULL DEFAULT '',
  type public.project_type NOT NULL DEFAULT 'web',
  start_date date,
  end_date date,
  contracted_hours numeric NOT NULL DEFAULT 0,
  used_hours numeric NOT NULL DEFAULT 0,
  status public.project_status NOT NULL DEFAULT 'planned',
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.projects TO authenticated;
GRANT ALL ON public.projects TO service_role;

CREATE TABLE public.project_pentesters (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id uuid NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  profile_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  UNIQUE (project_id, profile_id)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.project_pentesters TO authenticated;
GRANT ALL ON public.project_pentesters TO service_role;

-- FINDINGS
CREATE TABLE public.findings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id uuid NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  code text NOT NULL DEFAULT '',
  title text NOT NULL,
  severity public.severity NOT NULL DEFAULT 'medium',
  description text NOT NULL DEFAULT '',
  impact text NOT NULL DEFAULT '',
  mitigation text NOT NULL DEFAULT '',
  cvss numeric(3,1) NOT NULL DEFAULT 0 CHECK (cvss >= 0 AND cvss <= 10),
  status public.finding_status NOT NULL DEFAULT 'open',
  discovered_at date NOT NULL DEFAULT CURRENT_DATE,
  resolved_at date,
  pentester_id uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.findings TO authenticated;
GRANT ALL ON public.findings TO service_role;

CREATE TABLE public.finding_evidences (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  finding_id uuid NOT NULL REFERENCES public.findings(id) ON DELETE CASCADE,
  type public.evidence_type NOT NULL DEFAULT 'text',
  caption text NOT NULL DEFAULT '',
  content text NOT NULL DEFAULT '',
  storage_path text,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.finding_evidences TO authenticated;
GRANT ALL ON public.finding_evidences TO service_role;

-- FUNCTIONS
CREATE OR REPLACE FUNCTION public.has_role(_user_id uuid, _role public.app_role)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = _user_id AND role = _role);
$$;

CREATE OR REPLACE FUNCTION public.current_company_id()
RETURNS uuid LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT company_id FROM public.profiles WHERE user_id = auth.uid();
$$;

CREATE OR REPLACE FUNCTION public.is_pentester()
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT public.has_role(auth.uid(), 'pentester');
$$;

-- bootstraps profile + role for the signed-in user based on the demo mapping
CREATE OR REPLACE FUNCTION public.bootstrap_current_user()
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  uid uuid := auth.uid();
  mail text := lower(coalesce(auth.jwt() ->> 'email',''));
  demo public.demo_accounts%ROWTYPE;
  assigned public.app_role;
BEGIN
  IF uid IS NULL OR mail = '' THEN RETURN; END IF;
  SELECT * INTO demo FROM public.demo_accounts WHERE email = mail;
  assigned := COALESCE(demo.role, 'pentester');

  IF EXISTS (SELECT 1 FROM public.profiles WHERE email = mail) THEN
    UPDATE public.profiles SET user_id = uid WHERE email = mail AND user_id IS DISTINCT FROM uid;
  ELSE
    INSERT INTO public.profiles (user_id, email, full_name, company_id)
    VALUES (uid, mail, COALESCE(demo.full_name, split_part(mail,'@',1)), demo.company_id)
    ON CONFLICT (email) DO NOTHING;
  END IF;

  INSERT INTO public.user_roles (user_id, role) VALUES (uid, assigned)
  ON CONFLICT (user_id, role) DO NOTHING;
END;
$$;
REVOKE ALL ON FUNCTION public.bootstrap_current_user() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.bootstrap_current_user() TO authenticated;

-- finding code generation
CREATE OR REPLACE FUNCTION public.set_finding_code()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE n int;
BEGIN
  IF NEW.code IS NULL OR NEW.code = '' THEN
    SELECT count(*) + 1 INTO n FROM public.findings WHERE project_id = NEW.project_id;
    NEW.code := 'FIND-' || lpad(n::text, 3, '0');
  END IF;
  RETURN NEW;
END;
$$;
CREATE TRIGGER trg_finding_code BEFORE INSERT ON public.findings
FOR EACH ROW EXECUTE FUNCTION public.set_finding_code();

CREATE OR REPLACE FUNCTION public.touch_updated_at()
RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END;
$$;
CREATE TRIGGER trg_findings_updated BEFORE UPDATE ON public.findings
FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

-- RLS
ALTER TABLE public.companies ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.demo_accounts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.projects ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.project_pentesters ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.findings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.finding_evidences ENABLE ROW LEVEL SECURITY;

CREATE POLICY "companies_select" ON public.companies FOR SELECT TO authenticated
USING (public.is_pentester() OR id = public.current_company_id());
CREATE POLICY "companies_write" ON public.companies FOR ALL TO authenticated
USING (public.is_pentester()) WITH CHECK (public.is_pentester());

CREATE POLICY "profiles_select" ON public.profiles FOR SELECT TO authenticated USING (true);

CREATE POLICY "user_roles_select_own" ON public.user_roles FOR SELECT TO authenticated
USING (user_id = auth.uid());

CREATE POLICY "projects_select" ON public.projects FOR SELECT TO authenticated
USING (public.is_pentester() OR company_id = public.current_company_id());
CREATE POLICY "projects_write" ON public.projects FOR ALL TO authenticated
USING (public.is_pentester()) WITH CHECK (public.is_pentester());

CREATE POLICY "pp_select" ON public.project_pentesters FOR SELECT TO authenticated
USING (public.is_pentester() OR EXISTS (
  SELECT 1 FROM public.projects p WHERE p.id = project_id AND p.company_id = public.current_company_id()));
CREATE POLICY "pp_write" ON public.project_pentesters FOR ALL TO authenticated
USING (public.is_pentester()) WITH CHECK (public.is_pentester());

CREATE POLICY "findings_select" ON public.findings FOR SELECT TO authenticated
USING (public.is_pentester() OR EXISTS (
  SELECT 1 FROM public.projects p WHERE p.id = project_id AND p.company_id = public.current_company_id()));
CREATE POLICY "findings_write" ON public.findings FOR ALL TO authenticated
USING (public.is_pentester()) WITH CHECK (public.is_pentester());

CREATE POLICY "evidences_select" ON public.finding_evidences FOR SELECT TO authenticated
USING (public.is_pentester() OR EXISTS (
  SELECT 1 FROM public.findings f JOIN public.projects p ON p.id = f.project_id
  WHERE f.id = finding_id AND p.company_id = public.current_company_id()));
CREATE POLICY "evidences_write" ON public.finding_evidences FOR ALL TO authenticated
USING (public.is_pentester()) WITH CHECK (public.is_pentester());

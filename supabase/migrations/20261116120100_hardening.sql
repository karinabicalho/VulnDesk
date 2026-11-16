-- VulnDesk — endurecimento de segurança e integridade
-- RNF01 (permissões no banco), RNF02 (papéis em tabela própria),
-- RNF03 (evidências privadas), RNF11 (cascata), RNF12 (created_at/updated_at),
-- RF07 (código FIND-xxx), RF10 (data de resolução).

-- ---------------------------------------------------------------------------
-- RNF12: data de criação e última alteração em todos os registros
-- ---------------------------------------------------------------------------
ALTER TABLE public.companies          ADD COLUMN IF NOT EXISTS updated_at timestamptz NOT NULL DEFAULT now();
ALTER TABLE public.profiles           ADD COLUMN IF NOT EXISTS updated_at timestamptz NOT NULL DEFAULT now();
ALTER TABLE public.projects           ADD COLUMN IF NOT EXISTS updated_at timestamptz NOT NULL DEFAULT now();
ALTER TABLE public.finding_evidences  ADD COLUMN IF NOT EXISTS updated_at timestamptz NOT NULL DEFAULT now();
ALTER TABLE public.project_pentesters ADD COLUMN IF NOT EXISTS created_at timestamptz NOT NULL DEFAULT now();
ALTER TABLE public.project_pentesters ADD COLUMN IF NOT EXISTS updated_at timestamptz NOT NULL DEFAULT now();
ALTER TABLE public.user_roles         ADD COLUMN IF NOT EXISTS created_at timestamptz NOT NULL DEFAULT now();
ALTER TABLE public.user_roles         ADD COLUMN IF NOT EXISTS updated_at timestamptz NOT NULL DEFAULT now();

DO $$
DECLARE t text;
BEGIN
  FOREACH t IN ARRAY ARRAY['companies','profiles','projects','finding_evidences','project_pentesters','user_roles'] LOOP
    EXECUTE format('DROP TRIGGER IF EXISTS trg_%1$s_updated ON public.%1$I', t);
    EXECUTE format('CREATE TRIGGER trg_%1$s_updated BEFORE UPDATE ON public.%1$I FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at()', t);
  END LOOP;
END $$;

-- ---------------------------------------------------------------------------
-- Papéis: admin é um pentester com permissão extra de gerenciar contas
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT public.has_role(auth.uid(), 'admin');
$$;
GRANT EXECUTE ON FUNCTION public.is_admin() TO authenticated;

-- Segregação de perfis: cliente enxerga o próprio perfil e a equipe técnica
-- (perfis sem empresa), nunca usuários de outras empresas.
DROP POLICY IF EXISTS "profiles_select" ON public.profiles;
CREATE POLICY "profiles_select" ON public.profiles FOR SELECT TO authenticated
USING (public.is_pentester() OR user_id = auth.uid() OR company_id IS NULL);

-- Equipe técnica vê os papéis de todos (para listar pentesters); cliente só o próprio.
DROP POLICY IF EXISTS "user_roles_select_own" ON public.user_roles;
CREATE POLICY "user_roles_select" ON public.user_roles FOR SELECT TO authenticated
USING (user_id = auth.uid() OR public.is_pentester());

-- Contas são provisionadas só pelo servidor (seed ou admin). O bootstrap apenas
-- vincula o usuário autenticado a um perfil já existente — nunca concede papel.
CREATE OR REPLACE FUNCTION public.bootstrap_current_user()
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  uid uuid := auth.uid();
  mail text := lower(coalesce(auth.jwt() ->> 'email', ''));
BEGIN
  IF uid IS NULL OR mail = '' THEN RETURN; END IF;
  UPDATE public.profiles SET user_id = uid
  WHERE lower(email) = mail AND user_id IS NULL;
END;
$$;
REVOKE ALL ON FUNCTION public.bootstrap_current_user() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.bootstrap_current_user() TO authenticated;

DROP TABLE IF EXISTS public.demo_accounts;

-- ---------------------------------------------------------------------------
-- RF07: código sequencial e único (FIND-001, FIND-002...)
-- ---------------------------------------------------------------------------
CREATE SEQUENCE IF NOT EXISTS public.finding_code_seq;
SELECT setval('public.finding_code_seq',
  GREATEST(1, COALESCE((SELECT max(substring(code FROM '[0-9]+')::int) FROM public.findings WHERE code ~ '^FIND-[0-9]+$'), 0)),
  EXISTS (SELECT 1 FROM public.findings WHERE code ~ '^FIND-[0-9]+$'));

CREATE OR REPLACE FUNCTION public.set_finding_code()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NEW.code IS NULL OR NEW.code = '' THEN
    NEW.code := 'FIND-' || lpad(nextval('public.finding_code_seq')::text, 3, '0');
  END IF;
  RETURN NEW;
END;
$$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'findings_code_key') THEN
    ALTER TABLE public.findings ADD CONSTRAINT findings_code_key UNIQUE (code);
  END IF;
END $$;

-- ---------------------------------------------------------------------------
-- RF10: data de resolução registrada pelo próprio banco
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.set_finding_resolved_at()
RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
  IF NEW.status IN ('resolved', 'closed') THEN
    IF NEW.resolved_at IS NULL THEN NEW.resolved_at := CURRENT_DATE; END IF;
  ELSIF NEW.status IN ('open', 'in_progress') THEN
    NEW.resolved_at := NULL;
  END IF;
  RETURN NEW;
END;
$$;
DROP TRIGGER IF EXISTS trg_findings_resolved ON public.findings;
CREATE TRIGGER trg_findings_resolved BEFORE INSERT OR UPDATE OF status, resolved_at ON public.findings
FOR EACH ROW EXECUTE FUNCTION public.set_finding_resolved_at();

-- Integridade dos campos numéricos e de período
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'projects_hours_check') THEN
    ALTER TABLE public.projects ADD CONSTRAINT projects_hours_check
      CHECK (contracted_hours >= 0 AND used_hours >= 0);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'projects_period_check') THEN
    ALTER TABLE public.projects ADD CONSTRAINT projects_period_check
      CHECK (end_date IS NULL OR start_date IS NULL OR end_date >= start_date);
  END IF;
END $$;

-- ---------------------------------------------------------------------------
-- RNF03: bucket privado de evidências (10 MB por arquivo)
-- Caminho dos objetos: <finding_id>/<uuid>-<nome do arquivo>
-- ---------------------------------------------------------------------------
INSERT INTO storage.buckets (id, name, public, file_size_limit)
VALUES ('evidences', 'evidences', false, 10485760)
ON CONFLICT (id) DO UPDATE SET public = false, file_size_limit = EXCLUDED.file_size_limit;

-- Índices para as consultas mais frequentes
CREATE INDEX IF NOT EXISTS idx_projects_company   ON public.projects(company_id);
CREATE INDEX IF NOT EXISTS idx_findings_project   ON public.findings(project_id);
CREATE INDEX IF NOT EXISTS idx_findings_pentester ON public.findings(pentester_id);
CREATE INDEX IF NOT EXISTS idx_evidences_finding  ON public.finding_evidences(finding_id);
CREATE INDEX IF NOT EXISTS idx_profiles_company   ON public.profiles(company_id);

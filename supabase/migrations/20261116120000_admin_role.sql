-- Papel administrativo (gestão de contas). Fica em migração própria porque um
-- valor novo de enum não pode ser usado na mesma transação em que é criado.
ALTER TYPE public.app_role ADD VALUE IF NOT EXISTS 'admin';

-- Melza 014 — orçamento, regras, metas, fechar mês, PIX, comprovantes, receitas recorrentes
-- Sem integrações externas. Rodar depois de 013.

-- =============================================================================
-- COLUNAS
-- =============================================================================

ALTER TABLE public.workspace_members
  ADD COLUMN IF NOT EXISTS pix_key TEXT;

COMMENT ON COLUMN public.workspace_members.pix_key IS
  'Chave PIX do membro (copia no Entre Nós). Não é Open Finance.';

ALTER TABLE public.transactions
  ADD COLUMN IF NOT EXISTS receipt_url TEXT;

COMMENT ON COLUMN public.transactions.receipt_url IS
  'Path do comprovante no bucket privado receipts (workspace/user/arquivo).';

ALTER TABLE public.subscriptions
  ADD COLUMN IF NOT EXISTS kind TEXT NOT NULL DEFAULT 'expense'
  CHECK (kind IN ('expense', 'income'));

COMMENT ON COLUMN public.subscriptions.kind IS
  'expense = assinatura/conta; income = salário e outras receitas recorrentes.';

-- =============================================================================
-- TABELAS
-- =============================================================================

CREATE TABLE IF NOT EXISTS public.category_budgets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id UUID NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  category_id UUID NOT NULL REFERENCES public.categories(id) ON DELETE CASCADE,
  amount DECIMAL(12, 2) NOT NULL CHECK (amount >= 0),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (workspace_id, category_id)
);

CREATE TABLE IF NOT EXISTS public.categorization_rules (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id UUID NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  pattern TEXT NOT NULL,
  category_id UUID NOT NULL REFERENCES public.categories(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_categorization_rules_workspace
  ON public.categorization_rules(workspace_id);

CREATE TABLE IF NOT EXISTS public.savings_goals (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id UUID NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  target_amount DECIMAL(12, 2) NOT NULL CHECK (target_amount > 0),
  current_amount DECIMAL(12, 2) NOT NULL DEFAULT 0 CHECK (current_amount >= 0),
  deadline DATE,
  account_id UUID REFERENCES public.accounts(id) ON DELETE SET NULL,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.month_closes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id UUID NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  year_month TEXT NOT NULL,
  closed_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  closed_by_member_id UUID REFERENCES public.workspace_members(id) ON DELETE SET NULL,
  income DECIMAL(12, 2) NOT NULL DEFAULT 0,
  expenses DECIMAL(12, 2) NOT NULL DEFAULT 0,
  notes TEXT,
  UNIQUE (workspace_id, year_month),
  CONSTRAINT month_closes_year_month_chk CHECK (year_month ~ '^\d{4}-\d{2}$')
);

-- =============================================================================
-- RLS
-- =============================================================================

ALTER TABLE public.category_budgets ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.categorization_rules ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.savings_goals ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.month_closes ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS category_budgets_all ON public.category_budgets;
CREATE POLICY category_budgets_all ON public.category_budgets FOR ALL
  USING (is_workspace_member(workspace_id))
  WITH CHECK (is_workspace_member(workspace_id));

DROP POLICY IF EXISTS categorization_rules_all ON public.categorization_rules;
CREATE POLICY categorization_rules_all ON public.categorization_rules FOR ALL
  USING (is_workspace_member(workspace_id))
  WITH CHECK (is_workspace_member(workspace_id));

DROP POLICY IF EXISTS savings_goals_all ON public.savings_goals;
CREATE POLICY savings_goals_all ON public.savings_goals FOR ALL
  USING (is_workspace_member(workspace_id))
  WITH CHECK (is_workspace_member(workspace_id));

DROP POLICY IF EXISTS month_closes_all ON public.month_closes;
CREATE POLICY month_closes_all ON public.month_closes FOR ALL
  USING (is_workspace_member(workspace_id))
  WITH CHECK (is_workspace_member(workspace_id));

-- =============================================================================
-- STORAGE comprovantes (privado; path = workspace_id / user_id / arquivo)
-- =============================================================================

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'receipts',
  'receipts',
  false,
  5242880,
  ARRAY['image/jpeg', 'image/png', 'image/webp', 'application/pdf']
)
ON CONFLICT (id) DO NOTHING;

DROP POLICY IF EXISTS "Members can read receipts" ON storage.objects;
CREATE POLICY "Members can read receipts"
  ON storage.objects FOR SELECT
  USING (
    bucket_id = 'receipts'
    AND is_workspace_member(((storage.foldername(name))[1])::uuid)
  );

DROP POLICY IF EXISTS "Users can upload receipts" ON storage.objects;
CREATE POLICY "Users can upload receipts"
  ON storage.objects FOR INSERT
  WITH CHECK (
    bucket_id = 'receipts'
    AND is_workspace_member(((storage.foldername(name))[1])::uuid)
    AND (storage.foldername(name))[2] = auth.uid()::text
  );

DROP POLICY IF EXISTS "Users can update receipts" ON storage.objects;
CREATE POLICY "Users can update receipts"
  ON storage.objects FOR UPDATE
  USING (
    bucket_id = 'receipts'
    AND (storage.foldername(name))[2] = auth.uid()::text
  );

DROP POLICY IF EXISTS "Users can delete receipts" ON storage.objects;
CREATE POLICY "Users can delete receipts"
  ON storage.objects FOR DELETE
  USING (
    bucket_id = 'receipts'
    AND (storage.foldername(name))[2] = auth.uid()::text
  );

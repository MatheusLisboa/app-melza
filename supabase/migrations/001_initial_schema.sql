-- FinançasCasa — schema canônico (workspaces)
-- Use em installs novas. Se já rodou o schema antigo (families), use 002_family_to_workspace.sql

CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- =============================================================================
-- TABLES
-- =============================================================================

CREATE TABLE workspaces (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  type TEXT NOT NULL DEFAULT 'PERSONAL'
    CHECK (type IN ('PERSONAL', 'COUPLE', 'FAMILY', 'SHARED')),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE workspace_members (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  display_name TEXT NOT NULL,
  role TEXT NOT NULL DEFAULT 'member' CHECK (role IN ('owner', 'member')),
  avatar_color TEXT NOT NULL DEFAULT '#6366f1',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE (workspace_id, user_id)
  -- sem UNIQUE(user_id): multi-workspace
);

CREATE TABLE workspace_invites (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  token TEXT NOT NULL UNIQUE DEFAULT encode(gen_random_bytes(24), 'hex'),
  created_by_member_id UUID REFERENCES workspace_members(id) ON DELETE SET NULL,
  expires_at TIMESTAMPTZ NOT NULL DEFAULT (NOW() + INTERVAL '7 days'),
  used_at TIMESTAMPTZ,
  used_by_user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  revoked_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE third_parties (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  relationship TEXT,
  phone TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE cards (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  owner_member_id UUID REFERENCES workspace_members(id) ON DELETE SET NULL,
  name TEXT NOT NULL,
  bank TEXT NOT NULL,
  last_four TEXT,
  card_type TEXT NOT NULL DEFAULT 'credit' CHECK (card_type IN ('credit', 'debit')),
  color TEXT NOT NULL DEFAULT '#820AD1',
  closing_day INTEGER CHECK (closing_day IS NULL OR (closing_day BETWEEN 1 AND 31)),
  due_day INTEGER CHECK (due_day IS NULL OR (due_day BETWEEN 1 AND 31)),
  credit_limit DECIMAL(12, 2),
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE accounts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  owner_member_id UUID REFERENCES workspace_members(id) ON DELETE SET NULL,
  name TEXT NOT NULL,
  account_type TEXT NOT NULL DEFAULT 'checking'
    CHECK (account_type IN ('checking', 'savings', 'cash', 'investment')),
  bank TEXT,
  current_balance DECIMAL(12, 2) DEFAULT 0,
  color TEXT,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE categories (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  icon TEXT,
  color TEXT NOT NULL DEFAULT '#6366f1',
  type TEXT NOT NULL DEFAULT 'expense' CHECK (type IN ('expense', 'income', 'transfer')),
  parent_id UUID REFERENCES categories(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE subscriptions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  amount DECIMAL(12, 2) NOT NULL,
  currency TEXT NOT NULL DEFAULT 'BRL',
  billing_cycle TEXT NOT NULL DEFAULT 'monthly'
    CHECK (billing_cycle IN ('monthly', 'yearly', 'weekly')),
  next_billing_date DATE,
  card_id UUID REFERENCES cards(id) ON DELETE SET NULL,
  account_id UUID REFERENCES accounts(id) ON DELETE SET NULL,
  category_id UUID REFERENCES categories(id) ON DELETE SET NULL,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  notes TEXT,
  logo_url TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE loans (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  third_party_id UUID REFERENCES third_parties(id) ON DELETE SET NULL,
  direction TEXT NOT NULL CHECK (direction IN ('given', 'received')),
  original_amount DECIMAL(12, 2) NOT NULL,
  paid_amount DECIMAL(12, 2) NOT NULL DEFAULT 0,
  description TEXT,
  due_date DATE,
  status TEXT NOT NULL DEFAULT 'open'
    CHECK (status IN ('open', 'partial', 'paid', 'cancelled')),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE transactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  created_by_member_id UUID REFERENCES workspace_members(id) ON DELETE SET NULL,
  paid_by_member_id UUID REFERENCES workspace_members(id) ON DELETE SET NULL,
  amount DECIMAL(12, 2) NOT NULL CHECK (amount >= 0),
  currency TEXT NOT NULL DEFAULT 'BRL',
  transaction_type TEXT NOT NULL
    CHECK (transaction_type IN (
      'expense', 'income', 'transfer',
      'loan_given', 'loan_received', 'loan_repayment'
    )),
  description TEXT NOT NULL,
  notes TEXT,
  category_id UUID REFERENCES categories(id) ON DELETE SET NULL,
  tags TEXT[],
  card_id UUID REFERENCES cards(id) ON DELETE SET NULL,
  account_id UUID REFERENCES accounts(id) ON DELETE SET NULL,
  transfer_to_account_id UUID REFERENCES accounts(id) ON DELETE SET NULL,
  transfer_group_id UUID,
  third_party_id UUID REFERENCES third_parties(id) ON DELETE SET NULL,
  loan_id UUID REFERENCES loans(id) ON DELETE SET NULL,
  is_installment BOOLEAN NOT NULL DEFAULT FALSE,
  installment_number INTEGER,
  total_installments INTEGER,
  installment_group_id UUID,
  subscription_id UUID REFERENCES subscriptions(id) ON DELETE SET NULL,
  is_recurring BOOLEAN NOT NULL DEFAULT FALSE,
  transaction_date DATE NOT NULL,
  due_date DATE,
  paid_at TIMESTAMPTZ,
  status TEXT NOT NULL DEFAULT 'confirmed'
    CHECK (status IN ('pending', 'confirmed', 'cancelled', 'scheduled')),
  ai_category_suggestion TEXT,
  ai_confidence DECIMAL(3, 2),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  CONSTRAINT transactions_payment_method_check CHECK (
    (
      transaction_type = 'transfer'
      AND account_id IS NOT NULL
    )
    OR (
      transaction_type <> 'transfer'
      AND (
        (card_id IS NOT NULL AND account_id IS NULL)
        OR (card_id IS NULL AND account_id IS NOT NULL)
      )
    )
  )
);

CREATE INDEX idx_workspace_members_user ON workspace_members(user_id);
CREATE INDEX idx_workspace_members_workspace ON workspace_members(workspace_id);
CREATE INDEX idx_workspace_invites_token ON workspace_invites(token);
CREATE INDEX idx_transactions_workspace_date ON transactions(workspace_id, transaction_date DESC);
CREATE INDEX idx_transactions_card_date ON transactions(card_id, transaction_date DESC);
CREATE INDEX idx_transactions_account_date ON transactions(account_id, transaction_date DESC);
CREATE INDEX idx_transactions_installment_group ON transactions(installment_group_id);
CREATE INDEX idx_transactions_transfer_group ON transactions(transfer_group_id);
CREATE INDEX idx_transactions_loan ON transactions(loan_id);
CREATE INDEX idx_loans_workspace_status ON loans(workspace_id, status);

-- =============================================================================
-- HELPERS / RPCs
-- =============================================================================

CREATE OR REPLACE FUNCTION public.is_workspace_member(p_workspace_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM workspace_members
    WHERE workspace_id = p_workspace_id AND user_id = auth.uid()
  );
$$;

CREATE OR REPLACE FUNCTION public.seed_default_categories(p_workspace_id UUID)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO categories (workspace_id, name, icon, color, type) VALUES
    (p_workspace_id, 'Alimentação', '🍕', '#ef4444', 'expense'),
    (p_workspace_id, 'Moradia', '🏠', '#f59e0b', 'expense'),
    (p_workspace_id, 'Transporte', '🚗', '#3b82f6', 'expense'),
    (p_workspace_id, 'Saúde', '🏥', '#ec4899', 'expense'),
    (p_workspace_id, 'Educação', '📚', '#8b5cf6', 'expense'),
    (p_workspace_id, 'Lazer', '🎬', '#06b6d4', 'expense'),
    (p_workspace_id, 'Vestuário', '👗', '#a855f7', 'expense'),
    (p_workspace_id, 'Contas & Utilities', '💡', '#eab308', 'expense'),
    (p_workspace_id, 'Pets', '🐾', '#84cc16', 'expense'),
    (p_workspace_id, 'Presentes', '🎁', '#f43f5e', 'expense'),
    (p_workspace_id, 'Empréstimos', '💸', '#f59e0b', 'expense'),
    (p_workspace_id, 'Assinaturas', '🔄', '#6366f1', 'expense'),
    (p_workspace_id, 'Outros', '📦', '#64748b', 'expense'),
    (p_workspace_id, 'Salário', '💰', '#22c55e', 'income'),
    (p_workspace_id, 'Freelance', '🏦', '#10b981', 'income'),
    (p_workspace_id, 'Investimentos', '💹', '#14b8a6', 'income'),
    (p_workspace_id, 'Reembolso', '💳', '#22c55e', 'income'),
    (p_workspace_id, 'Presente Recebido', '🎁', '#84cc16', 'income');
END;
$$;

-- Cria workspace PERSONAL + membership + categorias no signup
CREATE OR REPLACE FUNCTION public.create_personal_workspace_for_user(
  p_user_id UUID,
  p_display_name TEXT DEFAULT NULL,
  p_avatar_color TEXT DEFAULT '#6366f1'
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_workspace_id UUID;
  v_name TEXT;
BEGIN
  IF auth.uid() IS NOT NULL AND auth.uid() <> p_user_id THEN
    RAISE EXCEPTION 'Forbidden';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM workspace_members wm
    JOIN workspaces w ON w.id = wm.workspace_id
    WHERE wm.user_id = p_user_id AND w.type = 'PERSONAL'
  ) THEN
    SELECT w.id INTO v_workspace_id
    FROM workspace_members wm
    JOIN workspaces w ON w.id = wm.workspace_id
    WHERE wm.user_id = p_user_id AND w.type = 'PERSONAL'
    LIMIT 1;
    RETURN v_workspace_id;
  END IF;

  v_name := COALESCE(NULLIF(trim(p_display_name), ''), 'Pessoal') || ' (pessoal)';

  INSERT INTO workspaces (name, type)
  VALUES (v_name, 'PERSONAL')
  RETURNING id INTO v_workspace_id;

  INSERT INTO workspace_members (workspace_id, user_id, display_name, role, avatar_color)
  VALUES (
    v_workspace_id,
    p_user_id,
    COALESCE(NULLIF(trim(p_display_name), ''), 'Eu'),
    'owner',
    COALESCE(p_avatar_color, '#6366f1')
  );

  PERFORM seed_default_categories(v_workspace_id);
  RETURN v_workspace_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_display TEXT;
BEGIN
  v_display := COALESCE(
    NEW.raw_user_meta_data->>'display_name',
    split_part(NEW.email, '@', 1),
    'Eu'
  );
  PERFORM create_personal_workspace_for_user(NEW.id, v_display, '#6366f1');
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- Cria workspace compartilhado (COUPLE/FAMILY/SHARED)
CREATE OR REPLACE FUNCTION public.create_workspace_with_defaults(
  p_name TEXT,
  p_display_name TEXT,
  p_avatar_color TEXT DEFAULT '#6366f1',
  p_type TEXT DEFAULT 'COUPLE'
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_workspace_id UUID;
  v_uid UUID := auth.uid();
  v_type TEXT := upper(COALESCE(p_type, 'COUPLE'));
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  IF v_type NOT IN ('COUPLE', 'FAMILY', 'SHARED') THEN
    RAISE EXCEPTION 'Invalid workspace type for shared create';
  END IF;

  -- Garante PERSONAL (idempotente)
  PERFORM create_personal_workspace_for_user(v_uid, p_display_name, p_avatar_color);

  INSERT INTO workspaces (name, type)
  VALUES (p_name, v_type)
  RETURNING id INTO v_workspace_id;

  INSERT INTO workspace_members (workspace_id, user_id, display_name, role, avatar_color)
  VALUES (v_workspace_id, v_uid, p_display_name, 'owner', COALESCE(p_avatar_color, '#6366f1'));

  PERFORM seed_default_categories(v_workspace_id);

  RETURN v_workspace_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.accept_workspace_invite(
  p_token TEXT,
  p_display_name TEXT,
  p_avatar_color TEXT DEFAULT '#6366f1'
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_invite workspace_invites%ROWTYPE;
  v_uid UUID := auth.uid();
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  PERFORM create_personal_workspace_for_user(v_uid, p_display_name, p_avatar_color);

  SELECT * INTO v_invite
  FROM workspace_invites
  WHERE token = p_token
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Invite not found';
  END IF;
  IF v_invite.revoked_at IS NOT NULL THEN
    RAISE EXCEPTION 'Invite revoked';
  END IF;
  IF v_invite.used_at IS NOT NULL THEN
    RAISE EXCEPTION 'Invite already used';
  END IF;
  IF v_invite.expires_at < NOW() THEN
    RAISE EXCEPTION 'Invite expired';
  END IF;

  IF EXISTS (
    SELECT 1 FROM workspace_members
    WHERE workspace_id = v_invite.workspace_id AND user_id = v_uid
  ) THEN
    RAISE EXCEPTION 'Already a member of this workspace';
  END IF;

  INSERT INTO workspace_members (workspace_id, user_id, display_name, role, avatar_color)
  VALUES (
    v_invite.workspace_id,
    v_uid,
    p_display_name,
    'member',
    COALESCE(p_avatar_color, '#6366f1')
  );

  UPDATE workspace_invites
  SET used_at = NOW(), used_by_user_id = v_uid
  WHERE id = v_invite.id;

  RETURN v_invite.workspace_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.create_workspace_invite(p_workspace_id UUID)
RETURNS workspace_invites
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_member workspace_members%ROWTYPE;
  v_invite workspace_invites;
BEGIN
  SELECT * INTO v_member
  FROM workspace_members
  WHERE user_id = auth.uid() AND workspace_id = p_workspace_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Not a workspace member';
  END IF;

  INSERT INTO workspace_invites (workspace_id, created_by_member_id)
  VALUES (v_member.workspace_id, v_member.id)
  RETURNING * INTO v_invite;

  RETURN v_invite;
END;
$$;

GRANT EXECUTE ON FUNCTION public.create_personal_workspace_for_user(UUID, TEXT, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.create_workspace_with_defaults(TEXT, TEXT, TEXT, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.accept_workspace_invite(TEXT, TEXT, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.create_workspace_invite(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.is_workspace_member(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.seed_default_categories(UUID) TO authenticated;

-- =============================================================================
-- RLS
-- =============================================================================

ALTER TABLE workspaces ENABLE ROW LEVEL SECURITY;
ALTER TABLE workspace_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE workspace_invites ENABLE ROW LEVEL SECURITY;
ALTER TABLE third_parties ENABLE ROW LEVEL SECURITY;
ALTER TABLE cards ENABLE ROW LEVEL SECURITY;
ALTER TABLE accounts ENABLE ROW LEVEL SECURITY;
ALTER TABLE categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE subscriptions ENABLE ROW LEVEL SECURITY;
ALTER TABLE loans ENABLE ROW LEVEL SECURITY;
ALTER TABLE transactions ENABLE ROW LEVEL SECURITY;

CREATE POLICY workspaces_select ON workspaces FOR SELECT
  USING (is_workspace_member(id));
CREATE POLICY workspaces_insert ON workspaces FOR INSERT
  WITH CHECK (auth.uid() IS NOT NULL);
CREATE POLICY workspaces_update ON workspaces FOR UPDATE
  USING (is_workspace_member(id));

CREATE POLICY workspace_members_select ON workspace_members FOR SELECT
  USING (is_workspace_member(workspace_id) OR user_id = auth.uid());
CREATE POLICY workspace_members_insert ON workspace_members FOR INSERT
  WITH CHECK (user_id = auth.uid());
CREATE POLICY workspace_members_update ON workspace_members FOR UPDATE
  USING (user_id = auth.uid() OR is_workspace_member(workspace_id));

CREATE POLICY workspace_invites_select ON workspace_invites FOR SELECT
  USING (
    is_workspace_member(workspace_id)
    OR (
      auth.uid() IS NOT NULL
      AND used_at IS NULL
      AND revoked_at IS NULL
      AND expires_at > NOW()
    )
  );
CREATE POLICY workspace_invites_insert ON workspace_invites FOR INSERT
  WITH CHECK (is_workspace_member(workspace_id));
CREATE POLICY workspace_invites_update ON workspace_invites FOR UPDATE
  USING (is_workspace_member(workspace_id) OR auth.uid() IS NOT NULL);

CREATE POLICY third_parties_all ON third_parties FOR ALL
  USING (is_workspace_member(workspace_id)) WITH CHECK (is_workspace_member(workspace_id));
CREATE POLICY cards_all ON cards FOR ALL
  USING (is_workspace_member(workspace_id)) WITH CHECK (is_workspace_member(workspace_id));
CREATE POLICY accounts_all ON accounts FOR ALL
  USING (is_workspace_member(workspace_id)) WITH CHECK (is_workspace_member(workspace_id));
CREATE POLICY categories_all ON categories FOR ALL
  USING (is_workspace_member(workspace_id)) WITH CHECK (is_workspace_member(workspace_id));
CREATE POLICY subscriptions_all ON subscriptions FOR ALL
  USING (is_workspace_member(workspace_id)) WITH CHECK (is_workspace_member(workspace_id));
CREATE POLICY loans_all ON loans FOR ALL
  USING (is_workspace_member(workspace_id)) WITH CHECK (is_workspace_member(workspace_id));
CREATE POLICY transactions_all ON transactions FOR ALL
  USING (is_workspace_member(workspace_id)) WITH CHECK (is_workspace_member(workspace_id));

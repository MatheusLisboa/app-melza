-- Upgrade: families → workspaces (para DBs que já rodaram o schema antigo)
-- Rode UMA vez após backup. Se o projeto já usa `001` (workspaces), este script
-- só recria functions/policies (a rename é skipped).

DO $$
DECLARE
  v_ws_count BIGINT := 0;
BEGIN
  IF to_regclass('public.families') IS NULL THEN
    RAISE NOTICE 'Schema antigo (families) não encontrado — skip rename.';
    RETURN;
  END IF;

  -- Conflito típico: 001 parcial criou workspaces vazias antes de falhar
  IF to_regclass('public.workspaces') IS NOT NULL THEN
    SELECT COUNT(*) INTO v_ws_count FROM workspaces;
    IF v_ws_count = 0 THEN
      DROP TABLE IF EXISTS workspace_invites CASCADE;
      DROP TABLE IF EXISTS workspace_members CASCADE;
      DROP TABLE IF EXISTS workspaces CASCADE;
      RAISE NOTICE 'Removido shell workspaces vazio (001 parcial); seguindo rename.';
    ELSE
      RAISE EXCEPTION
        'families e workspaces coexistem (workspaces com % linhas). Rode 000_recover_partial_001.sql ou revise manualmente.',
        v_ws_count;
    END IF;
  END IF;

  ALTER TABLE families ADD COLUMN IF NOT EXISTS type TEXT;
  UPDATE families SET type = 'COUPLE' WHERE type IS NULL;
  ALTER TABLE families ALTER COLUMN type SET DEFAULT 'COUPLE';
  ALTER TABLE families ALTER COLUMN type SET NOT NULL;
  ALTER TABLE families DROP CONSTRAINT IF EXISTS families_type_check;
  ALTER TABLE families ADD CONSTRAINT families_type_check
    CHECK (type IN ('PERSONAL', 'COUPLE', 'FAMILY', 'SHARED'));

  ALTER TABLE families RENAME TO workspaces;
  ALTER TABLE family_members RENAME TO workspace_members;
  ALTER TABLE family_invites RENAME TO workspace_invites;

  ALTER TABLE workspace_members RENAME COLUMN family_id TO workspace_id;
  ALTER TABLE workspace_invites RENAME COLUMN family_id TO workspace_id;
  ALTER TABLE third_parties RENAME COLUMN family_id TO workspace_id;
  ALTER TABLE cards RENAME COLUMN family_id TO workspace_id;
  ALTER TABLE accounts RENAME COLUMN family_id TO workspace_id;
  ALTER TABLE categories RENAME COLUMN family_id TO workspace_id;
  ALTER TABLE subscriptions RENAME COLUMN family_id TO workspace_id;
  ALTER TABLE loans RENAME COLUMN family_id TO workspace_id;
  ALTER TABLE transactions RENAME COLUMN family_id TO workspace_id;

  ALTER TABLE workspace_members DROP CONSTRAINT IF EXISTS family_members_user_id_key;
  ALTER TABLE workspace_members DROP CONSTRAINT IF EXISTS workspace_members_user_id_key;

  DROP INDEX IF EXISTS idx_family_members_user;
  DROP INDEX IF EXISTS idx_family_members_family;
  DROP INDEX IF EXISTS idx_family_invites_token;
  DROP INDEX IF EXISTS idx_transactions_family_date;
  DROP INDEX IF EXISTS idx_loans_family_status;

  CREATE INDEX IF NOT EXISTS idx_workspace_members_user ON workspace_members(user_id);
  CREATE INDEX IF NOT EXISTS idx_workspace_members_workspace ON workspace_members(workspace_id);
  CREATE INDEX IF NOT EXISTS idx_workspace_invites_token ON workspace_invites(token);
  CREATE INDEX IF NOT EXISTS idx_transactions_workspace_date ON transactions(workspace_id, transaction_date DESC);
  CREATE INDEX IF NOT EXISTS idx_loans_workspace_status ON loans(workspace_id, status);
END $$;

-- Remove policies ANTES de dropar is_family_member (policies dependem dela)
DO $$
BEGIN
  IF to_regclass('public.workspaces') IS NULL THEN
    RETURN;
  END IF;

  EXECUTE 'DROP POLICY IF EXISTS families_select ON workspaces';
  EXECUTE 'DROP POLICY IF EXISTS families_insert ON workspaces';
  EXECUTE 'DROP POLICY IF EXISTS families_update ON workspaces';
  EXECUTE 'DROP POLICY IF EXISTS workspaces_select ON workspaces';
  EXECUTE 'DROP POLICY IF EXISTS workspaces_insert ON workspaces';
  EXECUTE 'DROP POLICY IF EXISTS workspaces_update ON workspaces';
  EXECUTE 'DROP POLICY IF EXISTS family_members_select ON workspace_members';
  EXECUTE 'DROP POLICY IF EXISTS family_members_insert ON workspace_members';
  EXECUTE 'DROP POLICY IF EXISTS family_members_update ON workspace_members';
  EXECUTE 'DROP POLICY IF EXISTS workspace_members_select ON workspace_members';
  EXECUTE 'DROP POLICY IF EXISTS workspace_members_insert ON workspace_members';
  EXECUTE 'DROP POLICY IF EXISTS workspace_members_update ON workspace_members';
  EXECUTE 'DROP POLICY IF EXISTS family_invites_select ON workspace_invites';
  EXECUTE 'DROP POLICY IF EXISTS family_invites_select_member ON workspace_invites';
  EXECUTE 'DROP POLICY IF EXISTS family_invites_select_token ON workspace_invites';
  EXECUTE 'DROP POLICY IF EXISTS family_invites_insert ON workspace_invites';
  EXECUTE 'DROP POLICY IF EXISTS family_invites_update ON workspace_invites';
  EXECUTE 'DROP POLICY IF EXISTS workspace_invites_select ON workspace_invites';
  EXECUTE 'DROP POLICY IF EXISTS workspace_invites_insert ON workspace_invites';
  EXECUTE 'DROP POLICY IF EXISTS workspace_invites_update ON workspace_invites';
  EXECUTE 'DROP POLICY IF EXISTS third_parties_all ON third_parties';
  EXECUTE 'DROP POLICY IF EXISTS cards_all ON cards';
  EXECUTE 'DROP POLICY IF EXISTS accounts_all ON accounts';
  EXECUTE 'DROP POLICY IF EXISTS categories_all ON categories';
  EXECUTE 'DROP POLICY IF EXISTS subscriptions_all ON subscriptions';
  EXECUTE 'DROP POLICY IF EXISTS loans_all ON loans';
  EXECUTE 'DROP POLICY IF EXISTS transactions_all ON transactions';
END $$;

-- Helpers (sempre CREATE OR REPLACE)
DROP FUNCTION IF EXISTS public.is_family_member(UUID);
DROP FUNCTION IF EXISTS public.create_family_with_defaults(TEXT, TEXT, TEXT);
DROP FUNCTION IF EXISTS public.accept_family_invite(TEXT, TEXT, TEXT);
DROP FUNCTION IF EXISTS public.create_family_invite();
DROP FUNCTION IF EXISTS public.seed_default_categories(UUID);
DROP FUNCTION IF EXISTS public.is_workspace_member(UUID);
DROP FUNCTION IF EXISTS public.create_personal_workspace_for_user(UUID, TEXT, TEXT);
DROP FUNCTION IF EXISTS public.create_workspace_with_defaults(TEXT, TEXT, TEXT);
DROP FUNCTION IF EXISTS public.create_workspace_with_defaults(TEXT, TEXT, TEXT, TEXT);
DROP FUNCTION IF EXISTS public.accept_workspace_invite(TEXT, TEXT, TEXT);
DROP FUNCTION IF EXISTS public.create_workspace_invite();
DROP FUNCTION IF EXISTS public.create_workspace_invite(UUID);

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
  IF EXISTS (SELECT 1 FROM categories WHERE workspace_id = p_workspace_id LIMIT 1) THEN
    RETURN;
  END IF;
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

-- Backfill PERSONAL / RLS apenas se workspaces existir
DO $$
DECLARE
  r RECORD;
BEGIN
  IF to_regclass('public.workspaces') IS NULL THEN
    RAISE NOTICE 'workspaces ausente — skip backfill/RLS.';
    RETURN;
  END IF;

  FOR r IN
    SELECT DISTINCT wm.user_id, wm.display_name, wm.avatar_color
    FROM workspace_members wm
    WHERE NOT EXISTS (
      SELECT 1
      FROM workspace_members wm2
      JOIN workspaces w ON w.id = wm2.workspace_id
      WHERE wm2.user_id = wm.user_id AND w.type = 'PERSONAL'
    )
  LOOP
    PERFORM create_personal_workspace_for_user(r.user_id, r.display_name, r.avatar_color);
  END LOOP;
END $$;

DO $$
BEGIN
  IF to_regclass('public.workspaces') IS NULL THEN
    RETURN;
  END IF;

  -- Policies já foram dropadas acima; aqui só (re)cria as novas
  EXECUTE 'DROP POLICY IF EXISTS workspaces_select ON workspaces';
  EXECUTE 'DROP POLICY IF EXISTS workspaces_insert ON workspaces';
  EXECUTE 'DROP POLICY IF EXISTS workspaces_update ON workspaces';
  EXECUTE 'DROP POLICY IF EXISTS workspace_members_select ON workspace_members';
  EXECUTE 'DROP POLICY IF EXISTS workspace_members_insert ON workspace_members';
  EXECUTE 'DROP POLICY IF EXISTS workspace_members_update ON workspace_members';
  EXECUTE 'DROP POLICY IF EXISTS workspace_invites_select ON workspace_invites';
  EXECUTE 'DROP POLICY IF EXISTS workspace_invites_insert ON workspace_invites';
  EXECUTE 'DROP POLICY IF EXISTS workspace_invites_update ON workspace_invites';
  EXECUTE 'DROP POLICY IF EXISTS third_parties_all ON third_parties';
  EXECUTE 'DROP POLICY IF EXISTS cards_all ON cards';
  EXECUTE 'DROP POLICY IF EXISTS accounts_all ON accounts';
  EXECUTE 'DROP POLICY IF EXISTS categories_all ON categories';
  EXECUTE 'DROP POLICY IF EXISTS subscriptions_all ON subscriptions';
  EXECUTE 'DROP POLICY IF EXISTS loans_all ON loans';
  EXECUTE 'DROP POLICY IF EXISTS transactions_all ON transactions';

  EXECUTE $p$
    CREATE POLICY workspaces_select ON workspaces FOR SELECT
      USING (is_workspace_member(id))
  $p$;
  EXECUTE $p$
    CREATE POLICY workspaces_insert ON workspaces FOR INSERT
      WITH CHECK (auth.uid() IS NOT NULL)
  $p$;
  EXECUTE $p$
    CREATE POLICY workspaces_update ON workspaces FOR UPDATE
      USING (is_workspace_member(id))
  $p$;
  EXECUTE $p$
    CREATE POLICY workspace_members_select ON workspace_members FOR SELECT
      USING (is_workspace_member(workspace_id) OR user_id = auth.uid())
  $p$;
  EXECUTE $p$
    CREATE POLICY workspace_members_insert ON workspace_members FOR INSERT
      WITH CHECK (user_id = auth.uid())
  $p$;
  EXECUTE $p$
    CREATE POLICY workspace_members_update ON workspace_members FOR UPDATE
      USING (user_id = auth.uid() OR is_workspace_member(workspace_id))
  $p$;
  EXECUTE $p$
    CREATE POLICY workspace_invites_select ON workspace_invites FOR SELECT
      USING (
        is_workspace_member(workspace_id)
        OR (
          auth.uid() IS NOT NULL
          AND used_at IS NULL
          AND revoked_at IS NULL
          AND expires_at > NOW()
        )
      )
  $p$;
  EXECUTE $p$
    CREATE POLICY workspace_invites_insert ON workspace_invites FOR INSERT
      WITH CHECK (is_workspace_member(workspace_id))
  $p$;
  EXECUTE $p$
    CREATE POLICY workspace_invites_update ON workspace_invites FOR UPDATE
      USING (is_workspace_member(workspace_id) OR auth.uid() IS NOT NULL)
  $p$;
  EXECUTE $p$
    CREATE POLICY third_parties_all ON third_parties FOR ALL
      USING (is_workspace_member(workspace_id)) WITH CHECK (is_workspace_member(workspace_id))
  $p$;
  EXECUTE $p$
    CREATE POLICY cards_all ON cards FOR ALL
      USING (is_workspace_member(workspace_id)) WITH CHECK (is_workspace_member(workspace_id))
  $p$;
  EXECUTE $p$
    CREATE POLICY accounts_all ON accounts FOR ALL
      USING (is_workspace_member(workspace_id)) WITH CHECK (is_workspace_member(workspace_id))
  $p$;
  EXECUTE $p$
    CREATE POLICY categories_all ON categories FOR ALL
      USING (is_workspace_member(workspace_id)) WITH CHECK (is_workspace_member(workspace_id))
  $p$;
  EXECUTE $p$
    CREATE POLICY subscriptions_all ON subscriptions FOR ALL
      USING (is_workspace_member(workspace_id)) WITH CHECK (is_workspace_member(workspace_id))
  $p$;
  EXECUTE $p$
    CREATE POLICY loans_all ON loans FOR ALL
      USING (is_workspace_member(workspace_id)) WITH CHECK (is_workspace_member(workspace_id))
  $p$;
  EXECUTE $p$
    CREATE POLICY transactions_all ON transactions FOR ALL
      USING (is_workspace_member(workspace_id)) WITH CHECK (is_workspace_member(workspace_id))
  $p$;
END $$;

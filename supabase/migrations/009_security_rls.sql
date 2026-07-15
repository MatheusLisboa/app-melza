-- Melza 009 — seguridad RLS: invites + members
-- Corrige:
-- 1) Qualquer autenticado podia SELECT/UPDATE todos os invites abertos
-- 2) Qualquer membro podia UPDATE role de outro / auto-escalar a owner
--
-- Nota: is_workspace_owner(p_workspace_id) já existe (006/007) — não recriar
-- (CREATE OR REPLACE com outro nome de parâmetro falha com 42P13).

GRANT EXECUTE ON FUNCTION public.is_workspace_owner(UUID) TO authenticated;

-- Members: só o próprio user (perfil) ou owner
DROP POLICY IF EXISTS workspace_members_update ON workspace_members;
CREATE POLICY workspace_members_update ON workspace_members
  FOR UPDATE
  USING (
    user_id = auth.uid()
    OR is_workspace_owner(workspace_id)
  )
  WITH CHECK (
    user_id = auth.uid()
    OR is_workspace_owner(workspace_id)
  );

-- Impede auto-promoção / troca de identity
CREATE OR REPLACE FUNCTION public.prevent_member_privilege_abuse()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.workspace_id IS DISTINCT FROM OLD.workspace_id
     OR NEW.user_id IS DISTINCT FROM OLD.user_id THEN
    RAISE EXCEPTION 'Cannot change membership identity';
  END IF;

  IF NEW.role IS DISTINCT FROM OLD.role THEN
    IF NOT public.is_workspace_owner(OLD.workspace_id) THEN
      RAISE EXCEPTION 'Only owners can change member roles';
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_prevent_member_privilege_abuse ON workspace_members;
CREATE TRIGGER trg_prevent_member_privilege_abuse
  BEFORE UPDATE ON workspace_members
  FOR EACH ROW
  EXECUTE FUNCTION public.prevent_member_privilege_abuse();

-- Invites: só membros do workspace (lookup por token via RPC abaixo)
DROP POLICY IF EXISTS workspace_invites_select ON workspace_invites;
CREATE POLICY workspace_invites_select ON workspace_invites
  FOR SELECT
  USING (is_workspace_member(workspace_id));

DROP POLICY IF EXISTS workspace_invites_update ON workspace_invites;
CREATE POLICY workspace_invites_update ON workspace_invites
  FOR UPDATE
  USING (is_workspace_member(workspace_id))
  WITH CHECK (is_workspace_member(workspace_id));

-- Preview seguro de um convite pelo token (sem listar todos)
CREATE OR REPLACE FUNCTION public.peek_workspace_invite(p_token TEXT)
RETURNS TABLE (
  id UUID,
  workspace_id UUID,
  workspace_name TEXT,
  expires_at TIMESTAMPTZ,
  used_at TIMESTAMPTZ,
  revoked_at TIMESTAMPTZ
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  RETURN QUERY
  SELECT
    i.id,
    i.workspace_id,
    w.name AS workspace_name,
    i.expires_at,
    i.used_at,
    i.revoked_at
  FROM workspace_invites i
  JOIN workspaces w ON w.id = i.workspace_id
  WHERE i.token = p_token
  LIMIT 1;
END;
$$;

GRANT EXECUTE ON FUNCTION public.peek_workspace_invite(TEXT) TO authenticated;

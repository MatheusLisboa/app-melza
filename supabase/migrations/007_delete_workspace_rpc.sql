-- Exclusão confiável de workspace pelo owner (SECURITY DEFINER bypassa RLS delete)
CREATE OR REPLACE FUNCTION public.delete_workspace_as_owner(p_workspace_id UUID)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid UUID := auth.uid();
  v_type TEXT;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'not_authenticated';
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM workspace_members wm
    WHERE wm.workspace_id = p_workspace_id
      AND wm.user_id = v_uid
      AND wm.role = 'owner'
  ) THEN
    RAISE EXCEPTION 'not_owner';
  END IF;

  SELECT w.type INTO v_type FROM workspaces w WHERE w.id = p_workspace_id;
  IF v_type IS NULL THEN
    RETURN FALSE;
  END IF;

  -- Não apaga o pessoal se for o único workspace do usuário
  IF v_type = 'PERSONAL' THEN
    IF (
      SELECT COUNT(*)::INT
      FROM workspace_members wm
      WHERE wm.user_id = v_uid
    ) <= 1 THEN
      RAISE EXCEPTION 'cannot_delete_only_personal';
    END IF;
  END IF;

  DELETE FROM workspaces WHERE id = p_workspace_id;
  RETURN FOUND;
END;
$$;

GRANT EXECUTE ON FUNCTION public.delete_workspace_as_owner(UUID) TO authenticated;

-- Garante policy de delete (caso 006 não tenha sido aplicada)
CREATE OR REPLACE FUNCTION public.is_workspace_owner(p_workspace_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM workspace_members wm
    WHERE wm.workspace_id = p_workspace_id
      AND wm.user_id = auth.uid()
      AND wm.role = 'owner'
  );
$$;

GRANT EXECUTE ON FUNCTION public.is_workspace_owner(UUID) TO authenticated;

DROP POLICY IF EXISTS workspaces_delete ON workspaces;
CREATE POLICY workspaces_delete ON workspaces FOR DELETE
  USING (is_workspace_owner(id));

DROP POLICY IF EXISTS workspace_members_delete ON workspace_members;
CREATE POLICY workspace_members_delete ON workspace_members FOR DELETE
  USING (
    user_id = auth.uid()
    OR is_workspace_owner(workspace_id)
  );

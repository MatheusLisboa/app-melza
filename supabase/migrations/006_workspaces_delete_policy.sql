-- Owner pode apagar o workspace (CASCADE limpa membros e dados)
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

-- Permite owner remover membros (ex.: antes de migrate; CASCADE de workspace também cobre)
DROP POLICY IF EXISTS workspace_members_delete ON workspace_members;
CREATE POLICY workspace_members_delete ON workspace_members FOR DELETE
  USING (
    user_id = auth.uid()
    OR is_workspace_owner(workspace_id)
  );

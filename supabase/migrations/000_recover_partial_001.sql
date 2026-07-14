-- =============================================================================
-- Recuperação: rodou 001 em cima do schema antigo (families)
-- Sintoma típico: ERROR 42P07 relation "third_parties" already exists
--
-- O que aconteceu:
--   001 criou workspaces / workspace_members / workspace_invites (vazias)
--   e parou ao encontrar third_parties (ainda do schema antigo).
--
-- Passos:
--   1) Rode ESTE arquivo
--   2) Rode 002_family_to_workspace.sql
-- =============================================================================

DO $$
DECLARE
  v_ws_count BIGINT := 0;
BEGIN
  IF to_regclass('public.families') IS NULL THEN
    RAISE EXCEPTION
      'Tabela families não encontrada. Se o banco já é só workspaces, não use este script — use 002 só para functions ou ignore.';
  END IF;

  IF to_regclass('public.workspaces') IS NOT NULL THEN
    SELECT COUNT(*) INTO v_ws_count FROM workspaces;

    IF v_ws_count > 0 THEN
      RAISE EXCEPTION
        'workspaces já tem % linhas e families ainda existe. Faça backup e revise manualmente antes de migrar.',
        v_ws_count;
    END IF;

    -- Shell vazio criado pelo 001 parcial — pode dropar
    DROP TABLE IF EXISTS workspace_invites CASCADE;
    DROP TABLE IF EXISTS workspace_members CASCADE;
    DROP TABLE IF EXISTS workspaces CASCADE;
    RAISE NOTICE 'Removido shell vazio workspaces/workspace_members/workspace_invites.';
  ELSE
    RAISE NOTICE 'Nenhum shell workspaces encontrado — ok, siga para 002.';
  END IF;
END $$;

-- Diagnóstico rápido (aparecerá no Result do SQL Editor se rodar só os SELECTs abaixo)
-- SELECT 'families' AS t, count(*) FROM families
-- UNION ALL SELECT 'third_parties', count(*) FROM third_parties;

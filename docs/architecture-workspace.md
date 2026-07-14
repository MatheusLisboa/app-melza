# Domínio: Family → Workspace

## Status

Refatoração de domínio **concluída** no código da aplicação (`src/`).  
Interface / Design System / navegação **não** foram alterados nesta etapa.

## Mapeamento

| Antes (Family) | Depois (Workspace) |
|----------------|--------------------|
| `families` | `workspaces` |
| `family_members` | `workspace_members` |
| `family_invites` | `workspace_invites` |
| `family_id` | `workspace_id` |
| cookie `active_family_id` | `active_workspace_id` |
| `create_family_with_defaults` | `create_workspace_with_defaults` |
| `accept_family_invite` | `accept_workspace_invite` |
| `is_family_member` | `is_workspace_member` |

## Tipos de workspace (produto)

- `PERSONAL` — criado automaticamente por usuário
- `COUPLE` | `FAMILY` | `SHARED` — compartilhados

## Código

- Helpers: `src/lib/supabase/workspace.ts`
- Actions: `src/lib/actions/workspace.ts`
- Types: `src/types/index.ts`
- Schema novo: `supabase/migrations/001_initial_schema.sql`
- Upgrade a partir de `families`: `004_migrate_families_complete.sql` (e auxiliares `000`–`003`)

## Fora do escopo desta etapa

- Aparência, tokens visuais, componentes, navegação
- Extração visual do Figma Make → ver `docs/design-system.md` (Source of Truth)

## Residuais intencionais

- Migrations `002`/`003`/`004` mentêm strings `family_*` históricas (renomeação SQL).
- UI copy “casal / família” como **rótulos de tipo** de workspace permanece (produto Make/PRD).

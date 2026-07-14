-- Melza — como aplicar o schema

1. Crie um projeto no Supabase + Auth (Email/Google)
2. Redirect URLs: `/auth/callback` e `/reset-password`
3. SQL Editor — **um caminho só:**

| Situação | Rodar |
|----------|--------|
| Banco **novo** (sem `families`) | `001_initial_schema.sql` |
| Ainda tem **`families`** (caso atual após falha do 002) | **`004_migrate_families_complete.sql`** |
| Já tem só `workspaces`, falta RLS/RPCs | `003_finish_workspace_migration.sql` |

| Já tem workspaces; faltam consumer / delete | `005` → `006` → **`007_delete_workspace_rpc.sql`** |

Migrations adicionais:

- `005_consumer_member_id.sql` — quem consumiu
- `006_workspaces_delete_policy.sql` — RLS delete
- **`007_delete_workspace_rpc.sql`** — exclusão real via RPC (necessária)
Confirme antes (SQL):

```sql
select to_regclass('public.families') as families,
       to_regclass('public.workspaces') as workspaces;
```

- `families` preenchido, `workspaces` null → rode **004**
- `workspaces` preenchido, `families` null → migração ok (ou rode 003 se app quebrar em RPC)

## Domínio

- `workspaces` (`PERSONAL` \| `COUPLE` \| `FAMILY` \| `SHARED`)
- Multi-membership + PERSONAL automático no signup

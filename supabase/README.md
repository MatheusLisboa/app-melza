-- FinançasCasa — como aplicar o schema

1. Crie um projeto no Supabase + Auth (Email/Google)
2. Redirect URLs: `/auth/callback` e `/reset-password`
3. SQL Editor — **um caminho só:**

| Situação | Rodar |
|----------|--------|
| Banco **novo** (sem `families`) | `001_initial_schema.sql` |
| Ainda tem **`families`** (caso atual após falha do 002) | **`004_migrate_families_complete.sql`** |
| Já tem só `workspaces`, falta RLS/RPCs | `003_finish_workspace_migration.sql` |

Não use `001`/`002`/`003` se o banco ainda tem `families` — use o **004**.

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

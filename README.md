# Melza

App de finanças pessoais e compartilhadas (workspaces).

## Setup rápido

```bash
cp .env.local.example .env.local
# Preencha NEXT_PUBLIC_SUPABASE_URL e NEXT_PUBLIC_SUPABASE_ANON_KEY
# (opcional) OPENAI_API_KEY, SUPABASE_SERVICE_ROLE_KEY (exclusão de conta)

npm install
npm run dev
```

## Supabase

1. Crie o projeto e habilite Auth (Email + Google)
2. Redirect URLs: `http://localhost:3000/auth/callback` e `…/reset-password`
3. SQL:
   - **Novo:** [`supabase/migrations/001_initial_schema.sql`](supabase/migrations/001_initial_schema.sql)
   - **Upgrade de families:** [`002_family_to_workspace.sql`](supabase/migrations/002_family_to_workspace.sql)
4. Detalhes em [`supabase/README.md`](supabase/README.md)

## Scripts

| Comando | Uso |
|---------|-----|
| `npm run dev` | Dev server |
| `npm run build` | Build produção |
| `npm run lint` | ESLint |
| `npm test` | Testes unitários (vitest) |

## Domínio (workspaces)

- Tipos: `PERSONAL`, `COUPLE`, `FAMILY`, `SHARED`
- Todo usuário ganha `PERSONAL` no signup
- Multi-membership + switcher + cookie `active_workspace_id`
- Onboarding opcional (continuar sozinho ou criar compartilhado)

## Produção

- Checklist: [`docs/SMOKE_CHECKLIST.md`](docs/SMOKE_CHECKLIST.md)
- CI: GitHub Actions (`.github/workflows/ci.yml`)
- Headers: `vercel.json`
- LGPD: export/delete em Configurações; páginas `/privacy` e `/terms`

## PWA

Manifest + service worker + ícones em `public/icons/`. No celular (HTTPS/localhost): Adicionar à tela inicial.

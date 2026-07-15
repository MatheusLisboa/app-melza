# Melza

App de finanças pessoais e compartilhadas (workspaces) — Next.js 14, Supabase, PWA.

## Setup rápido

```bash
cp .env.local.example .env.local
# Preencha NEXT_PUBLIC_SUPABASE_URL e NEXT_PUBLIC_SUPABASE_ANON_KEY
# IA (chat + categorização): GROQ_API_KEY — grátis em console.groq.com
# Opcional: OPENAI_API_KEY, AI_PROVIDER=groq|openai|auto, SUPABASE_SERVICE_ROLE_KEY

npm install
npm run dev
```

Abra [http://localhost:3000](http://localhost:3000).

## Stack

- **App:** Next.js 14 (App Router) + TypeScript + Tailwind
- **Dados / auth:** Supabase (Postgres, Auth, Storage, RLS)
- **IA:** Groq por padrão (`@ai-sdk/groq`); OpenAI opcional via `AI_PROVIDER`
- **UI:** Design System Melza (preto / branco / prata) — [`.cursor/melza-design-system.md`](.cursor/melza-design-system.md)

## O que o app faz

- Workspaces `PERSONAL` | `COUPLE` | `FAMILY` | `SHARED`
- Contas, cartões, lançamentos, faturas por ciclo, assinaturas, empréstimos
- **Entre Nós** (acerto entre membros no workspace compartilhado)
- Relatórios, importação Nubank (PDF), prévia / PDF da fatura
- Chat IA (`/chat`): consulta saldos/limites/faturas, criar lançamento, pagar fatura, etc.
- Tema claro/escuro, PWA, perfil com avatar

## Supabase

1. Crie o projeto e habilite Auth (Email + Google)
2. Redirect URLs: `http://localhost:3000/auth/callback` e `…/reset-password`
3. SQL — detalhes e ordem em [`supabase/README.md`](supabase/README.md)

| Situação | Migrations |
|----------|------------|
| Banco **novo** | `001_initial_schema.sql` (+ `005`…`008` se não estiverem no 001) |
| Ainda tem `families` | `004_migrate_families_complete.sql` (ver README do Supabase) |
| Já em workspaces | garantir `005` → `006` → `007` → `008` → **`009_security_rls.sql`** |

Bucket de Storage `avatars` (público de leitura) é necessário para foto de perfil — ver nota em `008_avatar_url.sql`.

## IA

| Variável | Uso |
|----------|-----|
| `GROQ_API_KEY` | Padrão — chat + categorização |
| `OPENAI_API_KEY` | Alternativa / fallback com `AI_PROVIDER=auto` |
| `AI_PROVIDER` | `groq` (padrão) · `openai` · `auto` |

O chat usa tools (dados reais do workspace). Groq é rápido e gratuito, mas multi-turno + tools pode falhar às vezes; OpenAI/Gemini tendem a ser mais estáveis.

## Scripts

| Comando | Uso |
|---------|-----|
| `npm run dev` | Dev server |
| `npm run build` | Build produção |
| `npm run start` | Serve build |
| `npm run lint` | ESLint |
| `npm test` | Testes unitários (vitest) |
| `npm run test:watch` | Vitest em watch |

## Domínio (workspaces)

- Todo usuário ganha `PERSONAL` no signup
- Multi-membership + switcher + cookie `active_workspace_id`
- Onboarding opcional (continuar sozinho ou criar compartilhado)
- Arquitetura: [`docs/architecture-workspace.md`](docs/architecture-workspace.md)

## Produção

- Checklist: [`docs/SMOKE_CHECKLIST.md`](docs/SMOKE_CHECKLIST.md)
- CI: GitHub Actions (`.github/workflows/ci.yml`)
- Headers / PWA: `vercel.json`
- LGPD: export/delete em Configurações; páginas `/privacy` e `/terms`
- Variáveis na Vercel: mesmas do `.env.local.example` (obrigatório `GROQ_API_KEY` se o chat for usado)

## PWA

Manifest + service worker + ícones em `public/icons/`. No celular (HTTPS/localhost): Adicionar à tela inicial.

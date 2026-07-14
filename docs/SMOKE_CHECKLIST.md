# Smoke checklist — produção / staging

## Pré-requisitos
- [ ] `.env` de staging/prod com Supabase URL + anon + service role
- [ ] Migration `001` (nova) ou `002` (upgrade) aplicada
- [ ] Auth: Email + Google, redirect `/auth/callback`
- [ ] Template de e-mail de reset de senha no Supabase apontando para `/reset-password`

## Auth
- [ ] Signup cria usuário e workspace PERSONAL (trigger)
- [ ] Login e-mail/senha
- [ ] Login Google
- [ ] Esqueci a senha → e-mail → `/reset-password` atualiza senha
- [ ] Logout

## Workspaces
- [ ] Onboarding: "Continuar no pessoal" → dashboard
- [ ] Criar workspace COUPLE / FAMILY / SHARED
- [ ] Switcher troca workspace ativo (cookie) e dados mudam
- [ ] Convite: gerar link → aceitar em outra conta → multi-membership
- [ ] Lista de membros em Configurações

## Financeiro
- [ ] Criar cartão e conta
- [ ] Lançamento despesa/receita/transferência/parcelas
- [ ] Faturas por cartão/mês
- [ ] Assinaturas + alerta
- [ ] Empréstimo + quitação parcial
- [ ] Relatórios + export CSV
- [ ] Import CSV Nubank/Inter

## APIs / limites
- [ ] AI categorize sem key → 503 amigável
- [ ] Burst de import/AI → 429
- [ ] Export JSON LGPD
- [ ] Apagar conta (service role) remove auth user

## PWA / mobile
- [ ] Manifest + ícones
- [ ] Instalável no celular
- [ ] Offline: shell cache (dashboard)

## Deploy
- [ ] Preview Vercel build green
- [ ] Domínio + HTTPS
- [ ] Env vars na Vercel

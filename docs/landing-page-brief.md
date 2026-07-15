# Melza — Brief de landing page

Documento para design/copy/dev construir a landing. Baseado no produto real (código + design system), julho 2026.

---

## 1. Essência da marca

| | |
|--|--|
| **Nome** | Melza |
| **Categoria** | Finanças pessoais e compartilhadas |
| **Promessa** | Controle claro do dinheiro — sozinho ou a dois/família — com cartões, faturas e um assistente que age nos dados reais |
| **Tom** | Sofisticado, direto, brasileiro. Sem “fintech roxa”, sem carrossel de emojis |
| **Inspiração visual** | XP Investimentos: preto, branco, prata; hierarquia por tipografia |

**Tagline candidatas**
- “Finanças da casa, sem enrolação.”
- “Seu dinheiro. Seu workspace. Sua fatura em dia.”
- “Pessoal ou compartilhado — saldo, cartão e acerto no mesmo lugar.”

**Anti-taglines (evitar)**
- “Revolucione suas finanças com IA”
- “O futuro do dinheiro”
- Qualquer promessa de investimento / rendimento

---

## 2. Problema que resolve

1. Casal/família mistura pix, cartão de um, gasto do outro — **não sabe quem deve a quem**
2. Fatura do cartão some no app do banco; no app de finanças **não fecha com o ciclo real**
3. Planilhas / apps genéricos não entendem **parcela, assinatura, empréstimo a terceiro**
4. Lançar gasto é chato — a pessoa abandona o hábito
5. Relatórios existem, mas ninguém usa no celular

**Melza responde com:** workspace compartilhado, fatura por ciclo de fechamento, Entre Nós, chat que consulta e registra, PWA no bolso.

---

## 3. Para quem é

### Primário
- Casais que dividem conta / cartão / aluguel
- Pessoas que querem visão única de várias contas e cartões (Nubank, Inter, etc.)

### Secundário
- Famílias pequenas (mesmo workspace)
- Quem empresta/toma dinheiro de amigos e quer saldo pendente

### Não é (ainda)
- Contabilidade empresarial completa
- Corretora / investimentos
- Open Finance agregado de todos os bancos automaticamente (há import PDF Nubank; não é sync total)

---

## 4. Produto — o que existe de verdade

### 4.1 Workspaces
- **Pessoal** — só você (criado no signup)
- **Casal / Família / Compartilhado** — vários membros, papéis, convite por link
- Troca de workspace no header
- Onboarding: continuar sozinho ou criar/entrar em compartilhado

### 4.2 Dinheiro do dia a dia
- **Contas** (corrente, poupança, dinheiro, investimento) com saldo
- **Cartões** (crédito/débito): limite, fechamento, vencimento, cores por banco
- **Lançamentos:** despesa, receita, transferência, empréstimo dado/recebido, pagamento de empréstimo
- Parcelas, categorias, quem pagou / quem consumiu / dono do cartão
- Histórico com filtros; modal mobile bottom-sheet

### 4.3 Faturas
- Ciclo pelo **dia de fechamento** (não só “mês civil”)
- Total, já pago, restante
- Pagar fatura (parcial ou total) debitando uma conta
- Prévia da fatura → Salvar PDF / imprimir (marca Melza no topo)
- Importar fatura Nubank (PDF)

### 4.4 Entre Nós (só workspace compartilhado)
- Quem pagou com o cartão/conta de quem
- Resumo: “X deve R$ Y a Z”
- Timeline de divisões / atalho para combinar PIX

### 4.5 Assinaturas e empréstimos
- Recorrências (mensal/anual/semanal), próxima cobrança
- Empréstimos com terceiros: aberto / parcial / quitado

### 4.6 Relatórios
- Período, filtros por cartão/membro/categoria
- Totais e breakdown; export CSV; import CSV

### 4.7 Chat IA
- Perguntas com **dados reais** do workspace (não inventa)
- Exemplos:
  - “Limite disponível”
  - “Quanto tá a fatura?”
  - “Quem deve a quem?”
  - “Lança R$ 45 no iFood no Nubank”
  - “Cadastra Netflix”
  - “Categoriza o histórico sem categoria”
- Ações de escrita pedem **confirmação** (preview)
- Categorização automática no formulário de lançamento (despesa e receita)

### 4.8 Conta e confiança
- Login e-mail + Google
- Tema claro / escuro
- Avatar de perfil
- PWA (adicione à tela inicial)
- Exportar / excluir dados (LGPD)
- Páginas Privacidade e Termos

### Mapa de telas (navegação)
Início · Histórico · Cartões · Contas · Entre Nós · Faturas · Assinaturas · Empréstimos · Chat IA · Relatórios · Perfil

Mobile: Início · Histórico · **IA** · Cartões · **Mais** (resto dos módulos)

---

## 5. Diferenciais para destacar na landing

1. **Compartilhado de verdade** — não só “ver juntos”, mas **Entre Nós** (acerto)
2. **Fatura como o cartão** — ciclo de fechamento + pagamento parcial + PDF Melza
3. **IA operacional** — pergunta e age (com confirmação), não só chat motivacional
4. **Mobile-first / PWA** — bottom sheet, nav flutuante, installable
5. **Visual sóbrio** — preto/branco/prata; números em mono; verde/vermelho só em valores

---

## 6. Estrutura sugerida da landing

### Hero (1º viewport)
- Logo / wordmark Melza (marca dominante)
- Headline curta (1 linha)
- Subhead (1 frase)
- CTA primário: **Criar conta** → `/signup`
- CTA secundário: **Entrar** → `/login`
- Visual: mock do app (dashboard dark balance card + fatura ou Entre Nós) — full-bleed ou edge-to-edge, sem card “flutuando” genérico

**Copy hero (opções)**

> **Melza**  
> Finanças da casa, no preto e branco.  
> Pessoal ou a dois. Cartões, faturas e quem deve a quem — com um chat que entende seus dados.

CTA: `Começar grátis`

### Bloco 2 — “Sozinho ou juntos”
- Personal vs Casal/Família
- Convite por link
- Screenshot: switcher de workspace + Entre Nós

### Bloco 3 — “Fatura que fecha”
- Ciclo, restante, pagar, PDF
- Screenshot: tela Faturas + prévia PDF

### Bloco 4 — “Pergunte ao Melza”
- 4–5 exemplo de prompts (bullets)
- Deixar claro: usa seus dados; não inventa; confirma antes de gravar

### Bloco 5 — “No bolso”
- PWA, dark mode, fluxos em bottom sheet
- Ideal para print mobile

### Bloco 6 — “O que entra”
Grid de features (ícone leve + título + 1 linha):
Contas · Cartões · Lançamentos · Faturas · Entre Nós · Assinaturas · Empréstimos · Relatórios · Chat IA · Import Nubank · CSV · LGPD

### Bloco 7 — FAQ
Ver seção 9

### Footer
Links: Privacidade, Termos, Entrar, Criar conta  
© Melza

---

## 7. Direção visual (obrigatória para a landing)

### Cores
| Uso | Hex |
|-----|-----|
| Ink / marca / CTA | `#111111` |
| Fundo página | `#F2F2F7` (pearl) ou branco |
| Texto secundário | `#8E8E93` |
| Bordas | `#E5E5EA` |
| Hero dark (mock) | `#111111` com texto branco |
| Receita (só valor) | `#22C55E` |
| Despesa (só valor) | `#EF4444` |

**Proibido na landing:** roxo/indigo “startup”, lilac glow, cream+terracotta, layout jornal, pills roxas, neons.

### Tipografia
- UI: Inter (ou similar geométrica sóbria)
- Dinheiro: JetBrains Mono
- Nome “Melza” no hero: itálico tipográfico, tracking negativo, peso alto (como wordmark do app)

### Logo
- Monograma **M** itálico em quadrado preto (ou invertido branco)
- Wordmark “Melza” ao lado
- Arquivos: ícones em `public/icons/`; componente `BrandMark` / `BrandWordmark` no app

### Motion (2–3 suficientes)
- Fade/slide suave do mock no hero
- Press/scale no CTA
- Opcional: troca leve personal ↔ compartilhado no bloco 2

---

## 8. CTAs e URLs

| CTA | Destino |
|-----|---------|
| Começar / Criar conta | `/signup` |
| Entrar | `/login` |
| Privacidade | `/privacy` |
| Termos | `/terms` |

Se a landing for site separado: apontar para o domínio do app (ex. produção Vercel).

---

## 9. FAQ (copy pronta)

**É grátis?**  
Hoje o app é pensado para uso pessoal; infraestrutura (hosting/IA) pode evoluir. Não vender preço inventado — alinhar com política comercial atual.

**Funciona no celular?**  
Sim. É web app + PWA: dá para instalar na tela inicial.

**Preciso conectar o Open Finance?**  
Não é obrigatório. Você lança manualmente, importa CSV ou importa PDF da fatura Nubank.

**Como funciona o “Entre Nós”?**  
No workspace compartilhado, o Melza estima quem usou o cartão/conta de quem e mostra quanto acertar.

**A IA vê meu dinheiro?**  
O chat consulta os dados do seu workspace para responder e, se você pedir, preparar lançamentos — com confirmação antes de gravar. Use chave de IA configurada pelo produto (ex. Groq).

**Meus dados estão seguros?**  
Auth Supabase, regras por workspace (RLS), exportação e exclusão de conta nas configurações. Detalhes em `/privacy`.

**Posso ter workspace pessoal e de casal?**  
Sim. Todo mundo começa com pessoal e pode criar ou entrar em compartilhado.

---

## 10. Provas / credibilidade (sem inventar métricas)

Usar só o que for verdadeiro:
- “Feito para o Brasil (R$, PIX, fatura Nubank)”
- “Design system próprio — preto, branco e prata”
- “PWA + dark mode”
- Evitar: “usado por X mil casais”, NPS, app store ratings inventados

Screenshots reais do app > ilustrações genéricas de “dashboard financeiro”.

---

## 11. Seções / wire em texto

```
[Nav] Melza · Entrar · Começar
[Hero] Marca + headline + CTAs + visual full
[Seção] Pessoal ou compartilhado
[Seção] Faturas & cartões
[Seção] Entre Nós
[Seção] Chat IA (exemplos)
[Seção] Grade de módulos
[Seção] PWA / mobile
[FAQ]
[Footer CTA] Começar grátis
[Footer links]
```

---

## 12. Microcopy útil

| Elemento | Texto |
|----------|--------|
| Botão principal | Começar grátis |
| Botão secundário | Já tenho conta |
| Badge opcional | Pessoal · Casal · Família |
| Rodapé produto | Melza — finanças da casa |
| Alt do mock | Tela do Melza com saldo e fatura do cartão |

---

## 13. Checklist de conteúdo para o designer/dev

- [ ] Wordmark Melza no hero (não só nav)
- [ ] Sem purple AI aesthetic
- [ ] Mock com tipografia mono nos valores
- [ ] Entre Nós citado (diferencial)
- [ ] Fatura + PDF citados
- [ ] Chat com exemplos reais de prompt
- [ ] Links login/signup/privacy/terms
- [ ] Mobile 1º viewport limpo (marca, 1 headline, 1 frase, CTAs, 1 visual)

---

## 14. Stack (só se a landing for “about the product tech” — opcional / footer fino)

Next.js · Supabase · PWA · IA assistiva  

Não precisa ser centro da página.

---

*Fonte: código Melza (`financas-casa`), design system Melza v2, fluxos de Início / Faturas / Entre Nós / Chat / PWA. Atualizar este brief se o produto ganhar Open Finance, planos pagos, etc.*

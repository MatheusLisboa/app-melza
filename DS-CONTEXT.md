# Melza App — Design System & App Context
**Última atualização:** Agosto 2026

---

## 📋 Visão Geral do Projeto

**App:** Melza — Gestão financeira colaborativa com suporte a workspaces
**Tech Stack:**
- Framework: Next.js 14+ (App Router)
- UI: React 18+
- Styling: Tailwind CSS 3 + CSS variables
- Form validation: React Hook Form + Zod
- Query: TanStack React Query v5
- Icons: Lucide React
- Base de dados: Supabase
- Auth: Supabase Auth + Server-Side Sessions (SSR)

**Estrutura de pastas:**
```
src/
├── app/               # Routes (App Router)
│   ├── (app)/        # Protected routes (com AppShell)
│   ├── (auth)/       # Auth routes (sem shell)
│   ├── api/          # API routes
│   ├── fonts/        # Font files
│   └── globals.css   # Global styles + design tokens
├── components/
│   ├── design-system/    # Melza v2 components (primários)
│   ├── shared/          # Forms, layout wrappers, providers
│   ├── ui/              # shadcn/ui + primitivos (legados)
│   ├── dashboard/       # Dashboard-specific
│   ├── transactions/    # Transações
│   ├── cards/          # Cartões
│   ├── invoices/       # Faturas
│   ├── accounts/       # Contas
│   ├── charts/         # Gráficos
│   └── entre-nos/      # Feature de pool
├── lib/
│   ├── utils.ts        # `cn()` utility
│   ├── utils/          # Helpers (format, workspace, etc)
│   └── hooks/          # Custom hooks
├── types/              # Tipos globais
└── instrumentation.ts  # Analytics/logging

```

---

## 🎨 Design System Melza v2

### Filosofia
Preto, branco e prata. **Hierarquia por peso tipográfico**, não por cor.
- Única cor de marca: preto (`#111111`)
- Verde/vermelho: **apenas** para receita/despesa (texto, nunca background)
- Inspiração: XP Investimentos — sofisticação financeira

### Tokens CSS (CSS variables)

**Neutros (paleta fixa):**
| Token              | Hex       | Nome       | Uso                                     |
|--------------------|-----------|------------|-----------------------------------------|
| `--color-ink`      | `#111111` | Ink        | Hero, botão primário, texto forte       |
| `--color-night`    | `#1C1C1E` | Night      | Ícones de categoria, dark elements      |
| `--color-onyx`     | `#2C2C2E` | Onyx       | Bordas dark, hover states               |
| `--color-graphite` | `#3A3A3C` | Graphite   | Texto terciário em fundo escuro         |
| `--color-silver`   | `#8E8E93` | Silver     | Texto secundário, labels, metadata      |
| `--color-mist`     | `#C7C7CC` | Mist       | Bordas sutis, separadores               |
| `--color-fog`      | `#E5E5EA` | Fog        | Bordas de cards, hover                  |
| `--color-pearl`    | `#F2F2F7` | Pearl      | Fundo da página                         |
| `--color-white`    | `#FFFFFF` | White      | Fundo de cards                          |

**Semânticas (apenas valores financeiros):**
| Token               | Hex       | Uso                                 |
|---------------------|-----------|-------------------------------------|
| `--color-income`    | `#22C55E` | Valores positivos / receitas        |
| `--color-expense`   | `#EF4444` | Valores negativos / despesas        |
| `--color-warning`   | `#F59E0B` | Empréstimos, alertas de prazo       |

> ⚠️ Verde/vermelho **nunca** aparecem como background de card, botão ou badge de categoria. Apenas em texto de valor monetário.

**Dark mode:**
Todos os tokens semânticos *flip* automaticamente via `.dark` class no `:root`.

**Tipografia:**
```css
--font-ui:    'Inter', -apple-system, sans-serif;
--font-mono:  'JetBrains Mono', 'Courier New', monospace;
```
`--font-mono` é **obrigatória** para todo valor monetário — sem exceção.

### Escala Tipográfica

| Papel                   | Fonte        | Tamanho | Peso | Cor                  |
|-------------------------|--------------|---------|------|----------------------|
| Saldo hero              | `--font-mono`| 36–40px | 800  | `--color-white`      |
| Título de seção (h1)    | `--font-ui`  | 32px    | 800  | `--color-text`       |
| Página title (h2)       | `--font-ui`  | 22px    | 700  | `--color-text`       |
| Card title (h3)         | `--font-ui`  | 18px    | 700  | `--color-text`       |
| Nome de item / título   | `--font-ui`  | 14–15px | 600  | `--color-ink`        |
| Valor monetário         | `--font-mono`| 14px    | 700  | `--color-income` ou `--color-expense` |
| Metadata (categoria)    | `--font-ui`  | 12–13px | 400  | `--color-silver`     |
| Label de campo          | `--font-ui`  | 11px    | 600  | `--color-silver`     |
| Caption / hint          | `--font-ui`  | 12px    | 400  | `--color-text-3`     |

### Border Radius

| Contexto                      | Valor |
|-------------------------------|-------|
| Botões, inputs, badges        | `8px` |
| Cards de item (transações)    | `12px`|
| Card hero, cards grandes      | `16px`|
| Modal / bottom sheet (top)    | `20px`|
| Pills, badges de status       | `20px`|
| Avatar / ícone circular       | `50%` |

### Componentes Melza v2

**Localização:** `/src/components/design-system/`

Exportados via `index.ts`:
```typescript
export { MoneyDisplay } from "./money-display";
export { BalanceCard } from "./balance-card";
export { AttributionTrio } from "./attribution-trio";
export { Fab } from "./fab";
export { DsSkeleton } from "./skeleton";
export { InputField } from "./input-field";
export { TopBar } from "./top-bar";
export { BrandMark, BrandWordmark, BrandLockup } from "./brand-mark";
export { TxRow } from "./tx-row";
export { Avatar } from "./avatar";
export { WorkspaceAvatar } from "./workspace-avatar";
export { Badge } from "./badge";
export { Btn } from "./btn";
export { Divider } from "./divider";
export { StatusBar } from "./status-bar";
export { BottomNav } from "./bottom-nav";
export { EmptyState } from "./empty-state";
export type { DsMember, DsWorkspaceVisual } from "./types";
```

#### **Btn** (74 linhas)
Botão Melza principal — variantes: `primary`, `secondary`, `ghost`, `destructive`
Tamanhos: `sm` (36px), `md` (44px), `lg` (52px)
```typescript
<Btn variant="primary" size="md" fullWidth icon={<Icon />}>
  Texto
</Btn>
```

#### **BalanceCard** (129 linhas)
Hero card ink com barra de progresso e trio Entradas/Saídas.
- Fundo: `--color-hero` (ink)
- Valor: `--font-mono` 36px weight 800
- Suporta toggle de visualização (Eye/EyeOff)

#### **TxRow** (133 linhas)
Row de transação — emoji, título, categoria, data, valor, badges de status.
- Avatar com inicial ou emoji
- Suporta Attribution Trio (consumer/payer/cardOwner)
- Tipos: `income`, `expense`, `other`
- Badges: `paid`, `pending`, `overdue`, `fixed`, `installment`

#### **BottomNav** (274 linhas)
Navegação flutuante mobile (inset pill, backdrop-blur).
- Ativa via pathname
- Menu "Mais" em sheet para links secundários
- Ícones de Lucide React

#### **Badge** (52 linhas)
Pills com presets de status:
| Status    | Fundo     | Texto     |
|-----------|-----------|-----------|
| `paid`    | `#F0FDF4` | `#166534` |
| `pending` | `#FEF9EE` | `#92400E` |
| `overdue` | `#FEF2F2` | `#991B1B` |
| `fixed`   | `--color-chip` | `--color-text-2` |
| `installment` | `--color-ink` | `#FFFFFF` |

Todos: `border-radius: 20px`, `padding: 3px 10px`, `font-size: 11px`, weight 600.

#### **InputField** (85 linhas)
Input wrapper Melza com label, error, helper text.
- Suporta `type`, `placeholder`, `disabled`, `error`
- Usa tokens CSS para estilos

#### **TopBar** (51 linhas)
Header mobile — back button, título, ações contextuais.

#### **Avatar** (44 linhas)
Avatar circular — imagem ou inicial com background colorido.

#### **MoneyDisplay** (45 linhas)
Exibe valor monetário com cor (income/expense) e fonte mono.

#### **BrandMark** (105 linhas)
Logo e variantes — `BrandMark`, `BrandWordmark`, `BrandLockup`.

#### **Others**
- `DsSkeleton`: skeleton shimmer
- `Fab`: floating action button
- `Divider`: separator line
- `StatusBar`: status indicator
- `EmptyState`: placeholder vazio
- `WorkspaceAvatar`: avatar workspace
- `AttributionTrio`: trio de membros compartilhados
- `types.ts`: `DsMember`, `DsWorkspaceVisual`

### Sombras e Elevação

Multi-layer premium shadows (light + dark):
```css
--shadow-card: 0 1px 2px rgba(0,0,0,0.04), 0 2px 8px rgba(0,0,0,0.06);
--shadow-card-hover: 0 2px 4px rgba(0,0,0,0.06), 0 12px 28px rgba(0,0,0,0.10);
--shadow-card-dark: 0 1px 2px rgba(0,0,0,0.3), 0 2px 8px rgba(0,0,0,0.35);
--shadow-card-hover-dark: 0 2px 4px rgba(0,0,0,0.4), 0 12px 28px rgba(0,0,0,0.5);
--shadow-fab: 0 6px 20px rgba(0,0,0,0.18);
--shadow-modal: 0 -4px 24px rgba(0,0,0,0.08);
```

### Motion

```css
--motion-fast: 150ms;
--motion-base: 150ms;
--motion-slow: 150ms;
--ease-out: ease;
```

Keyframes:
- `fade-up`: `0px` → `0px` com fade (150ms)
- `fade-up-lg`: `16px` → `0px` com fade (500ms cubic-bezier)
- `fade-scale`: scale `0.96` → `1` (400ms)
- `ws-switch`: opacity toggle (150ms)

Respeita `prefers-reduced-motion`.

---

## 🗂️ Estrutura de Componentes

### `/components/design-system/` (Primários Melza v2)
- **Uso:** Novas telas, refatoração de DS
- **Padrão:** Tokens CSS, sem hardcoded hex
- **Exports:** Via barrel (`index.ts`)
- **Estilo:** Tailwind + inline styles com tokens

### `/components/shared/` (Shared Logic & Forms)
Componentes de negócio — forms, layouts, wrappers:
- `app-shell.tsx`: Layout raiz (sidebar + bottom nav)
- `app-nav.tsx`: AppSidebar, MobileHeader, MobileNav
- `providers.tsx`: React Query, Theme Provider
- `create-workspace-form.tsx`: Onboarding workspace
- `login-form.tsx`, `signup-form.tsx`, etc.
- `onboarding-form.tsx`: Fluxo de primeiro acesso
- `pwa-register.tsx`: Service worker PWA
- `push-notifications-settings.tsx`: Notificações
- `theme-toggle.tsx`: Dark/light switch

**Total:** ~2,700 linhas (forms + app layout)

### `/components/ui/` (shadcn/ui + Primitivos)
**Status:** LEGADO — prefira `/design-system/` em novas telas.

Componentes shadcn/ui com deprecation warnings:
- `button.tsx` — @deprecated, use `Btn`
- `card.tsx`, `dialog.tsx`, `drawer.tsx`
- `input.tsx`, `label.tsx`, `select.tsx`
- `tabs.tsx`, `separator.tsx`, `checkbox.tsx`

Mantidos por compatibilidade com código antigo.

### `/components/{dashboard,transactions,cards,accounts,invoices,charts}/`
Componentes de features — usam design-system + shared.

---

## 🎯 App Router & Routes

**Protected routes** (requer auth, usa `AppShell`):
```
(app)/
├── dashboard          # Home
├── transactions       # Histórico
├── chat              # IA assistant
├── cards             # Cartões de crédito
├── accounts          # Contas bancárias
├── invoices          # Faturas
├── subscriptions     # Assinaturas
├── loans             # Empréstimos
├── reports           # Relatórios
├── entre-nos         # Feature compartilhada (pool)
└── settings          # Perfil & configurações
```

**Public routes:**
```
(auth)/
├── login             # Form login
├── signup            # Form signup
├── forgot-password   # Recovery
└── [token]           # Invite accept

api/
├── shell             # GET /api/shell (user + memberships)
├── [workspace-specific endpoints]
```

**Landing:**
```
onboarding/          # Onboarding flow
auth/callback        # OAuth callback
```

---

## 📐 Tailwind Config Customization

**Extends:**
```typescript
theme: {
  extend: {
    colors: {
      // shadcn HSL (deprecated in favor of Melza tokens)
      background, foreground, card, primary, destructive...
      
      // Melza colors (uso preferido)
      melza: {
        ink, night, onyx, graphite, silver, mist, fog, pearl, white,
        income, expense, warning,
        // aliases legados
        bg, surface, border, "border-hi", "silver-hi", "silver-lo", ...
      }
    },
    borderRadius: {
      lg: "10px", md: "8px", sm: "6px", 
      xl: "14px", "2xl": "16px", "3xl": "20px"
    },
    boxShadow: {
      fab, modal, card, "card-hover", 
      "card-dark", "card-hover-dark"
    },
    keyframes: {
      "fade-up", "fade-up-lg", "fade-scale", "ws-switch"
    }
  }
}
```

**Dark mode:** `class` (manual toggle ou SSR detect)

---

## 🔧 CSS Utilities Classes

**Layout:**
- `.page-pad`: padding responsive (4px mobile, 5px desktop)
- `.app-main`: container principal com padding-bottom PWA-safe
- `.page-enter`: animação fade-up-lg ao entrar

**Interaction:**
- `.pressable`: scale active + fade
- `.pressable-subtle`: scale mais suave
- `.hover-lift`: transform translateY com shadow

**Content:**
- `.scroll-fade-x`: fade nas bordas de scroll horizontal
- `.border-melza`, `.border-melza-hi`: borders com tokens
- `.card-melza`: card base (background + border + radius)
- `.touch-target`: min 44x44px (HIG/Material)

**Colors & Tinting:**
- `.text-expense`, `.text-income`: cor + font-mono
- `.bg-success-tint`, `.bg-warning-tint`, `.bg-info-tint`: backgrounds tintados

---

## 📦 Key Dependencies

```json
{
  "next": "14+",
  "react": "18+",
  "tailwindcss": "3.x",
  "@tanstack/react-query": "^5.101.2",
  "@radix-ui/*": "1.x",
  "lucide-react": "^1.24.0",
  "@supabase/supabase-js": "^2.110.5",
  "react-hook-form": "^7.x",
  "class-variance-authority": "^0.7.1",
  "clsx": "^2.1.1",
  "date-fns": "^4.4.0"
}
```

---

## 📊 Inventário Real — Codebase Audit (Agosto 2026)

### Estrutura de Componentes — Linhas de código
```
/design-system/     1,308 linhas   19 arquivos    ✅ Novo padrão
/shared/            2,724 linhas   18 arquivos    🔧 Forms + layout
/ui/ (shadcn)       1,133 linhas   14 arquivos    ⚠️  LEGADO
/transactions/      1,948 linhas    7 arquivos    🔄 Refatorar
/invoices/          1,160 linhas    4 arquivos    🔄 Refatorar
/dashboard/           357 linhas    1 arquivo     🔄 Refatorar
/accounts/            295 linhas    1 arquivo     🔄 Refatorar
/cards/               317 linhas    1 arquivo     🔄 Refatorar
/entre-nos/           297 linhas    1 arquivo     🔄 Refatorar
/charts/                0 linhas    0 arquivos    ❌ VAZIO (add viz?)
---
Lib (actions/ai/finance/hooks) 5,324 linhas
App routes                      6,389 linhas
API routes                      1,493 linhas
---
TOTAL codebase:                ~23K linhas
```

### Violações Detectadas

#### 🔴 Cores Hardcoded (27 ocorrências)
Arquivos com hex hardcoded (deve usar `var(--color-*)`):
- `src/components/design-system/btn.tsx` — 2 valores
- `src/components/design-system/balance-card.tsx` — 3 valores
- `src/components/transactions/transaction-form.tsx` — múltiplas
- `src/components/transactions/transaction-list.tsx` — múltiplas
- `src/components/transactions/csv-import.tsx` — múltiplas
- `src/components/transactions/card-selector.tsx` — múltiplas
- `src/components/invoices/nubank-invoice-import.tsx` — múltiplas
- `src/components/accounts/account-form-dialog.tsx` — múltiplas
- `src/components/dashboard/cards-overview.tsx` — múltiplas

**Impacto:** Dark mode quebrado nestes componentes.

#### 🟡 UI Badge Obsoleto (1 arquivo)
- `src/components/transactions/category-badge.tsx` → usar `Badge` de `/design-system/`

#### 🟡 HTML `<button>` Raw (5+ arquivos)
Páginas usando `<button>` ao invés de `<Btn>`:
- `src/app/(app)/settings/settings-client.tsx`
- `src/app/(app)/invoices/invoices-client.tsx`

**Impacto:** Inconstência visual, acessibilidade.

#### 🔴 Shadow Tokens (3 usos de `shadow-lg` ao invés de `var(--shadow-*)`):
- `src/components/design-system/balance-card.tsx` — `shadow-lg` hardcoded
- `src/components/design-system/btn.tsx` — 2 usos de `shadow-card-hover`

---

## 🛠️ Roadmap de Refatoração (3 Fases)

### **Fase 1: Cleanup & Enforcement** (1–2 dias)
Máxima prioridade — sem features novas, fix técnico puro.

**1.1 Design System Melting Pot**
- [ ] `btn.tsx` → remover hardcoded `#FEF2F2`, `#EF4444` (use vars)
- [ ] `balance-card.tsx` → remover `shadow-lg`, substituir por `var(--shadow-card)`
- [ ] `balance-card.tsx` → remover hardcoded `#8E8E93`, `#636366` (use vars)
- [ ] Garantir todos componentes em `/design-system/` usam APENAS `var(--color-*)` e `var(--shadow-*)`
- [ ] Validação: rodar `grep -r '#[0-9A-Fa-f]\{6\}' src/components/design-system/` → deve retornar 0

**1.2 UI/Legacy Deprecation**
- [ ] Adicionar `@deprecated Use <Badge from @/components/design-system>` em `/ui/badge.tsx`
- [ ] Converter `category-badge.tsx` para importar `Badge` de `/design-system/`
- [ ] Marcar `/components/ui/button.tsx` como `@deprecated Use <Btn from @/design-system>`

**1.3 App Routes — Button Cleanup**
- [ ] `settings-client.tsx` → substituir `<button>` por `<Btn>`
- [ ] `invoices-client.tsx` → substituir `<button>` por `<Btn>`
- [ ] Audit: `grep -r '<button' src/app/` → lista completa

**1.4 Feature Components — Color Cleanup** (parallelizável)
- [ ] `transactions/transaction-form.tsx` → remover hex, usar `var(--color-*)`
- [ ] `transactions/transaction-list.tsx` → idem
- [ ] `transactions/csv-import.tsx` → idem
- [ ] `transactions/card-selector.tsx` → idem
- [ ] `invoices/nubank-invoice-import.tsx` → idem
- [ ] `accounts/account-form-dialog.tsx` → idem
- [ ] `dashboard/cards-overview.tsx` → idem

**Saída esperada:**
- Todos componentes em design-system: 0 hardcoded colors ✅
- Todos imports de `/ui/badge` → 0 (migrado para `/design-system/`) ✅
- Todos `<button>` → `<Btn>` ✅
- Dark mode funciona em 100% dos componentes ✅

---

### **Fase 2: Feature Component Modernization** (3–5 dias)
Refatora componentes de feature para usar design-system + shared primitivos.

**2.1 Transaction Components** (749 + 448 + 275 linhas)
- [ ] `transaction-form.tsx` → usar `InputField`, `Btn`, `Badge` do design-system
- [ ] `transaction-list.tsx` → usar `TxRow`, `MoneyDisplay`, `Badge`
- [ ] `transaction-detail-sheet.tsx` → layout clean com design-system
- [ ] `money-input.tsx` → rever tipografia monospace
- [ ] `csv-import.tsx` → refactor UI com design-system

**2.2 Invoice Components** (461 + 329 + 207 linhas)
- [ ] `nubank-invoice-import.tsx` → usar `Btn`, `InputField`
- [ ] `pay-invoice-dialog.tsx` → dialog cleanups
- [ ] `invoice-settlement-suggest.tsx` → refactor layout

**2.3 Dashboard & Cards** (357 + 317 linhas)
- [ ] `cards-overview.tsx` → usar `BalanceCard`, `TxRow`
- [ ] `card-form-dialog.tsx` → usar `InputField`, `Btn`

**2.4 Accounts & Entre-nos** (295 + 297 linhas)
- [ ] `account-form-dialog.tsx` → usar `InputField`, `Btn`
- [ ] `settle-dialog.tsx` → refactor com design-system

**Saída esperada:**
- Feature components use >90% componentes de `design-system/` ou `shared/`
- Feature components usam CSS variables via Tailwind (não inline hex)
- Feature components rasos (<200 linhas) vs complicados (200–500)

---

### **Fase 3: Design Tokens + Tailwind Sync** (2–3 dias)
Garante que Tailwind config é fonte de verdade para design tokens.

**3.1 CSS Variables → Tailwind**
- [ ] Adicionar novo alias em `tailwind.config.ts`:
  ```typescript
  colors: {
    melza: {
      ink: "var(--color-ink)",
      night: "var(--color-night)",
      // ... todos tokens
    }
  }
  ```
- [ ] Refactor componentes para usar `text-melza-ink` vs `text-[var(--color-ink)]`
- [ ] Benchmark: Tailwind class syntax vs CSS var — qual é mais rápida no escopo Melza

**3.2 Shadow Tokens**
- [ ] Adicionar `boxShadow` em Tailwind config (já está em `tailwind.config.ts`)
- [ ] Converter `shadow-lg` → `shadow-card` / `shadow-card-hover`

**3.3 Dark Mode Validation**
- [ ] Testar light + dark mode em **cada** novo componente
- [ ] Adicionar `.dark` class toggle em Storybook (criar se não houver)

**Saída esperada:**
- Tokens 100% sincronizados entre CSS vars e Tailwind
- Dark mode funciona em todos os componentes
- Componentes novos usam Tailwind shortcuts

---

### **Fase 4: Charts & Extensões** (ongoing)
Baixa prioridade — post-refactor.

- [ ] Preencher `/components/charts/` com data viz (Recharts?)
- [ ] Criar `ChartCard` wrapper com design-system
- [ ] Entre-nos: refactor UI para novo DS

---

## 🚨 Checklist de Refatoração DS (Diário)

**Antes de commit, checklist por arquivo:**

- [ ] **Cores:** Usar `var(--color-*)` tokens, não hex hardcoded
- [ ] **Tipografia:** Monospace (`--font-mono`) para **todo** valor monetário
- [ ] **Background:** Página = `--color-pearl`, cards = `--color-white`
- [ ] **Hero:** Fundo = `--color-ink`, texto = `--color-white`
- [ ] **Botões:** `<Btn>` de design-system, não `<button>` raw
- [ ] **Badges:** Usar `Badge` de design-system com presets (`paid`, `pending`, `overdue`)
- [ ] **Verde/Vermelho:** Somente em texto de valor (com `--font-mono`), nunca background
- [ ] **Border radius:** Usar tokens (8px, 12px, 16px, 20px) — não magic numbers
- [ ] **Sombras:** `var(--shadow-card)` e variantes — não `shadow-lg` raw
- [ ] **Dark mode:** Teste `.dark` class — cores flipam automaticamente?
- [ ] **Componentes novos:** Preferir `/design-system/` sempre vs `/ui/` (legado)
- [ ] **Motion:** Respeitar `prefers-reduced-motion` — testar em Firefox Devtools
- [ ] **Imports:** Nenhum import de `/ui/button`, `/ui/badge` — só design-system

---

## 📝 Documentação Adicional

- **Design tokens completos:** `.cursor/melza-design-system.md`
- **Componentes visuais:** Figma (sincronizado via Code Connect)
- **TypeScript types:** `/src/types/`
- **Format utils:** `/src/lib/utils/format.ts` (moeda, data)
- **Workspace utils:** `/src/lib/utils/workspace.ts` (cores, membros)

---

## 🔗 Referências Rápidas

**Imports Melza (Design System):**
```typescript
// ✅ CORRETO
import { Btn, Badge, BalanceCard, TxRow, InputField, MoneyDisplay } from "@/components/design-system";
import { cn } from "@/lib/utils";
import { formatCurrency } from "@/lib/utils/format";

// ❌ EVITAR (legado)
import { Button } from "@/components/ui/button";        // Use Btn
import { Badge } from "@/components/ui/badge";          // Use Badge
import { Input } from "@/components/ui/input";          // Use InputField
```

**Tokens em código:**
```typescript
// ✅ MELHOR: CSS variables (garantem dark mode automático)
className="text-[var(--color-ink)] bg-[var(--color-pearl)]"

// ✅ OK: Tailwind shortcuts (após Fase 3)
className="text-melza-ink bg-melza-pearl"

// ❌ NUNCA: Hardcoded hex
className="text-[#111111] bg-[#F2F2F7]"
```

**Valores monetários (SEMPRE monospace):**
```typescript
// ✅ CORRETO
<span className="font-mono text-[var(--color-income)]">+R$ 1.234,56</span>

// ✅ Usar MoneyDisplay component (recomendado)
<MoneyDisplay value={12345.67} type="income" />

// ❌ NUNCA
<span>+R$ 1.234,56</span>  // sem font-mono, sem cor de renda
```

**Dark mode:**
```typescript
// ✅ Automático via CSS variables (ZERO trabalho)
className="text-[var(--color-text)] bg-[var(--color-card)]"
// no .dark, as CSS vars flipam sozinhas

// ✅ Tailwind + dark: (após Fase 3)
className="bg-melza-card dark:bg-melza-night"

// ❌ NUNCA hardcode cores dark
className="dark:text-[#1C1C1E]"  // use var()
```

**Componentes principais por caso:**
| Necessidade | Componente | Import |
|---|---|---|
| Botão ação | `<Btn variant="primary" />` | `/design-system` |
| Botão secundário | `<Btn variant="secondary" />` | `/design-system` |
| Badge status | `<Badge preset="paid" />` | `/design-system` |
| Valor monetário | `<MoneyDisplay value={} type="" />` | `/design-system` |
| Transação row | `<TxRow tx={} />` | `/design-system` |
| Hero balance | `<BalanceCard />` | `/design-system` |
| Form field | `<InputField label="" />` | `/design-system` |
| Avatar | `<Avatar name="" image="" />` | `/design-system` |

---

## 🎯 Sucesso da Refatoração — Métricas

Após completar 4 fases, verificar:

```bash
# 1. Zero hardcoded colors em design-system
grep -r '#[0-9A-Fa-f]\{6\}' src/components/design-system/ | wc -l  # deve ser 0

# 2. Nenhum import de /ui/button ou /ui/badge fora de /ui/
grep -r 'from.*ui.*(button|badge)' src/components/{accounts,cards,dashboard,transactions,invoices,entre-nos}/ | wc -l  # deve ser 0

# 3. Feature components usam design-system
grep -r 'from.*design-system' src/components/{accounts,cards,dashboard,transactions,invoices,entre-nos}/ | wc -l  # deve ser 50+

# 4. Dark mode funciona em todas as páginas
# Manual: Toggle dark mode em todas as 10 routes protected — nenhuma cor quebra

# 5. Monospace usado em valores monetários
grep -r 'font-mono.*text-.*\(income\|expense\)' src/components/ | wc -l  # deve ser 15+
```

---

## 📋 Próximas Ações (Imediato)

1. **Criar branch:** `refactor/ds-phase-1-cleanup`
2. **Fase 1 sprint:** 1–2 dias
   - Fix hardcoded colors em design-system
   - Cleanup UI/Legacy
   - Button fixes
3. **Fase 2–4:** Parallelizável com features novas

---

Gerado: 2026-08-29 | Referência completa para refatoração sistemática e segura do DS.

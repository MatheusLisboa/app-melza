# Design System — Source of Truth (Figma Make)

**Única fonte oficial de interface:**  
[Personal Finance App Design](https://www.figma.com/make/Km6j7YJ5Tb61wYgXP8Q5ud/Personal-Finance-App-Design)  
`fileKey`: `Km6j7YJ5Tb61wYgXP8Q5ud`

Extraído via **Figma MCP** (`get_design_context` → recursos Make):

| Recurso MCP | Conteúdo |
|-------------|----------|
| `src/styles/theme.css` | Tokens de cor, radius, tipografia base |
| `src/styles/fonts.css` | Inter + JetBrains Mono |
| `src/app/App.tsx` | Primitivos de produto, shell, variantes, estados |
| `src/imports/pasted_text/product-brief.md` | Princípios e lista de componentes pretendidos |

Referência local do protótipo: `docs/make-source/App.tsx.txt`  
Arquitetura de domínio: `docs/architecture-workspace.md`

---

## Regras de uso (obrigatórias)

1. Make = Source of Truth. Antes de alterar UI, consultar MCP Figma.
2. Nunca redesenhar telas, alterar UX, simplificar layouts ou substituir componentes.
3. **Nenhum componente novo** sem existir previamente no Make (`App.tsx` primitivos / shell / brief).
4. Tema dark-first; workspace é o contexto visual global (`ws.color`).
5. Transação: **consumiu / pagou / cartão** devem permanecer explícitos (`AttributionTrio`).

---

## Princípios (product brief Make)

- Minimalismo premium, muito espaço, poucos cards
- Nada de aparência ERP / dashboard corporativo
- Dark Mode primeiro
- Ícones Lucide
- Valores monetários com hierarquia forte (JetBrains Mono)

---

## Tokens — Cores

Fonte: `theme.css` + accents do `App.tsx` / brief.

| Token | Valor Make | Uso |
|-------|------------|-----|
| `--background` | `#09090B` | Fundo app |
| `--foreground` | `#FAFAFA` | Texto |
| `--card` | `#111113` | Superfície elevada |
| `--popover` / `--secondary` / `--muted` | `#18181B` | Popovers, secondary |
| `--primary` / `--accent` / `--ring` | `#6366F1` | CTA default, ring |
| `--primary-foreground` | `#ffffff` | Texto em primary |
| `--destructive` | `#EF4444` | Perigo / deve |
| `--muted-foreground` | `rgba(255,255,255,0.45)` | Labels secundários |
| `--border` / `--input` | `rgba(255,255,255,0.06)` | Bordas sutis |
| `--input-background` | `#18181B` | Campo input |
| `--switch-background` | `#3F3F46` | Switch track |
| `--chart-1` | `#6366F1` | Chart / primary |
| `--chart-2` | `#22C55E` | Success / receita |
| `--chart-3` | `#F59E0B` | Warning |
| `--chart-4` | `#EC4899` | Casal / accent |
| `--chart-5` | `#06B6D4` | Highlight |
| `--sidebar` | `#0D0D0F` | Sidebar |
| `--sidebar-border` | `rgba(255,255,255,0.06)` | Borda sidebar |
| Success (brief) | `#22C55E` | Receitas, “recebe” |
| Warning (brief) | `#F59E0B` | Pendente / alerta |
| Surface (brief) | `#18181B` | Surfaces / inputs |

**Workspace accent (não é CSS token fixo):** cor do workspace ativo pinta nav ativa, FAB, CTA primary opcional (`wsColor`). Exemplos no Make: `#6366F1`, `#EC4899`, `#14B8A6`, `#F59E0B`.

Implementação app (referência, não redesenhar): `src/app/globals.css` (HSL equivalents).

---

## Tokens — Tipografia

Fonte: `fonts.css` + `@layer base` em `theme.css` + `mono` no `App.tsx`.

| Papel | Família | Spec Make |
|-------|---------|-----------|
| UI / corpo | **Inter** | base `--font-size: 16px`; pesos 400 / 500 (`--font-weight-*`) |
| Dinheiro | **JetBrains Mono** | 400–600; `font-semibold` + tabular |
| h1 | Inter | `2rem` / 600 / lh 1.15 / tracking `-0.035em` |
| h2 | Inter | `1.5rem` / 600 / lh 1.2 / `-0.025em` |
| h3 | Inter | `1.125rem` / 600 / lh 1.3 / `-0.015em` |
| h4 | Inter | `1rem` / 500 / lh 1.4 |
| label | Inter | `0.875rem` / 500 |
| button | Inter | `0.875rem` / 500 |
| input | Inter | `1rem` / 400 |
| TopBar title | Inter | `17px` / 600 / tracking `-0.015em` |
| Nav caption | Inter | `10px` / 500 |
| Input label | Inter | `12px` (`text-xs`) / 500 / `white/50` |

`MoneyDisplay`: `R$` (0.55em, opacity 60%) + inteiro + `,cc` (0.65em, opacity 60%).

---

## Tokens — Espaçamentos

Padrões recorrentes no Make (`App.tsx`), não Variable Collection Figma:

| Padrão | Valor | Uso |
|--------|-------|-----|
| Page X | `px-5` (20px) | Conteúdo mobile |
| Page X auth | `px-6` (24px) | Auth full-bleed |
| TopBar / header | `px-5 py-3` | Shell |
| Stack seções | `gap-3` … `gap-8` | Formulários / onboarding |
| Bottom nav height | `78px` | `BottomNav` |
| FAB offset | `bottom: 90px` + `right-5` | Acima da nav |
| Input height | `50px` | `InputField` |
| Button lg height | `52px` | `Btn` size `lg` |
| StatusBar | `h-11` | Chrome mock |
| Tx row | `py-3` + `gap-3` | `TxRow` |
| Empty state | `py-12 px-6` | `EmptyState` |
| Touch min nav | `min-w-[48px]` | `BottomNav` item |

---

## Tokens — Radius

Fonte: `theme.css` `--radius: 0.875rem` (14px).

| Token / classe | Valor | Uso Make |
|----------------|-------|----------|
| `--radius` / `--radius-lg` | `0.875rem` | Base |
| `--radius-sm` | `calc(var(--radius) - 4px)` | Pequeno |
| `--radius-md` | `calc(var(--radius) - 2px)` | Médio |
| `--radius-xl` | `calc(var(--radius) + 4px)` | Extra |
| `rounded-xl` | ~14px | Btn, InputField, chips |
| `rounded-2xl` | 16px | WorkspaceAvatar, FAB, Empty icon, rows |
| `rounded-3xl` | 24px | Balance / hero / feature card |
| `rounded-full` | 9999 | Avatar membro, badges |

---

## Componentes de produto (Make `App.tsx`)

Somente estes primitivos/shell são o DS de produto do Make.  
**Não inventar** nomes fora desta lista.

### Avatar

| | |
|--|--|
| Props | `member: { id, name, initials, color }`, `size?: number` (default `36`) |
| Visual | círculo, `initials[0]`, bg = `member.color`, fontSize = `size * 0.36` |
| Estados | — |

### WorkspaceAvatar

| | |
|--|--|
| Props | `ws: { emoji, color, ... }`, `size?: number` (default `40`) |
| Visual | `rounded-2xl`, bg `${color}22`, emoji no centro |
| Estados | — |

### Badge

| | |
|--|--|
| Props | `label`, `color`, `bg` |
| Visual | pill `rounded-full`, `10px`, uppercase, semibold |
| Variantes | por cor (ex.: Deve `#EF4444`, Recebe `#22C55E`) — sem enum fixo |

### Btn

| | |
|--|--|
| Props | `variant`, `size`, `wsColor?`, `fullWidth?`, `icon?`, `disabled?`, `onClick?` |
| Variantes | `primary` \| `secondary` \| `ghost` \| `destructive` |
| Sizes | `sm` → `h-8 px-3 text-xs`; `md` → `h-11 px-4 text-sm`; `lg` → `h-[52px] px-5 text-[15px]` |
| Primary bg | `wsColor` ou `#6366F1` |
| Secondary | `bg-white/[0.07]` hover `0.11` |
| Ghost | texto `white/50` hover `white/80` + bg `white/[0.06]` |
| Destructive | bg `#EF444422` texto `#EF4444` |
| Estados | `disabled` → `opacity-40` + `pointer-events-none`; `active:scale-[0.97]` |

### InputField

| | |
|--|--|
| Props | `label?`, `type?`, `placeholder?`, `value?`, `onChange?`, `icon?`, `rightEl?`, `hint?` |
| Visual | altura `50px`, bg `#18181B`, border `white/[0.08]`, `rounded-xl` |
| Focus | border `white/20` |
| Padding | left 44 se ícone; right 44 se `rightEl`; senão 16 |
| Hint | `text-xs text-white/30` |

### MoneyDisplay

| | |
|--|--|
| Props | `amount`, `size?: sm\|md\|xl\|2xl`, `color?`, `wsColor?` |
| Sizes | sm `text-lg`; md `text-2xl`; xl `text-[34px]`; 2xl `text-[42px]` |
| Fonte | JetBrains Mono / mono |

### Skeleton

| | |
|--|--|
| Props | `h?`, `w?`, `rounded?` (defaults `h-4`, `w-full`, `rounded-lg`) |
| Estado | `animate-pulse`, bg `white/[0.06]` |

### EmptyState

| | |
|--|--|
| Props | `icon`, `title`, `desc`, `cta?`, `onCta?`, `wsColor?` |
| Visual | ícone box `w-14 h-14 rounded-2xl`; título `15px`; desc `sm white/35` |
| CTA | `Btn secondary sm` |

### Divider

| | |
|--|--|
| Visual | `h-px bg-white/[0.06]` |

### StatusBar

| | |
|--|--|
| Papel | Chrome mock iOS (hora / notch / sinal / bateria) |
| Altura | `h-11`, `px-6` |

### TopBar

| | |
|--|--|
| Props | `title`, `subtitle?`, `onBack?`, `rightEl?`, `wsColor?` |
| Visual | title `17px`; back button `8×8` `rounded-xl` `bg-white/[0.06]` |

### BottomNav

| | |
|--|--|
| Props | `active: ScreenId`, `onNavigate`, `wsColor` |
| Items (fixos) | Início (`dashboard`), Cartões (`cards`), Histórico (`transactions`), Entre Nós (`entre-nos`), Perfil (`profile`) |
| Altura | `78px`; glass `rgba(9,9,11,0.92)` + blur `20px` |
| Ativo | cor = `wsColor`, stroke `2.5`, dot `1×1` |
| Inativo | `rgba(255,255,255,0.3)`, stroke `1.75` |
| Nota | `dashboard-shared` conta como ativo em Início |

### FAB

| | |
|--|--|
| Props | `onPress`, `wsColor` |
| Visual | `14×14` (`w-14 h-14`) `rounded-2xl`; bg/shadow = `wsColor`; Plus 24 |
| Posição | `bottom-[90px] right-5` |
| Estado | `active:scale-95` |

### AttributionTrio

| | |
|--|--|
| Props | `consumer`, `payer`, `cardOwner` (Member) |
| Regra | se os três iguais → **não renderiza** |
| Campos | `consumiu` sempre (se renderiza); `pagou` se ≠ consumer; `cartão` se ≠ payer |

### TxRow

| | |
|--|--|
| Props | `tx`, `onTap?`, `wsColor` |
| Estados | `pending` badge âmbar; `installments` `n/m`x |
| Amount | income `#22C55E` + `+`; expense `white/75` + `−` |
| Subline | trio **ou** `category · date` se trio oculto |

---

## Componentes listados no product brief (catálogo Make)

O brief pede estes nomes. Só entram no DS de produto quando existirem no Make (`App.tsx` ou UI shadcn do Make). Nesta etapa: **mapeamento documental**, sem inventar implementações.

| Brief | Status no Make fonte |
|-------|----------------------|
| Button | = `Btn` (+ shadcn `button.tsx` no pacote Make) |
| Card | shadcn `card.tsx` + superfícies `#111113` no App |
| Input | = `InputField` (+ shadcn `input.tsx`) |
| MoneyInput | não como primitivo isolado no App; valor grande em `transaction-new` |
| DatePicker | shadcn `calendar.tsx` |
| BottomSheet / Modal | shadcn `drawer` / `sheet` / `dialog` |
| Tabs | shadcn `tabs.tsx` |
| Navigation / Sidebar / Bottom Navigation | `BottomNav` (+ shadcn `sidebar`) |
| Charts | shadcn `chart.tsx` |
| Avatar | `Avatar` |
| Workspace Selector | tela `WorkspaceSwitcher` (não primitivo isolado) |
| Category Badge | inline no App / listagens |
| Loan / Subscription / Settlement / Transaction / Dashboard / Stat Card | composições de tela, não primitivos nomeados no App |
| Empty State | `EmptyState` |
| Loading / Skeleton | `Skeleton` |
| Toasts | shadcn `sonner.tsx` |
| Dialogs / Badges | shadcn + `Badge` produto |
| Search | padrão InputField + ícone Search |
| FAB | `FAB` |

**shadcn no Make** (biblioteca de suporte, não inventar além do pacote Make): accordion, alert, alert-dialog, aspect-ratio, avatar, badge, breadcrumb, button, calendar, card, carousel, chart, checkbox, collapsible, command, context-menu, dialog, drawer, dropdown-menu, form, hover-card, input, input-otp, label, menubar, navigation-menu, pagination, popover, progress, radio-group, resizable, scroll-area, select, separator, sheet, sidebar, skeleton, slider, sonner, switch, table, tabs, textarea, toggle, toggle-group, tooltip, ImageWithFallback.

---

## Estados (Make)

| Estado | Tratamento no Make |
|--------|--------------------|
| Loading | `Skeleton` / pulse `white/[0.06]` |
| Empty | `EmptyState` (ícone + título + desc + CTA opcional) |
| Pending (TX) | badge âmbar “Pendente” |
| Disabled (Btn) | opacity 40% |
| Active press | `active:scale-[0.97]` (Btn) / `0.95` (FAB) |
| Focus input | border `white/20` |
| Nav active | `wsColor` + dot |
| Settled / success | telas específicas (ex. Entre Nós) com CheckCircle `#22C55E` |

Estados de produto do brief (offline, erro, primeiro acesso…) devem seguir o mesmo vocabulário visual acima quando implementados — sem novos padrões.

---

## Microinterações (Make)

| Interação | Spec |
|-----------|------|
| Btn / pressable | `active:scale-[0.97]`, transition |
| FAB | `active:scale-95`, shadow `0 8px 32px ${wsColor}55` |
| BottomNav glass | `backdrop-filter: blur(20px)` |
| Hover rows | `hover:bg-white/[0.03]` / superfícies `hover:bg-[#141417]` |
| Onboarding dots | width 20 vs 6, cor primary vs `white/12` |

---

## Mapa de implementação no repositório

| Make | Arquivo app |
|------|-------------|
| Avatar | `design-system/avatar.tsx` (+ `shared/member-avatar` wrapper) |
| WorkspaceAvatar | `design-system/workspace-avatar.tsx` |
| Badge | `design-system/badge.tsx` |
| Btn | `design-system/btn.tsx` |
| InputField | `design-system/input-field.tsx` |
| MoneyDisplay | `design-system/money-display.tsx` |
| Skeleton | `design-system/skeleton.tsx` (`DsSkeleton`) |
| EmptyState | `design-system/empty-state.tsx` |
| Divider | `design-system/divider.tsx` |
| StatusBar | `design-system/status-bar.tsx` |
| TopBar | `design-system/top-bar.tsx` |
| BottomNav | `design-system/bottom-nav.tsx` (mobile = 5 itens + `wsColor`) |
| FAB | `design-system/fab.tsx` |
| AttributionTrio | `design-system/attribution-trio.tsx` |
| TxRow | `design-system/tx-row.tsx` |
| Balance (composição) | `design-system/balance-card.tsx` |

Accent de workspace: `workspaceAccent()` em `lib/utils/workspace.ts` (PERSONAL/COUPLE/FAMILY/SHARED).

---

## Changelog documental

| Data | Origem | Mudança |
|------|--------|---------|
| 2026-07-14 | MCP Make | Extração SoT documentada |
| 2026-07-14 | MCP Make | Primitivos Make implementados em `design-system/`; BottomNav Make no shell mobile |

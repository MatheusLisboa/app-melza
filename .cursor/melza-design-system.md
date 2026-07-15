# Melza — Design System v2
> Referência oficial de tokens visuais. Altere aqui primeiro, depois aplique no código.
> Última atualização: julho 2026

---

## Filosofia

Preto, branco e prata. Hierarquia por **peso tipográfico**, não por cor.
A única cor de destaque de marca é o preto (`#111111`).
Verde e vermelho existem **apenas** para indicar receita/despesa — nunca como cor de fundo, botão primário ou elemento decorativo.
Inspiração: XP Investimentos — sofisticação financeira, sem frescura.

---

## Paleta

### Neutros (únicos tons de marca)

| Token CSS            | Hex       | Nome       | Uso                                      |
|----------------------|-----------|------------|------------------------------------------|
| `--color-ink`        | `#111111` | Ink        | Card hero, botão primário, texto forte   |
| `--color-night`      | `#1C1C1E` | Night      | Ícones de categoria, elementos dark      |
| `--color-onyx`       | `#2C2C2E` | Onyx       | Bordas de elementos dark                 |
| `--color-graphite`   | `#3A3A3C` | Graphite   | Texto terciário em fundos escuros        |
| `--color-silver`     | `#8E8E93` | Silver     | Texto secundário, labels, metadados      |
| `--color-mist`       | `#C7C7CC` | Mist       | Bordas sutis, separadores               |
| `--color-fog`        | `#E5E5EA` | Fog        | Bordas de cards, hover state             |
| `--color-pearl`      | `#F2F2F7` | Pearl      | Fundo da página                          |
| `--color-white`      | `#FFFFFF` | White      | Fundo de cards e itens                   |

### Semânticas (apenas para valores financeiros)

| Token CSS              | Hex       | Uso                              |
|------------------------|-----------|----------------------------------|
| `--color-income`       | `#22C55E` | Valores positivos / receitas     |
| `--color-expense`      | `#EF4444` | Valores negativos / despesas     |
| `--color-warning`      | `#F59E0B` | Empréstimos, alertas de prazo    |

> ⚠️ Estas três cores NÃO devem aparecer como cor de fundo de card, botão, ou badge de categoria. Apenas em texto de valor monetário e no badge de status "Atrasado".

---

## Tipografia

### Fontes

```css
--font-ui:    'Inter', -apple-system, sans-serif;
--font-mono:  'JetBrains Mono', 'Courier New', monospace;
```

`--font-mono` é obrigatória para **todo valor monetário** — sem exceção.

### Escala

| Papel              | Fonte       | Tamanho | Peso | Cor                  |
|--------------------|-------------|---------|------|----------------------|
| Saldo hero         | `--font-mono` | 36–40px | 800  | `--color-white` (no card dark) |
| Título de seção    | `--font-ui`   | 18px    | 700  | `--color-ink`        |
| Nome de item       | `--font-ui`   | 14–15px | 600  | `--color-ink`        |
| Valor de transação | `--font-mono` | 14px    | 700  | `--color-income` ou `--color-expense` |
| Metadados (categoria, data) | `--font-ui` | 12–13px | 400 | `--color-silver` |
| Label de campo     | `--font-ui`   | 12px    | 500  | `--color-silver`     |
| Placeholder        | `--font-ui`   | 14px    | 400  | `--color-mist`       |

---

## Superfícies e elevação

```
Fundo da página   →  --color-pearl   (#F2F2F7)
Card de item      →  --color-white   (#FFFFFF)   + borda --color-fog
Card hero dark    →  --color-ink     (#111111)
Sidebar / nav     →  --color-white   (#FFFFFF)   + borda direita --color-fog
Modal / sheet     →  --color-white   (#FFFFFF)   + border-radius-top 20px
```

**Nunca use sombra como elevação primária.** Diferença de fundo é suficiente.
Sombra só em modais: `box-shadow: 0 -4px 24px rgba(0,0,0,0.08)`.

---

## Border radius

| Contexto                        | Valor  |
|---------------------------------|--------|
| Botões, inputs, badges pequenos | `8px`  |
| Cards de item (transações)      | `12px` |
| Card hero, cards grandes        | `16px` |
| Modal / bottom sheet (top)      | `20px` |
| Pills, badges de status         | `20px` |
| Avatar / ícone circular         | `50%`  |

---

## Componentes

### Card hero (saldo)

```
fundo:        --color-ink (#111111)
border-radius: 16px
padding:      20px
```

Estrutura interna:
- Label "DISPONÍVEL · MÊS" → 11px, `--color-silver`, letter-spacing 0.06em, uppercase
- Valor principal → `--font-mono` 36px weight 800, `--color-white`
- Barra de progresso → 3px altura, fundo `--color-onyx`, preenchimento verde `--color-income`
- Row entradas/saídas → 12px `--color-silver` label, 13px `--font-mono` valor colorido

### Cards de item (transações, contas)

```
fundo:        --color-white
border:       1px solid --color-fog
border-radius: 12px
padding:      12px 16px
```

Layout interno:
- Ícone/avatar → círculo 36px, fundo `--color-night`, inicial em branco, weight 700
- Nome → 14px weight 600 `--color-ink`
- Categoria + data → 12px `--color-silver`
- Valor → `--font-mono` 14px weight 700, `--color-expense` ou `--color-income`

### Badges de status

| Status    | Fundo     | Texto     |
|-----------|-----------|-----------|
| Pago      | `#F0FDF4` | `#166534` |
| Pendente  | `#FEF9EE` | `#92400E` |
| Atrasado  | `#FEF2F2` | `#991B1B` |
| Fixo      | `--color-pearl` | `--color-graphite` |
| Parcela N/T | `--color-ink` | `--color-white` |

Todos os badges: `border-radius: 20px`, `padding: 3px 10px`, `font-size: 11px`, `font-weight: 600`.

### Botões

**Primário:**
```css
background: var(--color-ink);
color: #fff;
border-radius: 8px;
padding: 10px 20px;
font-size: 14px;
font-weight: 600;
```

**Secundário (outline):**
```css
background: transparent;
color: var(--color-ink);
border: 1px solid var(--color-fog);
border-radius: 8px;
```

**Ghost (link-like):**
```css
background: transparent;
color: var(--color-silver);
border: none;
font-size: 13px;
```

> Sem roxo, sem indigo, sem gradiente em nenhum botão.

### Inputs

```css
background: var(--color-white);
border: 1px solid var(--color-fog);
border-radius: 8px;
padding: 10px 14px;
font-size: 14px;
color: var(--color-ink);
```

Focus:
```css
border-color: var(--color-night);
outline: none;
box-shadow: 0 0 0 3px rgba(28, 28, 30, 0.08);
```

Input de valor monetário usa `font-family: var(--font-mono)` e `font-weight: 700`.

### Ícones de categoria (avatar circular)

```css
width: 36px;
height: 36px;
border-radius: 50%;
background: var(--color-night);
color: #fff;
font-size: 14px;
font-weight: 700;
display: flex; align-items: center; justify-content: center;
```

Usar sempre a inicial da categoria/merchant em maiúsculo.

### Bottom navigation (mobile)

```
estilo:       flutuante (inset, pill)
fundo:        --color-card / 92% + backdrop-blur
borda:        --color-line (dark: #3A3A3C)
raio:         22px
sombra:       0 8px 32px rgba(0,0,0,0.12)
```

Item ativo:
```css
background: var(--color-ink);        /* dark: #F2F2F7 */
color: #fff;                         /* dark: #111 */
border-radius: 20px;
padding: 6px 12px;
```

Item inativo: ícone + label em `--color-text-2` / `--color-text-3`.

---

## O que remover do DS atual

- [ ] Remover `#6366f1` (indigo) de todos os contextos — botões, links, badges, highlights
- [ ] Remover `background` roxo/indigo de qualquer elemento
- [ ] Remover gradientes (se houver)
- [ ] Substituir qualquer `color: purple` ou variante por `--color-ink` ou `--color-silver`
- [ ] Verificar se shadcn/ui está sobrescrevendo com `--primary` em roxo — substituir por `--color-ink`

---

## Variáveis CSS a declarar no `globals.css`

```css
:root {
  /* neutros */
  --color-ink:      #111111;
  --color-night:    #1C1C1E;
  --color-onyx:     #2C2C2E;
  --color-graphite: #3A3A3C;
  --color-silver:   #8E8E93;
  --color-mist:     #C7C7CC;
  --color-fog:      #E5E5EA;
  --color-pearl:    #F2F2F7;
  --color-white:    #FFFFFF;

  /* semânticas */
  --color-income:   #22C55E;
  --color-expense:  #EF4444;
  --color-warning:  #F59E0B;

  /* tipografia */
  --font-ui:   'Inter', -apple-system, sans-serif;
  --font-mono: 'JetBrains Mono', 'Courier New', monospace;

  /* shadcn override — força o "primary" pra preto */
  --primary:         var(--color-ink);
  --primary-foreground: #ffffff;
  --ring:            var(--color-ink);
}
```

---

## Checklist de revisão antes de fazer PR

- [ ] Nenhum `#6366f1` ou `indigo` no código
- [ ] Todos os valores monetários usam `font-family: var(--font-mono)`
- [ ] Fundo da página é `--color-pearl` (`#F2F2F7`)
- [ ] Card hero usa `--color-ink` como fundo
- [ ] Botão primário é preto, não roxo
- [ ] Badges de status usam apenas as 5 variantes da tabela acima
- [ ] Verde e vermelho aparecem apenas em texto de valor, não em fundo

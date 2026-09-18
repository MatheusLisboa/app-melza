export type CategorizationRuleLike = {
  pattern: string;
  category_id: string;
};

/** Primeira regra cujo padrão aparece na descrição (case-insensitive). */
export function matchCategorizationRule(
  description: string,
  rules: CategorizationRuleLike[]
): string | null {
  const hay = description.trim().toLowerCase();
  if (!hay) return null;
  for (const rule of rules) {
    const needle = rule.pattern.trim().toLowerCase();
    if (needle.length < 2) continue;
    if (hay.includes(needle)) return rule.category_id;
  }
  return null;
}

export const SUGGESTED_RULES: { pattern: string; categoryName: string }[] = [
  { pattern: "ifood", categoryName: "Alimentação" },
  { pattern: "rappi", categoryName: "Alimentação" },
  { pattern: "uber eats", categoryName: "Alimentação" },
  { pattern: "uber", categoryName: "Transporte" },
  { pattern: "99 ", categoryName: "Transporte" },
  { pattern: "posto", categoryName: "Transporte" },
  { pattern: "shell", categoryName: "Transporte" },
  { pattern: "netflix", categoryName: "Assinaturas" },
  { pattern: "spotify", categoryName: "Assinaturas" },
  { pattern: "disney", categoryName: "Assinaturas" },
  { pattern: "aluguel", categoryName: "Moradia" },
  { pattern: "condomínio", categoryName: "Moradia" },
  { pattern: "condominio", categoryName: "Moradia" },
  { pattern: "enel", categoryName: "Contas & Utilities" },
  { pattern: "claro", categoryName: "Contas & Utilities" },
  { pattern: "vivo", categoryName: "Contas & Utilities" },
  { pattern: "farmácia", categoryName: "Saúde" },
  { pattern: "farmacia", categoryName: "Saúde" },
  { pattern: "salário", categoryName: "Salário" },
  { pattern: "salario", categoryName: "Salário" },
];

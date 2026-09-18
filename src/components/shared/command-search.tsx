"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import { Search } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { formatCurrency } from "@/lib/utils/format";
import { CategoryGlyph } from "@/lib/ui/category-icon";

export function CommandSearch({ workspaceId }: { workspaceId: string }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState("");

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setOpen((v) => !v);
      }
      if (e.key === "Escape") setOpen(false);
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  const { data: txs = [] } = useQuery({
    queryKey: ["command-search", workspaceId],
    enabled: open,
    staleTime: 30_000,
    queryFn: async () => {
      const supabase = createClient();
      const { data, error } = await supabase
        .from("transactions")
        .select(
          "id, description, amount, transaction_date, category:categories(name, icon)"
        )
        .eq("workspace_id", workspaceId)
        .neq("status", "cancelled")
        .order("transaction_date", { ascending: false })
        .limit(80);
      if (error) throw error;
      return (data ?? []) as {
        id: string;
        description: string;
        amount: number;
        transaction_date: string;
        category?: { name: string; icon: string | null } | null;
      }[];
    },
  });

  const results = useMemo(() => {
    const needle = q.trim().toLowerCase();
    if (!needle) return txs.slice(0, 8);
    return txs
      .filter(
        (t) =>
          t.description.toLowerCase().includes(needle) ||
          t.category?.name?.toLowerCase().includes(needle) ||
          String(t.amount).includes(needle)
      )
      .slice(0, 12);
  }, [txs, q]);

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-[80] flex items-start justify-center bg-black/40 px-4 pt-[12vh]"
      onClick={() => setOpen(false)}
    >
      <div
        className="w-full max-w-lg overflow-hidden rounded-2xl border border-[var(--color-line)] bg-[var(--color-card)]"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center gap-2 border-b border-[var(--color-line)] px-3">
          <Search size={16} className="text-[var(--color-text-2)]" />
          <input
            autoFocus
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Buscar lançamentos…"
            className="h-12 w-full bg-transparent text-[15px] outline-none"
          />
        </div>
        <ul className="max-h-80 overflow-y-auto py-1">
          {results.map((t) => (
            <li key={t.id}>
              <button
                type="button"
                className="flex w-full items-center gap-3 px-3 py-2.5 text-left hover:bg-[var(--color-chip)]"
                onClick={() => {
                  setOpen(false);
                  router.push(`/transactions/${t.id}`);
                }}
              >
                <CategoryGlyph
                  name={t.category?.name}
                  emoji={t.category?.icon}
                  className="h-8 w-8"
                  size={14}
                />
                <span className="min-w-0 flex-1 truncate text-[14px]">
                  {t.description}
                </span>
                <span className="font-mono text-[12px] text-[var(--color-text-2)]">
                  {formatCurrency(Number(t.amount))}
                </span>
              </button>
            </li>
          ))}
          {results.length === 0 ? (
            <li className="px-3 py-6 text-center text-[13px] text-[var(--color-text-2)]">
              Nada encontrado
            </li>
          ) : null}
        </ul>
      </div>
    </div>
  );
}

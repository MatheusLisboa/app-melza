import Link from "next/link";
import { BrandWordmark } from "@/components/design-system";

export default function HomePage() {
  return (
    <div className="min-h-dvh bg-[var(--color-pearl)] text-[var(--color-ink)]">
      <header className="mx-auto flex max-w-3xl items-center justify-between px-5 py-5">
        <BrandWordmark size="sm" className="mx-0" />
        <div className="flex items-center gap-3 text-sm">
          <Link
            href="/login"
            className="text-[var(--color-silver)] hover:text-[var(--color-ink)]"
          >
            Entrar
          </Link>
          <Link
            href="/signup"
            className="rounded-lg bg-[var(--color-ink)] px-3.5 py-2 font-medium text-white"
          >
            Começar grátis
          </Link>
        </div>
      </header>

      <main className="mx-auto max-w-3xl px-5 pb-20">
        <section className="pb-14 pt-6">
          <h1 className="text-[2.15rem] font-extrabold leading-[1.15] tracking-[-0.035em] sm:text-5xl">
            Finanças da casa,
            <br />
            sem enrolação.
          </h1>
          <p className="mt-4 max-w-lg text-[16px] leading-relaxed text-[var(--color-silver)]">
            Pessoal ou a dois. Cartões, faturas e quem deve a quem — com um
            assistente que usa os seus dados, não inventa.
          </p>
          <div className="mt-7 flex flex-wrap gap-3">
            <Link
              href="/signup"
              className="rounded-lg bg-[var(--color-ink)] px-5 py-3 text-[15px] font-semibold text-white"
            >
              Começar grátis
            </Link>
            <Link
              href="/login"
              className="rounded-lg border border-[var(--color-fog)] bg-white px-5 py-3 text-[15px] font-semibold"
            >
              Já tenho conta
            </Link>
          </div>
        </section>

        <section className="overflow-hidden rounded-2xl bg-[var(--color-ink)] px-6 py-8 text-white">
          <p className="text-[11px] font-medium uppercase tracking-[0.08em] text-[var(--color-silver)]">
            Disponível
          </p>
          <p className="mt-2 font-mono text-[36px] font-extrabold leading-none">
            R$ 4.280,00
          </p>
          <div className="mt-6 grid grid-cols-2 gap-4 text-[13px]">
            <div>
              <p className="text-[10px] uppercase text-[var(--color-silver)]">
                Entradas
              </p>
              <p className="mt-0.5 font-mono font-bold text-[#22C55E]">
                + R$ 8.200,00
              </p>
            </div>
            <div className="text-right">
              <p className="text-[10px] uppercase text-[var(--color-silver)]">
                Saídas
              </p>
              <p className="mt-0.5 font-mono font-bold text-[#EF4444]">
                − R$ 3.920,00
              </p>
            </div>
          </div>
        </section>

        <section className="mt-14 grid gap-8 sm:grid-cols-2">
          <Feature
            title="Sozinho ou juntos"
            body="Workspace pessoal no signup. Casal, família ou compartilhado com convite por link. Entre Nós mostra quem deve a quem."
          />
          <Feature
            title="Fatura que fecha"
            body="Ciclo pelo dia de fechamento do cartão, pagamento parcial e PDF. Importa CSV/OFX da fatura que você já baixa no banco."
          />
          <Feature
            title="Pergunte ao Melza"
            body="“Lança R$ 45 no iFood”, “quanto falta na fatura?”, “quem deve a quem?”. Confirma antes de gravar."
          />
          <Feature
            title="No bolso"
            body="PWA, tema claro e escuro, lançamento rápido. Orçamento, metas e regras de categoria — tudo no próprio app."
          />
        </section>

        <section className="mt-14 rounded-2xl border border-[var(--color-fog)] bg-white px-6 py-8">
          <h2 className="text-xl font-bold">O que entra</h2>
          <ul className="mt-4 grid gap-2 text-sm text-[var(--color-graphite)] sm:grid-cols-2">
            {[
              "Contas e cartões",
              "Lançamentos e parcelas",
              "Faturas e PDF",
              "Entre Nós",
              "Assinaturas e salário recorrente",
              "Orçamento e metas",
              "Regras de categoria",
              "Chat com seus dados",
              "Relatórios e CSV",
              "Exportar / apagar conta (LGPD)",
            ].map((item) => (
              <li key={item} className="flex gap-2">
                <span aria-hidden>·</span>
                {item}
              </li>
            ))}
          </ul>
        </section>

        <p className="mt-10 text-center text-[13px] text-[var(--color-silver)]">
          <Link href="/terms" className="hover:underline">
            Termos
          </Link>
          {" · "}
          <Link href="/privacy" className="hover:underline">
            Privacidade
          </Link>
        </p>
      </main>
    </div>
  );
}

function Feature({ title, body }: { title: string; body: string }) {
  return (
    <div>
      <h2 className="text-[17px] font-bold">{title}</h2>
      <p className="mt-2 text-[14px] leading-relaxed text-[var(--color-silver)]">
        {body}
      </p>
    </div>
  );
}

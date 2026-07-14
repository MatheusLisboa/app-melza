import Link from "next/link";

export default function PrivacyPage() {
  return (
    <main className="mx-auto max-w-2xl space-y-6 px-6 py-12">
      <h1 className="text-2xl font-semibold tracking-tight">
        Política de privacidade
      </h1>
      <p className="text-sm text-muted-foreground">
        Última atualização: julho de 2026 · LGPD
      </p>
      <div className="space-y-4 text-sm leading-relaxed text-muted-foreground">
        <p>
          Tratamos dados pessoais necessários à autenticação (e-mail, nome) e
          dados financeiros que você cadastra (lançamentos, cartões, contas).
        </p>
        <p>
          Os dados ficam armazenados no Supabase (banco e autenticação). Chaves
          de IA, quando usadas, enviam trechos de descrição de lançamentos ao
          provedor OpenAI apenas para categorização/chat.
        </p>
        <p>
          Você pode exportar seus dados em Configurações → Privacidade e
          solicitar exclusão da conta. Workspaces com outros membros só são
          apagados se você for o único membro restante.
        </p>
        <p>
          Contato do controlador: use o e-mail da conta do projeto Supabase /
          responsável pela operação.
        </p>
      </div>
      <Link href="/login" className="text-sm text-primary hover:underline">
        Voltar
      </Link>
    </main>
  );
}

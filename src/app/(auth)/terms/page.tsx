import Link from "next/link";

export default function TermsPage() {
  return (
    <main className="mx-auto max-w-2xl space-y-6 px-6 py-12">
      <h1 className="text-2xl font-semibold tracking-tight">Termos de uso</h1>
      <p className="text-sm text-muted-foreground">
        Última atualização: julho de 2026
      </p>
      <div className="space-y-4 text-sm leading-relaxed text-muted-foreground">
        <p>
          O FinançasCasa é um aplicativo de gestão financeira pessoal e
          compartilhada. Ao criar uma conta, você concorda em usar o serviço de
          forma lícita e responsável.
        </p>
        <p>
          Você é responsável pelas credenciais da conta e pelos dados que
          inserir. Workspaces compartilhados tornam informações visíveis a todos
          os membros convidados.
        </p>
        <p>
          O serviço é oferecido “como está”, sem garantia de disponibilidade
          contínua. Recursos de IA dependem de provedores externos e podem
          estar indisponíveis.
        </p>
        <p>
          Podemos suspender contas em caso de abuso (scraping, spam de APIs,
          engenharia reversa ofensiva).
        </p>
      </div>
      <Link href="/login" className="text-sm text-primary hover:underline">
        Voltar
      </Link>
    </main>
  );
}

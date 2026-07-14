"use client";

import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useRouter } from "next/navigation";
import { ChevronLeft } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { setActiveWorkspaceAction } from "@/lib/actions/workspace";
import {
  createWorkspaceSchema,
  type CreateWorkspaceInput,
} from "@/lib/validations/auth";
import { Button } from "@/components/ui/button";
import { BrandMark, InputField } from "@/components/design-system";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";

const AVATAR_COLORS = [
  "#6366f1",
  "#ec4899",
  "#22c55e",
  "#f59e0b",
  "#06b6d4",
  "#ef4444",
];

const INTRO_STEPS = [
  {
    title: "Seu dinheiro.\nCada contexto.",
    desc: "O Melza organiza suas finanças em Workspaces. Pessoal, Casal, Família ou Compartilhado.",
  },
  {
    title: "Transações com\ncontexto real.",
    desc: "Cada transação sabe quem consumiu, quem pagou e de qual cartão. Nada se perde.",
  },
  {
    title: "Pronto para\ncomeçar.",
    desc: "Use o pessoal ou crie um workspace compartilhado. Adicione contas, cartões e comece.",
  },
];

export function OnboardingForm({
  defaultDisplayName,
  allowSkip = false,
}: {
  defaultDisplayName?: string;
  allowSkip?: boolean;
}) {
  const router = useRouter();
  const [phase, setPhase] = useState<"intro" | "setup">("intro");
  const [step, setStep] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [inviteToken, setInviteToken] = useState("");
  const [mode, setMode] = useState<"create" | "invite" | "personal">("create");

  const form = useForm<CreateWorkspaceInput>({
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    resolver: zodResolver(createWorkspaceSchema) as any,
    defaultValues: {
      workspaceName: "",
      displayName: defaultDisplayName ?? "",
      avatarColor: AVATAR_COLORS[0],
      workspaceType: "COUPLE",
    },
  });

  const avatarColor = form.watch("avatarColor") ?? AVATAR_COLORS[0];
  const workspaceType = form.watch("workspaceType") ?? "COUPLE";

  async function createWorkspace(values: CreateWorkspaceInput) {
    setLoading(true);
    setError(null);
    const supabase = createClient();
    const { data: workspaceId, error: rpcError } = await supabase.rpc(
      "create_workspace_with_defaults",
      {
        p_name: values.workspaceName,
        p_display_name: values.displayName,
        p_avatar_color: values.avatarColor ?? AVATAR_COLORS[0],
        p_type: values.workspaceType ?? "COUPLE",
      }
    );

    if (rpcError) {
      setLoading(false);
      setError(rpcError.message);
      return;
    }

    if (workspaceId) {
      await setActiveWorkspaceAction(workspaceId as string);
    }
    setLoading(false);
    router.push("/dashboard");
    router.refresh();
  }

  async function joinWithInvite() {
    const token = inviteToken.trim();
    if (!token) {
      setError("Cole o token ou abra o link de convite");
      return;
    }
    setLoading(true);
    setError(null);
    const supabase = createClient();
    const displayName =
      form.getValues("displayName") || defaultDisplayName || "Membro";
    const { data: workspaceId, error: rpcError } = await supabase.rpc(
      "accept_workspace_invite",
      {
        p_token: token.includes("/") ? token.split("/").pop() : token,
        p_display_name: displayName,
        p_avatar_color: avatarColor,
      }
    );

    if (rpcError) {
      setLoading(false);
      setError(rpcError.message);
      return;
    }

    if (workspaceId) {
      await setActiveWorkspaceAction(workspaceId as string);
    }
    setLoading(false);
    router.push("/dashboard");
    router.refresh();
  }

  async function continuePersonal() {
    setLoading(true);
    setError(null);
    const supabase = createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) {
      setLoading(false);
      setError("Não autenticado");
      return;
    }
    const displayName =
      form.getValues("displayName") || defaultDisplayName || "Eu";
    const { data: workspaceId, error: rpcError } = await supabase.rpc(
      "create_personal_workspace_for_user",
      {
        p_user_id: user.id,
        p_display_name: displayName,
        p_avatar_color: avatarColor,
      }
    );
    if (rpcError) {
      setLoading(false);
      setError(rpcError.message);
      return;
    }
    if (workspaceId) {
      await setActiveWorkspaceAction(workspaceId as string);
    }
    setLoading(false);
    router.push("/dashboard");
    router.refresh();
  }

  if (phase === "intro") {
    const current = INTRO_STEPS[step];
    return (
      <div className="flex min-h-screen flex-col bg-background px-6 pb-8">
        <div className="flex items-center justify-between py-3">
          {step > 0 ? (
            <button
              type="button"
              onClick={() => setStep((s) => s - 1)}
              className="flex h-8 w-8 items-center justify-center rounded-xl bg-white/[0.06]"
              aria-label="Voltar"
            >
              <ChevronLeft
                size={18}
                strokeWidth={2}
                className="text-foreground/70"
              />
            </button>
          ) : (
            <div className="w-8" />
          )}
          <div className="flex gap-1.5">
            {INTRO_STEPS.map((_, i) => (
              <div
                key={i}
                className="h-1 rounded-full transition-all duration-300"
                style={{
                  width: i === step ? 20 : 6,
                  backgroundColor:
                    i === step ? "#6366F1" : "rgba(255,255,255,0.12)",
                }}
              />
            ))}
          </div>
          {step < INTRO_STEPS.length - 1 ? (
            <button
              type="button"
              onClick={() => setPhase("setup")}
              className="text-xs text-foreground/30 transition-colors hover:text-foreground/55"
            >
              Pular
            </button>
          ) : (
            <div className="w-10" />
          )}
        </div>

        <div className="flex flex-1 flex-col gap-8 pt-4">
          <div className="flex flex-1 items-center justify-center">
            {step === 0 && <IntroWorkspacesVisual />}
            {step === 1 && <IntroAttributionVisual />}
            {step === 2 && <IntroReadyVisual />}
          </div>
          <div>
            <h2
              className="whitespace-pre-line text-[28px] font-semibold leading-tight text-foreground"
              style={{ letterSpacing: "-0.025em" }}
            >
              {current.title}
            </h2>
            <p className="mt-3 text-sm leading-relaxed text-foreground/40">
              {current.desc}
            </p>
          </div>
          <Button
            size="lg"
            className="h-[52px] w-full text-[15px]"
            onClick={() =>
              step < INTRO_STEPS.length - 1
                ? setStep((s) => s + 1)
                : setPhase("setup")
            }
          >
            {step < INTRO_STEPS.length - 1 ? "Continuar" : "Começar agora"}
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto flex min-h-screen w-full max-w-lg flex-col bg-background px-6 pb-10 pt-6">
      <div className="mb-8 flex flex-col items-center gap-3 text-center">
        <BrandMark size="sm" />
        <div>
          <h1 className="text-xl font-semibold tracking-tight">Configurar</h1>
          <p className="mt-1 text-sm text-foreground/40">
            Crie um workspace, entre com convite ou continue no pessoal.
          </p>
        </div>
      </div>

      <div className="mb-6 grid grid-cols-3 gap-2">
        {(
          [
            ["create", "Criar"],
            ["invite", "Convite"],
            ["personal", "Pessoal"],
          ] as const
        ).map(([id, label]) => (
          <button
            key={id}
            type="button"
            onClick={() => {
              setMode(id);
              setError(null);
            }}
            className={cn(
              "rounded-xl py-2.5 text-xs font-medium transition-colors",
              mode === id
                ? "bg-primary text-primary-foreground"
                : "bg-white/[0.06] text-foreground/50 hover:bg-white/[0.1]"
            )}
          >
            {label}
          </button>
        ))}
      </div>

      {mode === "create" && (
        <form
          onSubmit={form.handleSubmit(createWorkspace)}
          className="flex flex-col gap-3"
        >
          <InputField
            label="Nome do workspace"
            placeholder="Matheus & Ana"
            {...form.register("workspaceName")}
            error={form.formState.errors.workspaceName?.message}
          />
          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-medium tracking-wide text-foreground/50">
              Tipo
            </label>
            <Select
              value={workspaceType}
              onValueChange={(v) =>
                form.setValue(
                  "workspaceType",
                  v as CreateWorkspaceInput["workspaceType"]
                )
              }
            >
              <SelectTrigger className="h-[50px] rounded-xl border-white/[0.08] bg-[#18181B]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="COUPLE">Casal</SelectItem>
                <SelectItem value="FAMILY">Família</SelectItem>
                <SelectItem value="SHARED">Compartilhado</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <InputField
            label="Seu nome"
            {...form.register("displayName")}
            error={form.formState.errors.displayName?.message}
          />
          <AvatarColorPicker
            value={avatarColor}
            onChange={(c) => form.setValue("avatarColor", c)}
          />
          {error && <p className="text-sm text-destructive">{error}</p>}
          <Button
            type="submit"
            size="lg"
            className="mt-2 h-[52px] w-full"
            disabled={loading}
          >
            {loading ? "Criando…" : "Criar workspace"}
          </Button>
        </form>
      )}

      {mode === "invite" && (
        <div className="flex flex-col gap-3">
          <InputField
            label="Seu nome"
            {...form.register("displayName")}
          />
          <InputField
            label="Token ou URL do convite"
            value={inviteToken}
            onChange={(e) => setInviteToken(e.target.value)}
            placeholder="…/invite/abc123"
          />
          <AvatarColorPicker
            value={avatarColor}
            onChange={(c) => form.setValue("avatarColor", c)}
          />
          {error && <p className="text-sm text-destructive">{error}</p>}
          <Button
            type="button"
            size="lg"
            className="mt-2 h-[52px] w-full"
            disabled={loading}
            onClick={joinWithInvite}
          >
            Entrar no workspace
          </Button>
        </div>
      )}

      {mode === "personal" && (
        <div className="flex flex-col gap-3">
          <InputField
            label="Seu nome"
            {...form.register("displayName")}
          />
          <AvatarColorPicker
            value={avatarColor}
            onChange={(c) => form.setValue("avatarColor", c)}
          />
          {error && <p className="text-sm text-destructive">{error}</p>}
          <Button
            type="button"
            size="lg"
            className="mt-2 h-[52px] w-full"
            disabled={loading || !allowSkip}
            onClick={continuePersonal}
          >
            Continuar no pessoal
          </Button>
          {!allowSkip && (
            <p className="text-xs text-foreground/35">
              Workspace pessoal já disponível nas configurações.
            </p>
          )}
        </div>
      )}
    </div>
  );
}

function AvatarColorPicker({
  value,
  onChange,
}: {
  value: string;
  onChange: (c: string) => void;
}) {
  return (
    <div className="flex flex-col gap-1.5">
      <span className="text-xs font-medium tracking-wide text-foreground/50">
        Cor do avatar
      </span>
      <div className="flex flex-wrap gap-2">
        {AVATAR_COLORS.map((color) => (
          <button
            key={color}
            type="button"
            className="h-8 w-8 rounded-full transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            style={{
              backgroundColor: color,
              boxShadow: value === color ? `0 0 0 2px ${color}` : undefined,
            }}
            onClick={() => onChange(color)}
          />
        ))}
      </div>
    </div>
  );
}

function IntroWorkspacesVisual() {
  const items = [
    { emoji: "👤", name: "Meu Financeiro", type: "Pessoal", color: "#6366F1" },
    { emoji: "❤️", name: "Matheus & Ana", type: "Casal", color: "#EC4899" },
    {
      emoji: "🏠",
      name: "Apartamento 42",
      type: "Compartilhado",
      color: "#14B8A6",
    },
  ];
  return (
    <div className="flex w-full flex-col gap-3">
      {items.map((ws, i) => (
        <div
          key={ws.name}
          className="flex items-center gap-3 rounded-2xl border border-white/[0.06] p-4"
          style={{
            background: `${ws.color}0D`,
            transform: `translateX(${i * 8}px)`,
            opacity: 1 - i * 0.12,
          }}
        >
          <div
            className="flex h-10 w-10 items-center justify-center rounded-xl text-xl"
            style={{ background: `${ws.color}22` }}
          >
            {ws.emoji}
          </div>
          <div className="flex-1">
            <p className="text-sm font-semibold text-foreground/90">{ws.name}</p>
            <p className="mt-0.5 text-xs text-foreground/35">{ws.type}</p>
          </div>
          <div
            className="h-2 w-2 rounded-full"
            style={{ backgroundColor: ws.color }}
          />
        </div>
      ))}
    </div>
  );
}

function IntroAttributionVisual() {
  const people = [
    { label: "Consumiu", name: "Ana", color: "#EC4899", initial: "A" },
    { label: "Pagou", name: "Matheus", color: "#6366F1", initial: "M" },
    { label: "Cartão", name: "Matheus", color: "#6366F1", initial: "M" },
  ];
  return (
    <div className="w-full rounded-2xl border border-white/[0.06] bg-card p-4">
      <div className="mb-4 flex items-start gap-3">
        <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#1C1C1F] text-lg">
          🛒
        </div>
        <div>
          <p className="text-[14px] font-semibold text-foreground/90">
            Supermercado Extra
          </p>
          <p className="text-xs text-foreground/35">R$ 287,40 · Hoje</p>
        </div>
      </div>
      <div className="h-px bg-white/[0.06]" />
      <div className="flex gap-2 pt-4">
        {people.map((p) => (
          <div
            key={p.label}
            className="flex flex-1 flex-col items-center gap-1.5 rounded-xl bg-white/[0.04] py-2"
          >
            <span className="text-[9px] font-medium uppercase tracking-wider text-foreground/30">
              {p.label}
            </span>
            <div
              className="flex h-7 w-7 items-center justify-center rounded-full text-[10px] font-bold text-white"
              style={{ backgroundColor: p.color }}
            >
              {p.initial}
            </div>
            <span className="text-[11px] font-medium text-foreground/60">
              {p.name}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

function IntroReadyVisual() {
  return (
    <div className="flex w-full flex-col items-center gap-4">
      <BrandMark size="lg" />
      <div className="flex flex-col items-center gap-2">
        <p className="text-[15px] font-semibold text-foreground/90">
          Meu Financeiro
        </p>
        <span className="rounded-full bg-[#6366F115] px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-[#6366F1]">
          Pessoal
        </span>
      </div>
      <div className="mt-2 flex w-full gap-3">
        {[
          { emoji: "💳", label: "Adicionar cartão" },
          { emoji: "🏦", label: "Vincular conta" },
          { emoji: "👥", label: "Convidar alguém" },
        ].map(({ emoji, label }) => (
          <div
            key={label}
            className="flex flex-1 flex-col items-center gap-1.5 rounded-xl bg-[#18181B] py-3"
          >
            <span className="text-lg">{emoji}</span>
            <span className="text-center text-[10px] leading-tight text-foreground/40">
              {label}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

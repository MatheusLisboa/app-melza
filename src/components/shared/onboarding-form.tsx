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
  "#111111",
  "#1C1C1E",
  "#2C2C2E",
  "#3A3A3C",
  "#8E8E93",
  "#C7C7CC",
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
    window.location.assign("/dashboard");
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

  /* ============================= INTRO ============================= */
  if (phase === "intro") {
    const current = INTRO_STEPS[step];
    const isLast = step === INTRO_STEPS.length - 1;
    return (
      <div className="relative flex min-h-[100dvh] flex-col overflow-hidden bg-[#0a0a0a] px-6 pb-[max(2rem,env(safe-area-inset-bottom))] pt-[max(0.75rem,env(safe-area-inset-top))]">
        {/* Glows de fundo — profundidade premium */}
        <div className="pointer-events-none absolute -right-24 -top-24 h-72 w-72 rounded-full bg-white/[0.04] blur-3xl" />
        <div className="pointer-events-none absolute -bottom-32 -left-24 h-80 w-80 rounded-full bg-white/[0.03] blur-3xl" />

        {/* Header: voltar + progress + pular */}
        <div className="relative z-10 flex items-center justify-between py-3">
          {step > 0 ? (
            <button
              type="button"
              onClick={() => setStep((s) => s - 1)}
              className="flex h-9 w-9 items-center justify-center rounded-xl bg-white/[0.08] text-white/70 transition-colors active:bg-white/[0.14]"
              aria-label="Voltar"
            >
              <ChevronLeft size={18} strokeWidth={2} />
            </button>
          ) : (
            <div className="h-9 w-9" />
          )}

          <div className="flex gap-1.5">
            {INTRO_STEPS.map((_, i) => (
              <div
                key={i}
                className="h-1.5 rounded-full transition-all duration-500 ease-out"
                style={{
                  width: i === step ? 24 : 6,
                  backgroundColor:
                    i === step ? "#ffffff" : "rgba(255,255,255,0.16)",
                }}
              />
            ))}
          </div>

          {!isLast ? (
            <button
              type="button"
              onClick={() => setPhase("setup")}
              className="h-9 px-2 text-[13px] font-medium text-white/40 transition-colors hover:text-white/70"
            >
              Pular
            </button>
          ) : (
            <div className="h-9 w-12" />
          )}
        </div>

        {/* Conteúdo */}
        <div className="relative z-10 flex flex-1 flex-col justify-between gap-8 pt-4">
          <div
            key={`visual-${step}`}
            className="flex flex-1 animate-fade-scale items-center justify-center"
          >
            {step === 0 && <IntroWorkspacesVisual />}
            {step === 1 && <IntroAttributionVisual />}
            {step === 2 && <IntroReadyVisual />}
          </div>

          <div key={`copy-${step}`} className="animate-fade-up-lg">
            <h2
              className="whitespace-pre-line text-[32px] font-bold leading-[1.1] tracking-tight text-white"
            >
              {current.title}
            </h2>
            <p className="mt-4 text-[15px] leading-relaxed text-white/55">
              {current.desc}
            </p>
          </div>

          <button
            type="button"
            onClick={() => (isLast ? setPhase("setup") : setStep((s) => s + 1))}
            className="pressable flex h-[54px] w-full items-center justify-center rounded-2xl bg-white text-[15px] font-semibold text-[#111111] shadow-[0_8px_30px_rgba(255,255,255,0.15)] transition-all active:scale-[0.98]"
          >
            {isLast ? "Começar agora" : "Continuar"}
          </button>
        </div>
      </div>
    );
  }

  /* ============================= SETUP ============================= */
  return (
    <div className="mx-auto flex min-h-[100dvh] w-full max-w-lg flex-col bg-[var(--color-page)] px-6 pb-[max(2.5rem,env(safe-area-inset-bottom))] pt-[max(1.5rem,env(safe-area-inset-top))]">
      <div className="mb-8 flex animate-fade-up-lg flex-col items-center gap-4 text-center">
        <BrandMark size="md" />
        <div>
          <h1 className="text-[26px] font-bold tracking-tight text-[var(--color-text)]">
            Vamos configurar
          </h1>
          <p className="mt-1.5 text-[14px] text-[var(--color-text-2)]">
            Crie um workspace, entre com convite ou continue no pessoal.
          </p>
        </div>
      </div>

      {/* Tabs */}
      <div className="mb-6 grid grid-cols-3 gap-2 rounded-2xl bg-[var(--color-chip)] p-1.5">
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
              "rounded-xl py-2.5 text-[13px] font-semibold transition-all duration-200",
              mode === id
                ? "bg-[var(--color-ink)] text-white shadow-card dark:bg-[var(--color-pearl)] dark:text-[var(--color-ink)]"
                : "text-[var(--color-text-2)] active:bg-[var(--color-card)]"
            )}
          >
            {label}
          </button>
        ))}
      </div>

      <div key={mode} className="animate-fade-up">
        {mode === "create" && (
          <form
            onSubmit={form.handleSubmit(createWorkspace)}
            className="flex flex-col gap-4 rounded-2xl border border-[var(--color-line)] bg-[var(--color-card)] p-5 shadow-card"
          >
            <InputField
              label="Nome do workspace"
              placeholder="Matheus & Ana"
              {...form.register("workspaceName")}
              error={form.formState.errors.workspaceName?.message}
            />
            <div className="flex flex-col gap-1.5">
              <label className="text-label text-[var(--color-text-2)]">
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
                <SelectTrigger className="h-[50px] rounded-lg border border-[var(--color-line)] bg-[var(--color-input)]">
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
            {error && <p className="text-sm text-expense">{error}</p>}
            <Button
              type="submit"
              size="lg"
              className="mt-1 h-[54px] w-full"
              disabled={loading}
            >
              {loading ? "Criando…" : "Criar workspace"}
            </Button>
          </form>
        )}

        {mode === "invite" && (
          <div className="flex flex-col gap-4 rounded-2xl border border-[var(--color-line)] bg-[var(--color-card)] p-5 shadow-card">
            <InputField label="Seu nome" {...form.register("displayName")} />
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
            {error && <p className="text-sm text-expense">{error}</p>}
            <Button
              type="button"
              size="lg"
              className="mt-1 h-[54px] w-full"
              disabled={loading}
              onClick={joinWithInvite}
            >
              {loading ? "Entrando…" : "Entrar no workspace"}
            </Button>
          </div>
        )}

        {mode === "personal" && (
          <div className="flex flex-col gap-4 rounded-2xl border border-[var(--color-line)] bg-[var(--color-card)] p-5 shadow-card">
            <InputField label="Seu nome" {...form.register("displayName")} />
            <AvatarColorPicker
              value={avatarColor}
              onChange={(c) => form.setValue("avatarColor", c)}
            />
            {error && <p className="text-sm text-expense">{error}</p>}
            <Button
              type="button"
              size="lg"
              className="mt-1 h-[54px] w-full"
              disabled={loading || !allowSkip}
              onClick={continuePersonal}
            >
              {loading ? "Preparando…" : "Continuar no pessoal"}
            </Button>
            {!allowSkip && (
              <p className="text-xs text-[var(--color-text-3)]">
                Workspace pessoal já disponível nas configurações.
              </p>
            )}
          </div>
        )}
      </div>
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
    <div className="flex flex-col gap-2">
      <span className="text-label text-[var(--color-text-2)]">
        Cor do avatar
      </span>
      <div className="flex flex-wrap gap-2.5">
        {AVATAR_COLORS.map((color) => {
          const selected = value === color;
          return (
            <button
              key={color}
              type="button"
              aria-label={`Cor ${color}`}
              className={cn(
                "h-9 w-9 rounded-full border border-[var(--color-line)] transition-all focus-visible:outline-none",
                selected && "scale-110"
              )}
              style={{
                backgroundColor: color,
                outline: selected
                  ? "2px solid var(--color-text)"
                  : undefined,
                outlineOffset: 2,
              }}
              onClick={() => onChange(color)}
            />
          );
        })}
      </div>
    </div>
  );
}

/* ============================ VISUAIS ============================ */

function IntroWorkspacesVisual() {
  const items = [
    { emoji: "👤", name: "Meu Financeiro", type: "Pessoal" },
    { emoji: "❤️", name: "Matheus & Ana", type: "Casal" },
    { emoji: "🏠", name: "Apartamento 42", type: "Compartilhado" },
  ];
  return (
    <div className="flex w-full max-w-[340px] flex-col gap-3">
      {items.map((ws, i) => (
        <div
          key={ws.name}
          className="flex animate-fade-up-lg items-center gap-3 rounded-2xl border border-white/[0.08] bg-white/[0.06] p-4 backdrop-blur-sm"
          style={{
            transform: `translateX(${i * 10}px)`,
            animationDelay: `${i * 90}ms`,
            animationFillMode: "backwards",
          }}
        >
          <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-white/[0.08] text-xl">
            {ws.emoji}
          </div>
          <div className="flex-1">
            <p className="text-[14px] font-semibold text-white">{ws.name}</p>
            <p className="mt-0.5 text-[12px] text-white/40">{ws.type}</p>
          </div>
          <div className="h-2 w-2 rounded-full bg-white/40" />
        </div>
      ))}
    </div>
  );
}

function IntroAttributionVisual() {
  const people = [
    { label: "Consumiu", name: "Ana", initial: "A" },
    { label: "Pagou", name: "Matheus", initial: "M" },
    { label: "Cartão", name: "Matheus", initial: "M" },
  ];
  return (
    <div className="w-full max-w-[340px] animate-fade-up-lg rounded-2xl border border-white/[0.08] bg-white/[0.06] p-5 backdrop-blur-sm">
      <div className="mb-4 flex items-start gap-3">
        <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-white/[0.08] text-xl">
          🛒
        </div>
        <div>
          <p className="text-[15px] font-semibold text-white">
            Supermercado Extra
          </p>
          <p className="mt-0.5 font-mono text-[12px] text-white/45">
            R$ 287,40 · Hoje
          </p>
        </div>
      </div>
      <div className="h-px bg-white/[0.08]" />
      <div className="flex gap-2 pt-4">
        {people.map((p, i) => (
          <div
            key={p.label}
            className="flex flex-1 animate-fade-up flex-col items-center gap-1.5 rounded-xl bg-white/[0.05] py-2.5"
            style={{
              animationDelay: `${150 + i * 80}ms`,
              animationFillMode: "backwards",
            }}
          >
            <span className="text-[9px] font-semibold uppercase tracking-wider text-white/35">
              {p.label}
            </span>
            <div className="flex h-7 w-7 items-center justify-center rounded-full bg-white text-[11px] font-bold text-[#111111]">
              {p.initial}
            </div>
            <span className="text-[11px] font-medium text-white/70">
              {p.name}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

function IntroReadyVisual() {
  const actions = [
    { emoji: "💳", label: "Adicionar cartão" },
    { emoji: "🏦", label: "Vincular conta" },
    { emoji: "👥", label: "Convidar alguém" },
  ];
  return (
    <div className="flex w-full max-w-[340px] flex-col items-center gap-6">
      <div className="animate-fade-scale">
        <BrandMark size="lg" />
      </div>
      <div className="flex animate-fade-up flex-col items-center gap-2">
        <p className="text-[16px] font-semibold text-white">Meu Financeiro</p>
        <span className="rounded-full bg-white/[0.08] px-3 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-white/50">
          Pessoal
        </span>
      </div>
      <div className="flex w-full gap-3">
        {actions.map(({ emoji, label }, i) => (
          <div
            key={label}
            className="flex flex-1 animate-fade-up-lg flex-col items-center gap-2 rounded-2xl border border-white/[0.08] bg-white/[0.05] py-4"
            style={{
              animationDelay: `${150 + i * 90}ms`,
              animationFillMode: "backwards",
            }}
          >
            <span className="text-xl">{emoji}</span>
            <span className="text-center text-[10px] leading-tight text-white/45">
              {label}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

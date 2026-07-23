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
import { BrandLockup, BrandMark, InputField } from "@/components/design-system";
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

  if (phase === "intro") {
    const current = INTRO_STEPS[step];
    return (
      <div className="flex min-h-screen flex-col bg-background px-6 pb-8">
        <div className="flex items-center justify-between py-3">
          {step > 0 ? (
            <button
              type="button"
              onClick={() => setStep((s) => s - 1)}
              className="flex h-8 w-8 items-center justify-center rounded-xl bg-[var(--color-chip)]"
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
                    i === step ? "#c0c0c0" : "rgba(255,255,255,0.12)",
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
              className="whitespace-pre-line text-[28px] font-medium leading-tight text-foreground"
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
          <h1 className="text-xl font-medium tracking-tight">Configurar</h1>
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
                ? "bg-[#111111] text-white"
                : "bg-[var(--color-chip)] text-foreground/50 hover:bg-[var(--color-chip)]"
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
              <SelectTrigger className="h-[50px] rounded-md border border-[var(--color-line)] bg-white">
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
            className="h-8 w-8 rounded-full border border-[var(--color-line)] transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#111111]"
            style={{
              backgroundColor: color,
              outline:
                value === color ? "2px solid #c0c0c0" : undefined,
              outlineOffset: 2,
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
    { emoji: "👤", name: "Meu Financeiro", type: "Pessoal", color: "#c0c0c0" },
    { emoji: "❤️", name: "Matheus & Ana", type: "Casal", color: "#e0e0e0" },
    {
      emoji: "🏠",
      name: "Apartamento 42",
      type: "Compartilhado",
      color: "#888888",
    },
  ];
  return (
    <div className="flex w-full flex-col gap-3">
      {items.map((ws, i) => (
        <div
          key={ws.name}
          className="flex items-center gap-3 rounded-xl border border-[#E5E5EA] bg-white p-4"
          style={{
            transform: `translateX(${i * 8}px)`,
            opacity: 1 - i * 0.12,
          }}
        >
          <div className="flex h-10 w-10 items-center justify-center rounded-md bg-white text-xl">
            {ws.emoji}
          </div>
          <div className="flex-1">
            <p className="text-sm font-medium text-foreground/90">{ws.name}</p>
            <p className="mt-0.5 text-xs text-foreground/35">{ws.type}</p>
          </div>
          <div
            className="h-2 w-2 rounded-full bg-melza-silver"
          />
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
    <div className="w-full rounded-xl border border-[#E5E5EA] bg-white p-4">
      <div className="mb-4 flex items-start gap-3">
        <div className="flex h-10 w-10 items-center justify-center rounded-md bg-white text-lg">
          🛒
        </div>
        <div>
          <p className="text-[14px] font-medium text-foreground/90">
            Supermercado Extra
          </p>
          <p className="text-xs text-foreground/35">R$ 287,40 · Hoje</p>
        </div>
      </div>
      <div className="h-px bg-[#E5E5EA]" />
      <div className="flex gap-2 pt-4">
        {people.map((p) => (
          <div
            key={p.label}
            className="flex flex-1 flex-col items-center gap-1.5 rounded-md bg-[var(--color-chip)] py-2"
          >
            <span className="text-[9px] font-medium uppercase tracking-wider text-foreground/30">
              {p.label}
            </span>
            <div className="flex h-7 w-7 items-center justify-center rounded-full bg-[#1C1C1E] text-[10px] font-medium text-[#111111]">
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
    <div className="flex w-full flex-col items-center gap-5">
      <BrandLockup className="max-w-[200px]" priority={false} />
      <div className="flex flex-col items-center gap-2">
        <p className="text-[15px] font-medium text-foreground/90">
          Meu Financeiro
        </p>
        <span className="rounded-full bg-[var(--color-chip)] px-2 py-0.5 text-[10px] font-medium uppercase tracking-wide text-[#8E8E93]">
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
            className="flex flex-1 flex-col items-center gap-1.5 rounded-md bg-white py-3"
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

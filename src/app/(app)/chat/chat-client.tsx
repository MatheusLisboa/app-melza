"use client";

import { useEffect, useRef, useState } from "react";
import { Btn } from "@/components/design-system";
import { Textarea } from "@/components/ui/textarea";
import { Send, Sparkles } from "lucide-react";
import { useAppShell } from "@/components/shared/app-shell";
import { cn } from "@/lib/utils";
import {
  clearChatHistory,
  loadChatHistory,
  saveChatHistory,
} from "@/lib/chat/history";

type Msg = { role: "user" | "assistant"; content: string };

const SUGGESTIONS = [
  "Quanto gastei este mês?",
  "Saldo das contas e limite disponível",
  "Quanto falta na fatura?",
  "Quem deve a quem no Entre Nós?",
  "Lança R$ 45 no iFood no Nubank",
  "Categoriza as despesas sem categoria",
];

export function ChatClient() {
  const { member } = useAppShell();
  const workspaceId = member.workspace_id;
  const [messages, setMessages] = useState<Msg[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const bottomRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const skipSave = useRef(true);

  useEffect(() => {
    setMessages(loadChatHistory(workspaceId));
    skipSave.current = true;
  }, [workspaceId]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, loading]);

  useEffect(() => {
    if (skipSave.current) {
      skipSave.current = false;
      return;
    }
    saveChatHistory(workspaceId, messages);
  }, [messages, workspaceId]);

  async function send(override?: string) {
    const text = (override ?? input).trim();
    if (!text || loading) return;

    const nextMessages: Msg[] = [...messages, { role: "user", content: text }];
    setMessages(nextMessages);
    setInput("");
    setLoading(true);
    setError(null);

    try {
      const res = await fetch("/api/ai/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ messages: nextMessages }),
      });

      const contentType = res.headers.get("content-type") ?? "";

      if (!res.ok || contentType.includes("application/json")) {
        const data = (await res.json().catch(() => ({}))) as {
          error?: string;
          code?: string;
        };
        if (data.code === "MISSING_API_KEY") {
          setError(
            "Configure GROQ_API_KEY (grátis em console.groq.com) no .env.local ou Vercel."
          );
        } else if (data.code === "INSUFFICIENT_QUOTA") {
          setError(
            data.error ??
              "Quota da OpenAI esgotada. Configure GROQ_API_KEY na Vercel (padrão do Melza)."
          );
        } else {
          setError(data.error ?? "Falha ao falar com a IA");
        }
        setLoading(false);
        return;
      }

      if (!res.body) {
        setError("Falha ao falar com a IA");
        setLoading(false);
        return;
      }

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let assistant = "";
      setMessages((prev) => [...prev, { role: "assistant", content: "" }]);

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        assistant += decoder.decode(value, { stream: true });
        setMessages((prev) => {
          const copy = [...prev];
          copy[copy.length - 1] = { role: "assistant", content: assistant };
          return copy;
        });
      }

      if (!assistant.trim()) {
        const provider = res.headers.get("x-melza-ai-provider");
        setError(
          provider === "groq"
            ? "A IA (Groq) não retornou texto. Tente de novo ou confirme a GROQ_API_KEY."
            : provider === "openai"
              ? "A IA (OpenAI) não retornou texto — quota/créditos ou chave inválida."
              : "A IA não retornou resposta. Confirme GROQ_API_KEY na Vercel e faça redeploy."
        );
      }
    } catch {
      setError("Erro de rede ao chamar a IA");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="page-enter flex h-[calc(100dvh-8rem)] flex-col md:h-[calc(100vh-2rem)]">
      <div className="px-5 pt-3 md:px-6">
        <div className="flex items-center gap-2.5">
          <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-[var(--color-ink)] text-white dark:bg-[var(--color-pearl)] dark:text-[var(--color-ink)]">
            <Sparkles size={16} strokeWidth={2} />
          </div>
          <div>
            <h1 className="text-page-title">Assistente</h1>
            <p className="text-[12px] text-[var(--color-text-2)]">
              Lançamentos, faturas, saldos e Entre Nós
            </p>
          </div>
          {messages.length > 0 ? (
            <button
              type="button"
              className="ml-auto text-[12px] text-[var(--color-text-3)] hover:text-[var(--color-text)]"
              onClick={() => {
                setMessages([]);
                clearChatHistory(workspaceId);
              }}
            >
              Limpar
            </button>
          ) : null}
        </div>
      </div>

      <div className="mt-4 min-h-0 flex-1 overflow-y-auto px-5 md:px-6">
        {messages.length === 0 ? (
          <div className="flex flex-col gap-4 pb-4">
            <p className="text-sm text-[var(--color-text-2)]">
              Toque em um atalho ou escreva o que precisa.
            </p>
            <div className="flex flex-col gap-2">
              {SUGGESTIONS.map((prompt) => (
                <button
                  key={prompt}
                  type="button"
                  disabled={loading}
                  onClick={() => void send(prompt)}
                  className="pressable-subtle rounded-2xl border border-[var(--color-line)] bg-[var(--color-card)] px-4 py-3 text-left text-[14px] font-medium text-[var(--color-text)] transition-colors hover:bg-[var(--color-chip)]"
                >
                  {prompt}
                </button>
              ))}
            </div>
          </div>
        ) : (
          <div className="flex flex-col gap-3 pb-4">
            {messages.map((m, i) => (
              <div
                key={`${m.role}-${i}`}
                className={cn(
                  "max-w-[88%] whitespace-pre-wrap px-3.5 py-2.5 text-sm leading-relaxed",
                  m.role === "user"
                    ? "ml-auto rounded-2xl rounded-br-md bg-[var(--color-ink)] text-white dark:bg-[var(--color-pearl)] dark:text-[var(--color-ink)]"
                    : "mr-auto rounded-2xl rounded-bl-md border border-[var(--color-line)] bg-[var(--color-card)] text-[var(--color-text)]"
                )}
              >
                {m.content || (loading ? "…" : "")}
              </div>
            ))}
            {loading && messages[messages.length - 1]?.role === "user" ? (
              <div className="mr-auto rounded-2xl border border-[var(--color-line)] bg-[var(--color-card)] px-3.5 py-2.5 text-sm text-[var(--color-text-2)]">
                Pensando…
              </div>
            ) : null}
            <div ref={bottomRef} />
          </div>
        )}
      </div>

      <div className="border-t border-[var(--color-line)] bg-[var(--color-page)] px-4 py-3 md:px-6">
        {error ? (
          <p className="mb-2 text-[12px] text-[var(--color-expense)]">{error}</p>
        ) : null}
        <div className="flex items-end gap-2">
          <Textarea
            ref={textareaRef}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Pergunte ou peça um lançamento…"
            rows={1}
            className="min-h-[44px] max-h-32 resize-none rounded-xl bg-[var(--color-card)]"
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                void send();
              }
            }}
          />
          <Btn
            type="button"
            size="md"
            className="h-11 w-11 shrink-0 px-0"
            disabled={loading || !input.trim()}
            onClick={() => void send()}
            aria-label="Enviar"
          >
            <Send className="h-4 w-4" />
          </Btn>
        </div>
      </div>
    </div>
  );
}

"use client";

import { useState, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent } from "@/components/ui/card";
import { Send } from "lucide-react";

type Msg = { role: "user" | "assistant"; content: string };

export function ChatClient() {
  const [messages, setMessages] = useState<Msg[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const bottomRef = useRef<HTMLDivElement>(null);

  async function send() {
    const text = input.trim();
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
      bottomRef.current?.scrollIntoView({ behavior: "smooth" });
    }
  }

  return (
    <div className="page-pad flex h-[calc(100dvh-8rem)] flex-col gap-3 md:h-[calc(100vh-2rem)] md:px-6">
      <div>
        <h1 className="text-[17px] font-medium tracking-tight text-foreground/95">
          Chat financeiro
        </h1>
        <p className="mt-0.5 text-sm text-muted-foreground">
          Pergunte sobre gastos, cartões e empréstimos
        </p>
      </div>

      <Card className="flex min-h-0 flex-1 flex-col border-border/60">
        <CardContent className="flex min-h-0 flex-1 flex-col gap-3 overflow-y-auto p-4">
          {messages.length === 0 && (
            <div className="space-y-2 text-sm text-muted-foreground">
              <p>Exemplos:</p>
              <ul className="list-inside list-disc space-y-1">
                <li>Quanto gastamos de iFood em julho?</li>
                <li>Qual cartão mais usamos este mês?</li>
                <li>Meu pai ainda deve quanto?</li>
              </ul>
            </div>
          )}
          {messages.map((m, i) => (
            <div
              key={`${m.role}-${i}`}
              className={
                m.role === "user"
                  ? "ml-8 rounded-[10px] bg-[var(--color-chip)] px-3 py-2 text-sm"
                  : "mr-8 whitespace-pre-wrap rounded-2xl bg-muted px-3 py-2 text-sm"
              }
            >
              {m.content || (loading ? "…" : "")}
            </div>
          ))}
          <div ref={bottomRef} />
        </CardContent>
      </Card>

      {error && (
        <p className="text-sm text-[#EF4444]">{error}</p>
      )}

      <div className="flex gap-2">
        <Textarea
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="Sua pergunta…"
          rows={2}
          className="min-h-[44px] resize-none"
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              void send();
            }
          }}
        />
        <Button
          type="button"
          size="icon"
          className="h-11 w-11 shrink-0"
          disabled={loading || !input.trim()}
          onClick={() => void send()}
        >
          <Send className="h-4 w-4" />
        </Button>
      </div>
    </div>
  );
}

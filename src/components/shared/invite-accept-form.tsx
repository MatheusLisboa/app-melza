"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { setActiveWorkspaceAction } from "@/lib/actions/workspace";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import Link from "next/link";

const AVATAR_COLORS = [
  "#111111",
  "#1C1C1E",
  "#2C2C2E",
  "#3A3A3C",
  "#8E8E93",
  "#C7C7CC",
];

export function InviteAcceptForm({ token }: { token: string }) {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [needsAuth, setNeedsAuth] = useState(false);
  const [displayName, setDisplayName] = useState("");
  const [avatarColor, setAvatarColor] = useState(AVATAR_COLORS[0]);

  useEffect(() => {
    async function check() {
      const supabase = createClient();
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user) {
        setNeedsAuth(true);
        setLoading(false);
        return;
      }

      const { data: invite } = await supabase
        .from("workspace_invites")
        .select("workspace_id")
        .eq("token", token)
        .maybeSingle();

      if (invite?.workspace_id) {
        const { data: existing } = await supabase
          .from("workspace_members")
          .select("id")
          .eq("user_id", user.id)
          .eq("workspace_id", invite.workspace_id)
          .maybeSingle();

        if (existing) {
          await setActiveWorkspaceAction(invite.workspace_id);
          router.replace("/dashboard");
          return;
        }
      }

      setDisplayName(
        (user.user_metadata?.display_name as string) ||
          user.email?.split("@")[0] ||
          ""
      );
      setLoading(false);
    }

    void check();
  }, [router, token]);

  async function accept() {
    setSubmitting(true);
    setError(null);
    const supabase = createClient();
    const { data: workspaceId, error: rpcError } = await supabase.rpc(
      "accept_workspace_invite",
      {
        p_token: token,
        p_display_name: displayName || "Membro",
        p_avatar_color: avatarColor,
      }
    );
    setSubmitting(false);

    if (rpcError) {
      setError(rpcError.message);
      return;
    }

    if (workspaceId) {
      await setActiveWorkspaceAction(workspaceId as string);
    }

    router.push("/dashboard");
    router.refresh();
  }

  if (loading) {
    return (
      <p className="text-sm text-muted-foreground">Verificando convite…</p>
    );
  }

  if (needsAuth) {
    const redirectTo = `/invite/${token}`;
    return (
      <Card className="w-full max-w-sm border-border/60 bg-card/80">
        <CardHeader>
          <CardTitle>Convite para workspace</CardTitle>
          <CardDescription>
            Entre ou crie uma conta para aceitar o convite.
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-3">
          <Button asChild>
            <Link href={`/login?redirectTo=${encodeURIComponent(redirectTo)}`}>
              Entrar
            </Link>
          </Button>
          <Button asChild variant="outline">
            <Link href={`/signup?redirectTo=${encodeURIComponent(redirectTo)}`}>
              Criar conta
            </Link>
          </Button>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="w-full max-w-sm border-border/60 bg-card/80">
      <CardHeader>
        <CardTitle>Aceitar convite</CardTitle>
        <CardDescription>
          Confirme seu nome e entre no workspace do convite.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor="displayName">Seu nome</Label>
          <Input
            id="displayName"
            value={displayName}
            onChange={(e) => setDisplayName(e.target.value)}
          />
        </div>
        <div className="space-y-2">
          <Label>Cor do avatar</Label>
          <div className="flex flex-wrap gap-2">
            {AVATAR_COLORS.map((color) => (
              <button
                key={color}
                type="button"
                className="h-8 w-8 rounded-full"
                style={{
                  backgroundColor: color,
                  boxShadow:
                    avatarColor === color ? `0 0 0 2px ${color}` : undefined,
                }}
                onClick={() => setAvatarColor(color)}
              />
            ))}
          </div>
        </div>
        {error && <p className="text-sm text-destructive">{error}</p>}
        <Button className="w-full" disabled={submitting} onClick={accept}>
          {submitting ? "Entrando…" : "Aceitar convite"}
        </Button>
      </CardContent>
    </Card>
  );
}

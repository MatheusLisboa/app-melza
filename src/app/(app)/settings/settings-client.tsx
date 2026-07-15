"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
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
import type { Workspace, WorkspaceInvite, WorkspaceMember } from "@/types";
import { MemberAvatar } from "@/components/shared/member-avatar";
import { CreateWorkspaceForm } from "@/components/shared/create-workspace-form";
import { useWorkspaceMembers } from "@/lib/hooks/use-finance";
import { workspaceTypeLabel } from "@/lib/utils/workspace";
import { Copy, Download, LogOut, RefreshCw, Trash2 } from "lucide-react";
import { ThemeToggle } from "@/components/shared/theme-toggle";
import { useUiStore } from "@/lib/stores/ui-store";
import { signOutAction } from "@/lib/actions/auth";
import { deleteWorkspaceAction } from "@/lib/actions/workspace";
import { useAppShell } from "@/components/shared/app-shell";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

const AVATAR_COLORS = [
  "#c0c0c0",
  "#e0e0e0",
  "#888888",
  "#444444",
  "#333333",
  "#cc4444",
];

export function SettingsClient({
  member,
}: {
  member: WorkspaceMember & { workspace?: Workspace | null };
}) {
  const router = useRouter();
  const { memberships } = useAppShell();
  const alertDays = useUiStore((s) => s.subscriptionAlertDays);
  const setAlertDays = useUiStore((s) => s.setSubscriptionAlertDays);
  const [displayName, setDisplayName] = useState(member.display_name);
  const [avatarColor, setAvatarColor] = useState(member.avatar_color);
  const [invite, setInvite] = useState<WorkspaceInvite | null>(null);
  const [inviteUrl, setInviteUrl] = useState("");
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [deletingWs, setDeletingWs] = useState(false);

  const { data: members = [] } = useWorkspaceMembers(member.workspace_id);
  const isPersonal = member.workspace?.type === "PERSONAL";
  const isOwner = member.role === "owner";
  const canDeleteWorkspace =
    isOwner && (memberships.length > 1 || !isPersonal);

  useEffect(() => {
    async function loadInvite() {
      if (isPersonal) return;
      const supabase = createClient();
      const { data } = await supabase
        .from("workspace_invites")
        .select("*")
        .eq("workspace_id", member.workspace_id)
        .is("used_at", null)
        .is("revoked_at", null)
        .gt("expires_at", new Date().toISOString())
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();

      if (data) {
        setInvite(data as WorkspaceInvite);
        setInviteUrl(`${window.location.origin}/invite/${data.token}`);
      }
    }
    void loadInvite();
  }, [member.workspace_id, isPersonal]);

  async function saveProfile() {
    setSaving(true);
    setError(null);
    setMessage(null);
    const supabase = createClient();
    const { error: updateError } = await supabase
      .from("workspace_members")
      .update({ display_name: displayName, avatar_color: avatarColor })
      .eq("id", member.id);
    setSaving(false);
    if (updateError) {
      setError(updateError.message);
      return;
    }
    setMessage("Perfil atualizado");
    router.refresh();
  }

  async function generateInvite() {
    setError(null);
    setMessage(null);
    const supabase = createClient();
    const { data, error: rpcError } = await supabase.rpc(
      "create_workspace_invite",
      { p_workspace_id: member.workspace_id }
    );
    if (rpcError) {
      setError(rpcError.message);
      return;
    }
    const created = data as WorkspaceInvite;
    setInvite(created);
    setInviteUrl(`${window.location.origin}/invite/${created.token}`);
    setMessage("Link de convite gerado");
  }

  async function revokeInvite() {
    if (!invite) return;
    const supabase = createClient();
    await supabase
      .from("workspace_invites")
      .update({ revoked_at: new Date().toISOString() })
      .eq("id", invite.id);
    setInvite(null);
    setInviteUrl("");
    setMessage("Convite revogado");
  }

  async function copyInvite() {
    if (!inviteUrl) return;
    await navigator.clipboard.writeText(inviteUrl);
    setMessage("Link copiado");
  }

  async function exportData() {
    setExporting(true);
    setError(null);
    try {
      const res = await fetch("/api/account/export");
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error || "Falha na exportação");
      }
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `melza-export-${new Date().toISOString().slice(0, 10)}.json`;
      a.click();
      URL.revokeObjectURL(url);
      setMessage("Exportação baixada");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Falha na exportação");
    } finally {
      setExporting(false);
    }
  }

  async function deleteAccount() {
    if (
      !window.confirm(
        "Apagar conta e dados financeiros acessíveis? Esta ação não pode ser desfeita."
      )
    ) {
      return;
    }
    setDeleting(true);
    setError(null);
    try {
      const res = await fetch("/api/account/delete", { method: "POST" });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(body.error || "Falha ao apagar");
      await signOutAction();
      window.location.assign("/login");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Falha ao apagar");
      setDeleting(false);
    }
  }

  async function deleteWorkspace() {
    const name = member.workspace?.name ?? "este workspace";
    if (
      !window.confirm(
        `Apagar "${name}" e todos os lançamentos, cartões e dados dele? Esta ação não pode ser desfeita.`
      )
    ) {
      return;
    }
    setDeletingWs(true);
    setError(null);
    setMessage(null);
    const res = await deleteWorkspaceAction(member.workspace_id);
    if (res.error) {
      setError(res.error);
      setDeletingWs(false);
      return;
    }
    // Hard reload limpa shell com staleTime: Infinity
    window.location.assign("/dashboard");
  }

  async function signOut() {
    try {
      await signOutAction();
    } catch {
      const supabase = createClient();
      await supabase.auth.signOut({ scope: "global" });
    }
    window.location.assign("/login");
  }

  return (
    <div className="mx-auto max-w-2xl space-y-6 page-pad md:px-6">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h1 className="text-[17px] font-medium tracking-tight text-foreground/95">
            Perfil
          </h1>
          <p className="mt-0.5 text-sm text-muted-foreground">
            {member.workspace?.name ?? "Workspace"} ·{" "}
            {workspaceTypeLabel(member.workspace?.type)}
          </p>
        </div>
        <ThemeToggle />
      </div>

      <Card className="border-border/60">
        <CardHeader>
          <CardTitle className="text-base">Aparência</CardTitle>
          <CardDescription>Tema e alertas de assinatura</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-sm">Modo claro / escuro</span>
            <ThemeToggle />
          </div>
          <div className="space-y-1">
            <Label>Alertar assinaturas (dias antes)</Label>
            <Select
              value={String(alertDays)}
              onValueChange={(v) => setAlertDays(Number(v))}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="3">3 dias</SelectItem>
                <SelectItem value="7">7 dias</SelectItem>
                <SelectItem value="14">14 dias</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      <Card className="border-border/60">
        <CardHeader>
          <CardTitle className="text-base">Perfil</CardTitle>
          <CardDescription>Nome e cor do avatar neste workspace</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center gap-4">
            <MemberAvatar name={displayName} color={avatarColor} size="lg" />
            <div className="flex-1 space-y-2">
              <Label htmlFor="displayName">Nome</Label>
              <Input
                id="displayName"
                value={displayName}
                onChange={(e) => setDisplayName(e.target.value)}
              />
            </div>
          </div>
          <div className="space-y-2">
            <Label>Cor</Label>
            <div className="flex flex-wrap gap-2">
              {AVATAR_COLORS.map((color) => (
                <button
                  key={color}
                  type="button"
                  className="h-8 w-8 rounded-full border border-[var(--color-line)]"
                  style={{
                    backgroundColor: color,
                    outline:
                      avatarColor === color
                        ? "2px solid #c0c0c0"
                        : undefined,
                    outlineOffset: 2,
                  }}
                  onClick={() => setAvatarColor(color)}
                />
              ))}
            </div>
          </div>
          <Button onClick={saveProfile} disabled={saving}>
            {saving ? "Salvando…" : "Salvar perfil"}
          </Button>
        </CardContent>
      </Card>

      <Card className="border-border/60" id="workspace">
        <CardHeader>
          <CardTitle className="text-base">Membros</CardTitle>
          <CardDescription>
            Quem participa deste workspace
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <ul className="space-y-2">
            {members.map((m) => (
              <li key={m.id} className="flex items-center gap-3">
                <MemberAvatar
                  name={m.display_name}
                  color={m.avatar_color}
                  size="sm"
                />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium">{m.display_name}</p>
                  <p className="text-xs capitalize text-muted-foreground">
                    {m.role}
                  </p>
                </div>
              </li>
            ))}
          </ul>
        </CardContent>
      </Card>

      {!isPersonal && (
        <Card className="border-border/60">
          <CardHeader>
            <CardTitle className="text-base">Convite</CardTitle>
            <CardDescription>
              Gere um link único para outro membro entrar.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {inviteUrl ? (
              <>
                <Input readOnly value={inviteUrl} />
                <div className="flex flex-wrap gap-2">
                  <Button type="button" variant="outline" onClick={copyInvite}>
                    <Copy className="mr-2 h-4 w-4" />
                    Copiar
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    onClick={generateInvite}
                  >
                    <RefreshCw className="mr-2 h-4 w-4" />
                    Novo link
                  </Button>
                  <Button type="button" variant="ghost" onClick={revokeInvite}>
                    Revogar
                  </Button>
                </div>
              </>
            ) : (
              <Button onClick={generateInvite} disabled={!isOwner}>
                Gerar link de convite
              </Button>
            )}
          </CardContent>
        </Card>
      )}

      <Card className="border-border/60">
        <CardHeader>
          <CardTitle className="text-base">Novo workspace</CardTitle>
          <CardDescription>
            Crie casal, família ou compartilhado (seu pessoal permanece).
          </CardDescription>
        </CardHeader>
        <CardContent>
          <CreateWorkspaceForm defaultDisplayName={member.display_name} />
        </CardContent>
      </Card>

      {isOwner && (
        <Card className="border-border/60 border-destructive/20">
          <CardHeader>
            <CardTitle className="text-base">Apagar workspace</CardTitle>
            <CardDescription>
              Só quem criou pode apagar. Remove lançamentos, cartões e membros
              deste espaço.
            </CardDescription>
          </CardHeader>
          <CardContent>
            {canDeleteWorkspace ? (
              <Button
                type="button"
                variant="destructive"
                disabled={deletingWs}
                onClick={deleteWorkspace}
              >
                <Trash2 className="mr-2 h-4 w-4" />
                {deletingWs
                  ? "Apagando…"
                  : `Apagar "${member.workspace?.name ?? "workspace"}"`}
              </Button>
            ) : (
              <p className="text-sm text-muted-foreground">
                Para apagar o workspace pessoal, crie ou entre em outro
                workspace antes.
              </p>
            )}
          </CardContent>
        </Card>
      )}

      <Card className="border-border/60">
        <CardHeader>
          <CardTitle className="text-base">Privacidade (LGPD)</CardTitle>
          <CardDescription>
            Exportar seus dados ou solicitar exclusão da conta.{" "}
            <Link href="/privacy" className="text-[#8E8E93] underline">
              Política
            </Link>{" "}
            ·{" "}
            <Link href="/terms" className="text-[#8E8E93] underline">
              Termos
            </Link>
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-wrap gap-2">
          <Button
            type="button"
            variant="outline"
            disabled={exporting}
            onClick={exportData}
          >
            <Download className="mr-2 h-4 w-4" />
            {exporting ? "Exportando…" : "Exportar JSON"}
          </Button>
          <Button
            type="button"
            variant="destructive"
            disabled={deleting}
            onClick={deleteAccount}
          >
            <Trash2 className="mr-2 h-4 w-4" />
            {deleting ? "Apagando…" : "Apagar conta"}
          </Button>
        </CardContent>
      </Card>

      {(message || error) && (
        <p
          className={
            error ? "text-sm text-destructive" : "text-sm text-[#22C55E]"
          }
        >
          {error ?? message}
        </p>
      )}

      <Button variant="outline" onClick={signOut}>
        <LogOut className="mr-2 h-4 w-4" />
        Sair
      </Button>
    </div>
  );
}

"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import { toast } from "sonner";
import { Btn } from "@/components/design-system";
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
import { Copy, Download, LogOut, RefreshCw, Trash2, Camera } from "lucide-react";
import { ThemeToggle } from "@/components/shared/theme-toggle";
import { PushNotificationsSettings } from "@/components/shared/push-notifications-settings";
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
  const [avatarUrl, setAvatarUrl] = useState<string | null>(
    member.avatar_url ?? null
  );
  const [photoBusy, setPhotoBusy] = useState(false);
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
      .update({
        display_name: displayName,
        avatar_color: avatarColor,
        avatar_url: avatarUrl,
      })
      .eq("id", member.id);
    setSaving(false);
    if (updateError) {
      setError(updateError.message);
      toast.error(updateError.message);
      return;
    }
    setMessage("Perfil atualizado");
    toast.success("Perfil atualizado");
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
      toast.error(rpcError.message);
      return;
    }
    const created = data as WorkspaceInvite;
    setInvite(created);
    setInviteUrl(`${window.location.origin}/invite/${created.token}`);
    setMessage("Link de convite gerado");
    toast.success("Link de convite gerado");
  }

  async function revokeInvite() {
    if (!invite) return;
    const supabase = createClient();
    const { error: revokeError } = await supabase
      .from("workspace_invites")
      .update({ revoked_at: new Date().toISOString() })
      .eq("id", invite.id);
    if (revokeError) {
      setError(revokeError.message);
      toast.error(revokeError.message);
      return;
    }
    setInvite(null);
    setInviteUrl("");
    setMessage("Convite revogado");
    toast.success("Convite revogado");
  }

  async function copyInvite() {
    if (!inviteUrl) return;
    try {
      await navigator.clipboard.writeText(inviteUrl);
      setMessage("Link copiado");
      toast.success("Link copiado");
    } catch {
      toast.error("Não foi possível copiar o link");
    }
  }

  async function onPhotoSelected(file: File | null) {
    if (!file) return;
    if (!file.type.startsWith("image/")) {
      const msg = "Selecione uma imagem (JPG, PNG ou WebP)";
      setError(msg);
      toast.error(msg);
      return;
    }
    if (file.size > 2 * 1024 * 1024) {
      const msg = "A foto deve ter no máximo 2 MB";
      setError(msg);
      toast.error(msg);
      return;
    }

    setPhotoBusy(true);
    setError(null);
    setMessage(null);
    const supabase = createClient();
    const ext = file.name.split(".").pop()?.toLowerCase() || "jpg";
    const path = `${member.user_id}/${member.id}.${ext === "jpeg" ? "jpg" : ext}`;

    const { error: uploadError } = await supabase.storage
      .from("avatars")
      .upload(path, file, { upsert: true, contentType: file.type });

    if (uploadError) {
      setPhotoBusy(false);
      const msg = uploadError.message.includes("Bucket not found")
        ? "Bucket de avatares ainda não existe. Rode a migration 008 no Supabase."
        : uploadError.message;
      setError(msg);
      toast.error(msg);
      return;
    }

    const { data: pub } = supabase.storage.from("avatars").getPublicUrl(path);
    const url = `${pub.publicUrl}?t=${Date.now()}`;

    const { error: updateError } = await supabase
      .from("workspace_members")
      .update({ avatar_url: url })
      .eq("id", member.id);

    setPhotoBusy(false);
    if (updateError) {
      setError(updateError.message);
      toast.error(updateError.message);
      return;
    }
    setAvatarUrl(url);
    setMessage("Foto atualizada");
    toast.success("Foto atualizada");
    router.refresh();
  }

  async function removePhoto() {
    if (!avatarUrl) return;
    setPhotoBusy(true);
    setError(null);
    const supabase = createClient();
    const { error: updateError } = await supabase
      .from("workspace_members")
      .update({ avatar_url: null })
      .eq("id", member.id);
    setPhotoBusy(false);
    if (updateError) {
      setError(updateError.message);
      toast.error(updateError.message);
      return;
    }
    setAvatarUrl(null);
    setMessage("Foto removida");
    toast.success("Foto removida");
    router.refresh();
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
      toast.success("Exportação baixada");
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Falha na exportação";
      setError(msg);
      toast.error(msg);
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
      const msg = e instanceof Error ? e.message : "Falha ao apagar";
      setError(msg);
      toast.error(msg);
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
      toast.error(res.error);
      setDeletingWs(false);
      return;
    }
    // Hard reload limpa shell / QueryClient do PWA
    window.location.assign("/dashboard");
  }

  async function signOut() {
    try {
      await signOutAction();
      window.location.assign("/login");
    } catch {
      try {
        const supabase = createClient();
        await supabase.auth.signOut({ scope: "global" });
        window.location.assign("/login");
      } catch (e) {
        toast.error(
          e instanceof Error ? e.message : "Não foi possível sair. Tente de novo."
        );
      }
    }
  }

  return (
    <div className="mx-auto max-w-2xl space-y-5 page-pad md:px-6">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h1 className="text-[17px] font-semibold tracking-tight text-[var(--color-ink)]">
            Perfil
          </h1>
          <p className="mt-0.5 text-sm text-[var(--color-silver)]">
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
          <CardTitle className="text-base">Notificações</CardTitle>
          <CardDescription>
            Avisos do sistema (Entre Nós, fatura e acertos)
          </CardDescription>
        </CardHeader>
        <CardContent>
          <PushNotificationsSettings />
        </CardContent>
      </Card>

      <Card className="border-border/60">
        <CardHeader>
          <CardTitle className="text-base">Perfil</CardTitle>
          <CardDescription>
            Foto, nome e cor do avatar neste workspace
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center gap-4">
            <div className="relative">
              <MemberAvatar
                name={displayName}
                color={avatarColor}
                imageUrl={avatarUrl}
                size={64}
              />
              <label
                className="absolute -bottom-1 -right-1 flex h-8 w-8 cursor-pointer items-center justify-center rounded-full border border-[var(--color-line)] bg-[var(--color-card)] text-[var(--color-text)] shadow-sm transition-colors hover:bg-[var(--color-chip)]"
                title="Alterar foto"
              >
                <Camera size={14} />
                <input
                  type="file"
                  accept="image/jpeg,image/png,image/webp,image/gif"
                  className="sr-only"
                  disabled={photoBusy}
                  onChange={(e) => {
                    const file = e.target.files?.[0] ?? null;
                    e.target.value = "";
                    void onPhotoSelected(file);
                  }}
                />
              </label>
            </div>
            <div className="min-w-0 flex-1 space-y-2">
              <Label htmlFor="displayName">Nome</Label>
              <Input
                id="displayName"
                value={displayName}
                onChange={(e) => setDisplayName(e.target.value)}
              />
              <div className="flex flex-wrap gap-2">
                <label className="cursor-pointer text-xs font-medium text-[var(--color-text)] underline-offset-2 hover:underline">
                  {photoBusy ? "Enviando…" : "Escolher foto"}
                  <input
                    type="file"
                    accept="image/jpeg,image/png,image/webp,image/gif"
                    className="sr-only"
                    disabled={photoBusy}
                    onChange={(e) => {
                      const file = e.target.files?.[0] ?? null;
                      e.target.value = "";
                      void onPhotoSelected(file);
                    }}
                  />
                </label>
                {avatarUrl && (
                  <button
                    type="button"
                    className="text-xs font-medium text-[#EF4444] underline-offset-2 hover:underline"
                    disabled={photoBusy}
                    onClick={() => void removePhoto()}
                  >
                    Remover foto
                  </button>
                )}
              </div>
            </div>
          </div>
          <div className="space-y-2">
            <Label>Cor (quando sem foto)</Label>
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
          <Btn onClick={saveProfile} disabled={saving || photoBusy}>
            {saving ? "Salvando…" : "Salvar perfil"}
          </Btn>
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
                  imageUrl={m.avatar_url}
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
                  <Btn
                    type="button"
                    variant="secondary"
                    onClick={copyInvite}
                    icon={<Copy className="h-4 w-4" />}
                  >
                    Copiar
                  </Btn>
                  <Btn
                    type="button"
                    variant="secondary"
                    onClick={generateInvite}
                    icon={<RefreshCw className="h-4 w-4" />}
                  >
                    Novo link
                  </Btn>
                  <Btn type="button" variant="ghost" onClick={revokeInvite}>
                    Revogar
                  </Btn>
                </div>
              </>
            ) : (
              <Btn onClick={generateInvite} disabled={!isOwner}>
                Gerar link de convite
              </Btn>
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
              <Btn
                type="button"
                variant="destructive"
                disabled={deletingWs}
                onClick={deleteWorkspace}
                icon={<Trash2 className="h-4 w-4" />}
              >
                {deletingWs
                  ? "Apagando…"
                  : `Apagar "${member.workspace?.name ?? "workspace"}"`}
              </Btn>
            ) : (
              <p className="text-sm text-[var(--color-silver)]">
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
          <Btn
            type="button"
            variant="secondary"
            disabled={exporting}
            onClick={exportData}
            icon={<Download className="h-4 w-4" />}
          >
            {exporting ? "Exportando…" : "Exportar JSON"}
          </Btn>
          <Btn
            type="button"
            variant="destructive"
            disabled={deleting}
            onClick={deleteAccount}
            icon={<Trash2 className="h-4 w-4" />}
          >
            {deleting ? "Apagando…" : "Apagar conta"}
          </Btn>
        </CardContent>
      </Card>

      {(message || error) && (
        <p
          className={
            error ? "text-sm text-[#EF4444]" : "text-sm text-[#22C55E]"
          }
        >
          {error ?? message}
        </p>
      )}

      <Btn variant="secondary" onClick={signOut} icon={<LogOut className="h-4 w-4" />}>
        Sair
      </Btn>
    </div>
  );
}

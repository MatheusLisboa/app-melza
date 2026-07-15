"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { setActiveWorkspaceAction } from "@/lib/actions/workspace";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type { WorkspaceType } from "@/types";

export function CreateWorkspaceForm({
  defaultDisplayName,
  onCreated,
}: {
  defaultDisplayName?: string;
  onCreated?: () => void;
}) {
  const router = useRouter();
  const [name, setName] = useState("");
  const [type, setType] = useState<Exclude<WorkspaceType, "PERSONAL">>("COUPLE");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (name.trim().length < 2) {
      setError("Informe um nome");
      return;
    }
    setLoading(true);
    setError(null);
    const supabase = createClient();
    const { data: workspaceId, error: rpcError } = await supabase.rpc(
      "create_workspace_with_defaults",
      {
        p_name: name.trim(),
        p_display_name: defaultDisplayName || "Eu",
        p_avatar_color: "#111111",
        p_type: type,
      }
    );
    setLoading(false);
    if (rpcError) {
      setError(rpcError.message);
      return;
    }
    if (workspaceId) {
      await setActiveWorkspaceAction(workspaceId as string);
    }
    setName("");
    onCreated?.();
    router.refresh();
  }

  return (
    <form onSubmit={submit} className="space-y-3">
      <div className="space-y-2">
        <Label htmlFor="ws-name">Nome</Label>
        <Input
          id="ws-name"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Ex.: Casa, Viagem 2026"
        />
      </div>
      <div className="space-y-2">
        <Label>Tipo</Label>
        <Select
          value={type}
          onValueChange={(v) =>
            setType(v as Exclude<WorkspaceType, "PERSONAL">)
          }
        >
          <SelectTrigger>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="COUPLE">Casal</SelectItem>
            <SelectItem value="FAMILY">Família</SelectItem>
            <SelectItem value="SHARED">Compartilhado</SelectItem>
          </SelectContent>
        </Select>
      </div>
      {error && <p className="text-sm text-destructive">{error}</p>}
      <Button type="submit" disabled={loading}>
        {loading ? "Criando…" : "Criar workspace"}
      </Button>
    </form>
  );
}

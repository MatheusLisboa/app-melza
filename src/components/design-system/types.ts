/** Tipos de membro / workspace usados pelos primitivos Make */

export type DsMember = {
  id: string;
  name: string;
  initials: string;
  color: string;
  imageUrl?: string | null;
};

export type DsWorkspaceVisual = {
  id?: string;
  emoji: string;
  name?: string;
  color: string;
};

export function toDsMember(input: {
  id: string;
  display_name?: string;
  name?: string;
  avatar_color?: string;
  color?: string;
  avatar_url?: string | null;
  imageUrl?: string | null;
}): DsMember {
  const name = input.display_name ?? input.name ?? "?";
  return {
    id: input.id,
    name,
    initials: name.slice(0, 2).toUpperCase(),
    color: input.avatar_color ?? input.color ?? "#1C1C1E",
    imageUrl: input.avatar_url ?? input.imageUrl ?? null,
  };
}

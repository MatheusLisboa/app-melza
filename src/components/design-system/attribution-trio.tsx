import { cn } from "@/lib/utils";

export type AttributionMember = {
  id: string;
  name: string;
  color: string;
  initials?: string;
};

/**
 * Trio consumiu / pagou / cartão — regra de negócio visual do Figma.
 * Esconde quando os três são a mesma pessoa.
 */
export function AttributionTrio({
  consumer,
  payer,
  cardOwner,
  className,
}: {
  consumer: AttributionMember;
  payer: AttributionMember;
  cardOwner: AttributionMember;
  className?: string;
}) {
  const allSame =
    consumer.id === payer.id && payer.id === cardOwner.id;
  if (allSame) return null;

  const fields = [
    { label: "consumiu", member: consumer, show: true },
    { label: "pagou", member: payer, show: payer.id !== consumer.id },
    {
      label: "cartão",
      member: cardOwner,
      show: cardOwner.id !== payer.id,
    },
  ].filter((f) => f.show);

  return (
    <div className={cn("mt-1 flex items-center gap-2", className)}>
      {fields.map(({ label, member }, i) => (
        <div key={label} className="flex items-center gap-1">
          {i > 0 && (
            <span className="text-[10px] text-foreground/15">·</span>
          )}
          <span className="text-[10px] text-foreground/30">{label}</span>
          <div
            className="flex h-3.5 w-3.5 shrink-0 items-center justify-center rounded-full text-[7px] font-bold text-white"
            style={{ backgroundColor: member.color }}
          >
            {(member.initials ?? member.name)[0]}
          </div>
          <span className="text-[10px] font-medium text-foreground/50">
            {member.name}
          </span>
        </div>
      ))}
    </div>
  );
}

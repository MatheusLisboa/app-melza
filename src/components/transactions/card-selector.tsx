"use client";

import type { Account, AccountType, Card } from "@/types";
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { encodePaymentMethod } from "@/lib/utils/payment-method";
import { cn } from "@/lib/utils";

export { encodePaymentMethod, parsePaymentMethod } from "@/lib/utils/payment-method";

interface CardSelectorProps {
  cards: Card[];
  accounts: Account[];
  value?: string;
  onChange: (value: string) => void;
  accountsOnly?: boolean;
  cardsOnly?: boolean;
  accountTypes?: AccountType[];
  placeholder?: string;
  triggerClassName?: string;
}

export function CardSelector({
  cards,
  accounts,
  value,
  onChange,
  accountsOnly = false,
  cardsOnly = false,
  accountTypes,
  placeholder = "Cartão ou conta",
  triggerClassName,
}: CardSelectorProps) {
  const showCards = !accountsOnly;
  const showAccounts = !cardsOnly;

  const activeCards = showCards ? cards.filter((c) => c.is_active) : [];
  const activeAccounts = showAccounts
    ? accounts.filter((a) => {
        if (!a.is_active) return false;
        if (accountTypes?.length && !accountTypes.includes(a.account_type)) {
          return false;
        }
        return true;
      })
    : [];

  const accountsLabel =
    accountTypes?.length === 1 && accountTypes[0] === "cash"
      ? "Dinheiro"
      : "Contas";

  return (
    <Select value={value || undefined} onValueChange={onChange}>
      <SelectTrigger
        className={cn(
          "h-12 rounded-xl border-border/80 bg-muted/40 px-3.5 text-sm",
          triggerClassName
        )}
      >
        <SelectValue placeholder={placeholder} />
      </SelectTrigger>
      <SelectContent>
        {activeCards.length > 0 && (
          <SelectGroup>
            <SelectLabel>Cartões</SelectLabel>
            {activeCards.map((card) => (
              <SelectItem
                key={card.id}
                value={encodePaymentMethod("card", card.id)}
              >
                <span className="flex items-center gap-2">
                  <span
                    className="inline-block h-2.5 w-2.5 rounded-full"
                    style={{ backgroundColor: card.color }}
                  />
                  {card.name}
                </span>
              </SelectItem>
            ))}
          </SelectGroup>
        )}
        {activeAccounts.length > 0 && (
          <SelectGroup>
            <SelectLabel>{accountsLabel}</SelectLabel>
            {activeAccounts.map((account) => (
              <SelectItem
                key={account.id}
                value={encodePaymentMethod("account", account.id)}
              >
                <span className="flex items-center gap-2">
                  <span
                    className="inline-block h-2.5 w-2.5 rounded-full"
                    style={{ backgroundColor: account.color ?? "#6366f1" }}
                  />
                  {account.name}
                </span>
              </SelectItem>
            ))}
          </SelectGroup>
        )}
      </SelectContent>
    </Select>
  );
}

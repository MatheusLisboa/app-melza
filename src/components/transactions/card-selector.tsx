"use client";

import type { Account, Card } from "@/types";
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

export { encodePaymentMethod, parsePaymentMethod } from "@/lib/utils/payment-method";

interface CardSelectorProps {
  cards: Card[];
  accounts: Account[];
  value?: string;
  onChange: (value: string) => void;
  accountsOnly?: boolean;
  placeholder?: string;
}

export function CardSelector({
  cards,
  accounts,
  value,
  onChange,
  accountsOnly = false,
  placeholder = "Cartão ou conta",
}: CardSelectorProps) {
  const activeCards = cards.filter((c) => c.is_active);
  const activeAccounts = accounts.filter((a) => a.is_active);

  return (
    <Select value={value} onValueChange={onChange}>
      <SelectTrigger>
        <SelectValue placeholder={placeholder} />
      </SelectTrigger>
      <SelectContent>
        {!accountsOnly && activeCards.length > 0 && (
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
            <SelectLabel>Contas</SelectLabel>
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

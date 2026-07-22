-- Rateio no lançamento + contas pessoais vs compartilhadas
ALTER TABLE public.transactions
  ADD COLUMN IF NOT EXISTS consumer_share_percent INTEGER NOT NULL DEFAULT 100
  CHECK (consumer_share_percent >= 1 AND consumer_share_percent <= 100);

COMMENT ON COLUMN public.transactions.consumer_share_percent IS
  'Percentual do valor que o consumidor deve (100 = integral, 50 = rateio 50/50).';

ALTER TABLE public.accounts
  ADD COLUMN IF NOT EXISTS is_shared BOOLEAN NOT NULL DEFAULT TRUE;

COMMENT ON COLUMN public.accounts.is_shared IS
  'false = conta pessoal do owner_member_id; true = conta compartilhada do workspace';

-- Contas com dono definido e nome sugerindo pessoal → pessoal (heurística leve, opcional)
-- Mantemos default true; o usuário marca no formulário.

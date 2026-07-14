-- consumer_member_id: quem consumiu (≠ quem pagou / dono do cartão)
ALTER TABLE public.transactions
  ADD COLUMN IF NOT EXISTS consumer_member_id UUID
    REFERENCES public.workspace_members(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_transactions_consumer
  ON public.transactions(consumer_member_id);

COMMENT ON COLUMN public.transactions.consumer_member_id IS
  'Membro que consumiu/se beneficiou da despesa (Make: AttributionTrio consumer)';

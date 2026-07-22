-- Acerto Entre Nós: reembolso entre membros (total ou parcial)
ALTER TABLE public.transactions
  DROP CONSTRAINT IF EXISTS transactions_transaction_type_check;

ALTER TABLE public.transactions
  ADD CONSTRAINT transactions_transaction_type_check
  CHECK (transaction_type IN (
    'expense', 'income', 'transfer',
    'loan_given', 'loan_received', 'loan_repayment',
    'settlement'
  ));

COMMENT ON CONSTRAINT transactions_transaction_type_check ON public.transactions IS
  'settlement = acerto/reembolso entre membros do workspace (Entre Nós)';

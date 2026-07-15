export type MemberRole = "owner" | "member";
export type WorkspaceType = "PERSONAL" | "COUPLE" | "FAMILY" | "SHARED";
export type CardType = "credit" | "debit";
export type AccountType = "checking" | "savings" | "cash" | "investment";
export type CategoryType = "expense" | "income" | "transfer";
export type BillingCycle = "monthly" | "yearly" | "weekly";
export type TransactionType =
  | "expense"
  | "income"
  | "transfer"
  | "loan_given"
  | "loan_received"
  | "loan_repayment";
export type TransactionStatus =
  | "pending"
  | "confirmed"
  | "cancelled"
  | "scheduled";
export type LoanDirection = "given" | "received";
export type LoanStatus = "open" | "partial" | "paid" | "cancelled";

export interface Workspace {
  id: string;
  name: string;
  type: WorkspaceType;
  created_at: string;
}

export interface WorkspaceMember {
  id: string;
  workspace_id: string;
  user_id: string;
  display_name: string;
  role: MemberRole;
  avatar_color: string;
  avatar_url?: string | null;
  created_at: string;
  workspace?: Workspace | null;
}

export interface WorkspaceInvite {
  id: string;
  workspace_id: string;
  token: string;
  created_by_member_id: string | null;
  expires_at: string;
  used_at: string | null;
  used_by_user_id: string | null;
  revoked_at: string | null;
  created_at: string;
}

export interface ThirdParty {
  id: string;
  workspace_id: string;
  name: string;
  relationship: string | null;
  phone: string | null;
  created_at: string;
}

export interface Card {
  id: string;
  workspace_id: string;
  owner_member_id: string | null;
  name: string;
  bank: string;
  last_four: string | null;
  card_type: CardType;
  color: string;
  closing_day: number | null;
  due_day: number | null;
  credit_limit: number | null;
  is_active: boolean;
  created_at: string;
}

export interface Account {
  id: string;
  workspace_id: string;
  owner_member_id: string | null;
  name: string;
  account_type: AccountType;
  bank: string | null;
  current_balance: number | null;
  color: string | null;
  is_active: boolean;
  created_at: string;
}

export interface Category {
  id: string;
  workspace_id: string;
  name: string;
  icon: string | null;
  color: string;
  type: CategoryType;
  parent_id: string | null;
  created_at: string;
}

export interface Subscription {
  id: string;
  workspace_id: string;
  name: string;
  amount: number;
  currency: string;
  billing_cycle: BillingCycle;
  next_billing_date: string | null;
  card_id: string | null;
  account_id: string | null;
  category_id: string | null;
  is_active: boolean;
  notes: string | null;
  logo_url: string | null;
  created_at: string;
}

export interface Loan {
  id: string;
  workspace_id: string;
  third_party_id: string | null;
  direction: LoanDirection;
  original_amount: number;
  paid_amount: number;
  description: string | null;
  due_date: string | null;
  status: LoanStatus;
  created_at: string;
}

export interface Transaction {
  id: string;
  workspace_id: string;
  created_by_member_id: string | null;
  paid_by_member_id: string | null;
  consumer_member_id: string | null;
  amount: number;
  currency: string;
  transaction_type: TransactionType;
  description: string;
  notes: string | null;
  category_id: string | null;
  tags: string[] | null;
  card_id: string | null;
  account_id: string | null;
  transfer_to_account_id: string | null;
  transfer_group_id: string | null;
  third_party_id: string | null;
  loan_id: string | null;
  is_installment: boolean;
  installment_number: number | null;
  total_installments: number | null;
  installment_group_id: string | null;
  subscription_id: string | null;
  is_recurring: boolean;
  transaction_date: string;
  due_date: string | null;
  paid_at: string | null;
  status: TransactionStatus;
  ai_category_suggestion: string | null;
  ai_confidence: number | null;
  created_at: string;
  updated_at: string;
}

export type TransactionWithRelations = Transaction & {
  category?: Category | null;
  card?: Card | null;
  account?: Account | null;
  paid_by?: WorkspaceMember | null;
  consumer?: WorkspaceMember | null;
  third_party?: ThirdParty | null;
};

export type PaymentMethod =
  | { kind: "card"; id: string }
  | { kind: "account"; id: string };

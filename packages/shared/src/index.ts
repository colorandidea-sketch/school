// Account Types
export type AccountType = 'ASSET' | 'LIABILITY' | 'EQUITY' | 'REVENUE' | 'EXPENSE' | 'CONTRA';
export type NormalBalance = 'DEBIT' | 'CREDIT';

export interface Account {
  id: string;
  account_code: string;
  account_name_ar: string;
  account_name_en: string;
  account_type: AccountType;
  normal_balance: NormalBalance;
  current_balance: number;
  parent_account_id?: string;
  is_postable: boolean;
}

// Journal Entry Types
export type JournalEntryStatus = 'DRAFT' | 'PENDING_APPROVAL' | 'APPROVED' | 'POSTED' | 'REVERSED' | 'VOID';
export type JournalEntryType = 'STANDARD' | 'ADJUSTING' | 'CLOSING' | 'REVERSING' | 'RECURRING' | 'OPENING';
export type SourceType = 'MANUAL' | 'INVOICE' | 'RECEIPT' | 'PAYMENT' | 'PAYROLL' | 'DEPRECIATION' | 'AUTO';

export interface JournalEntryLine {
  id: string;
  account_id: string;
  debit_amount: number;
  credit_amount: number;
  description_ar?: string;
  description_en?: string;
  cost_center_id?: string;
}

export interface JournalEntry {
  id: string;
  entry_number: string;
  entry_date: string;
  entry_type: JournalEntryType;
  source_type: SourceType;
  description_ar?: string;
  description_en?: string;
  total_debit: number;
  total_credit: number;
  status: JournalEntryStatus;
  lines: JournalEntryLine[];
}

// Student & Fee Types
export type StudentStatus = 'ACTIVE' | 'GRADUATED' | 'WITHDRAWN' | 'SUSPENDED' | 'TRANSFERRED';
export type InvoiceStatus = 'DRAFT' | 'ISSUED' | 'PARTIALLY_PAID' | 'PAID' | 'OVERDUE' | 'CANCELLED' | 'REFUNDED';
export type PaymentMethod = 'CASH' | 'BANK_TRANSFER' | 'MADA' | 'CREDIT_CARD' | 'SADAD' | 'CHEQUE' | 'ONLINE';
export type DiscountType = 'PERCENTAGE' | 'FIXED' | 'SCHOLARSHIP' | 'SIBLING' | 'STAFF' | 'EARLY_PAYMENT';

export interface StudentAccount {
  id: string;
  student_number: string;
  student_name_ar: string;
  student_name_en: string;
  guardian_name_ar?: string;
  guardian_phone?: string;
  grade_level: string;
  status: StudentStatus;
  total_fees: number;
  total_paid: number;
  total_balance: number;
  academic_year_id: string;
}

export interface InvoiceLine {
  id: string;
  description_ar: string;
  description_en: string;
  quantity: number;
  unit_price: number;
  discount_amount: number;
  taxable_amount: number;
  vat_rate: number;
  vat_amount: number;
  total_amount: number;
}

export interface StudentInvoice {
  id: string;
  invoice_number: string;
  student_account_id: string;
  invoice_date: string;
  due_date: string;
  subtotal: number;
  discount_amount: number;
  taxable_amount: number;
  vat_amount: number;
  total_amount: number;
  amount_paid: number;
  balance_due: number;
  status: InvoiceStatus;
  zatca_uuid?: string;
  zatca_submission_status?: 'PENDING' | 'SUBMITTED' | 'ACCEPTED' | 'REJECTED';
  lines: InvoiceLine[];
}

export interface PaymentReceipt {
  id: string;
  receipt_number: string;
  student_account_id: string;
  receipt_date: string;
  total_amount: number;
  payment_method: PaymentMethod;
  allocated_invoices?: Array<{ invoice_id: string; amount_allocated: number }>;
  status: 'RECEIVED' | 'DEPOSITED' | 'BOUNCED' | 'CANCELLED';
}

// Payroll Types
export type EmploymentType = 'FULL_TIME' | 'PART_TIME' | 'CONTRACT' | 'TEMPORARY';
export type PayrollPaymentStatus = 'PENDING' | 'PAID' | 'HELD';

export interface Employee {
  id: string;
  employee_number: string;
  name_ar: string;
  name_en: string;
  national_id?: string;
  iqama_number?: string;
  position?: string;
  employment_type: EmploymentType;
  hire_date: string;
  basic_salary: number;
  housing_allowance: number;
  transportation_allowance: number;
  is_saudi: boolean;
  gosi_registered: boolean;
  gosi_number?: string;
  bank_name?: string;
  iban?: string;
}

export interface PayrollDetail {
  id: string;
  employee_id: string;
  basic_salary: number;
  housing_allowance: number;
  transportation_allowance: number;
  other_allowances: number;
  total_earnings: number;
  gosi_employee_share: number;
  gosi_employer_share: number;
  total_deductions: number;
  net_salary: number;
  payment_status: PayrollPaymentStatus;
}

// Bank Types
export type TransactionType = 'DEPOSIT' | 'WITHDRAWAL' | 'TRANSFER' | 'CHARGE' | 'INTEREST';
export type ReconciliationStatus = 'UNRECONCILED' | 'RECONCILED' | 'EXCEPTION';

export interface BankTransaction {
  id: string;
  bank_account_id: string;
  transaction_date: string;
  transaction_type: TransactionType;
  reference_number: string;
  debit_amount: number;
  credit_amount: number;
  running_balance: number;
  reconciliation_status: ReconciliationStatus;
}

// API Response Types
export interface ApiResponse<T> {
  success: boolean;
  data?: T;
  message?: string;
  errors?: Array<{ field: string; message: string }>;
}

export interface PaginatedResponse<T> extends ApiResponse<T[]> {
  meta: {
    page: number;
    pageSize: number;
    total: number;
    totalPages: number;
  };
}

// Dashboard Types
export interface DashboardKPIs {
  total_revenue: number;
  total_expenses: number;
  net_income: number;
  cash_position: number;
  accounts_receivable: number;
  accounts_payable: number;
  fee_collection_rate: number;
  outstanding_fees: number;
}

export interface ChartDataPoint {
  label: string;
  value: number;
  color?: string;
}

// Form Validation Schemas
export const journalEntrySchema = {
  entry_date: 'date',
  entry_type: 'string',
  source_type: 'string',
  description_ar: 'string?',
  description_en: 'string?',
  lines: 'array',
};

export const invoiceSchema = {
  student_account_id: 'uuid',
  invoice_date: 'date',
  due_date: 'date',
  lines: 'array',
};

// Constants
export const VAT_RATE = 15;
export const SAR_CURRENCY = 'SAR';
export const HUNIDRED = 100;

// GOSI Rates (Saudi Labor Law)
export const GOSI_RATES = {
  SAUDI: {
    EMPLOYEE: 0.0975, // 9.75% (9% Pension + 0.75% SANED)
    EMPLOYER: 0.1175, // 11.75% (9% Pension + 2% Occupational + 0.75% SANED)
  },
  NON_SAUDI: {
    EMPLOYEE: 0.02, // 2% (Occupational Hazards)
    EMPLOYER: 0.02, // 2% (Occupational Hazards)
  },
};

// End of Service Benefits (Saudi Labor Law)
export const EOS_BENEFITS = {
  FIRST_FIVE_YEARS: 0.5, // Half month salary per year
  AFTER_FIVE_YEARS: 1.0, // Full month salary per year
  MAX_GOSI_BASE: 45000, // Maximum base for GOSI calculation
};

// ZATCA Invoice Types
export const ZATCA_INVOICE_TYPE = {
  INVOICE: '388',
  CREDIT_NOTE: '381',
  DEBIT_NOTE: '383',
};
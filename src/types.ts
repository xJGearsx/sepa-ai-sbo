export type ChatRole = 'system' | 'user' | 'assistant'

export type SalesReportStatus = 'Open' | 'Closed' | 'Overdue'

export type SalesReportData = {
  title: string
  periodStart: string
  periodEnd: string
  currency: string
  invoices: number
  totalAmount: number
  byStatus: { status: SalesReportStatus; amount: number; count: number }[]
  byAgent: { agent: string; amount: number }[]
  byDate: { date: string; amount: number }[]
  latest: {
    docNum: string
    docDate: string
    customer: string
    status: SalesReportStatus
    total: number
  }[]
}

export type ArReportData = {
  title: string
  periodStart: string
  periodEnd: string
  currency: string
  openInvoices: number
  overdueInvoices: number
  outstandingAmount: number
  currentAmount: number
  overdueAmount: number
  byCustomer: { customer: string; amount: number; open: number; overdue: number }[]
  latest: { docNum: string; docDate: string; customer: string; status: SalesReportStatus; total: number }[]
}

export type ChatMessageText = {
  type: 'text'
  role: ChatRole
  content: string
}

export type ChatMessageSalesReport = {
  type: 'sales_report'
  role: 'assistant'
  report: SalesReportData
}

export type ChatMessageArReport = {
  type: 'ar_report'
  role: 'assistant'
  report: ArReportData
}

export type ChatMenuOption = {
  id: string
  label: string
  sendText: string
}

export type ChatMessageMenu = {
  type: 'menu'
  role: 'assistant'
  title: string
  subtitle?: string
  options: ChatMenuOption[]
}

export type ChatMessage =
  | ChatMessageText
  | ChatMessageSalesReport
  | ChatMessageArReport
  | ChatMessageMenu

export type SapConfig = {
  dbType: 'sql' | 'hana'
  demoMode: boolean
  baseUrl: string
  companyDb: string
  userName: string
  password: string
}

export type JournalEntryLineDraft = {
  accountCode: string
  debit?: number
  credit?: number
}

export type JournalEntryDraft = {
  referenceDate?: string
  memo?: string
  dueDate?: string
  taxDate?: string
  lines: JournalEntryLineDraft[]
}

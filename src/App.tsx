import './App.css'
import { useEffect, useMemo, useRef, useState } from 'react'
import { aiChat, postJournalEntry } from './api'
import {
  createJournalFlowState,
  handleJournalFlowInput,
  isStartJournalEntryIntent,
  journalFlowFirstPrompt,
  type JournalFlowState,
} from './journalFlow'
import type {
  ArReportData,
  ChatMessage,
  ChatMessageText,
  SalesReportData,
  SalesReportStatus,
  SapConfig,
} from './types'

type DemoInvoice = {
  docNum: string
  docDate: string
  customer: string
  salesAgent: string
  status: SalesReportStatus
  total: number
}

const demoInvoices: DemoInvoice[] = [
  { docNum: 'INV-100301', docDate: '2026-04-01', customer: 'CDS100216', salesAgent: 'A. Santos', status: 'Closed', total: 27 },
  { docNum: 'INV-100302', docDate: '2026-04-02', customer: 'NEX200014', salesAgent: 'A. Santos', status: 'Open', total: 1250 },
  { docNum: 'INV-100303', docDate: '2026-04-02', customer: 'BLU100031', salesAgent: 'J. Cruz', status: 'Closed', total: 865.5 },
  { docNum: 'INV-100304', docDate: '2026-04-03', customer: 'OME300009', salesAgent: 'J. Cruz', status: 'Overdue', total: 410.2 },
  { docNum: 'INV-100305', docDate: '2026-04-03', customer: 'SUN100007', salesAgent: 'M. Reyes', status: 'Closed', total: 1999.99 },
  { docNum: 'INV-100306', docDate: '2026-04-04', customer: 'KAI900002', salesAgent: 'M. Reyes', status: 'Open', total: 540 },
  { docNum: 'INV-100307', docDate: '2026-04-04', customer: 'FST400003', salesAgent: 'L. Tan', status: 'Closed', total: 320.75 },
  { docNum: 'INV-100308', docDate: '2026-04-05', customer: 'WIN700004', salesAgent: 'L. Tan', status: 'Open', total: 780 },
  { docNum: 'INV-100309', docDate: '2026-04-06', customer: 'RIV200010', salesAgent: 'S. Dela Cruz', status: 'Closed', total: 150 },
  { docNum: 'INV-100310', docDate: '2026-04-06', customer: 'NEX200014', salesAgent: 'S. Dela Cruz', status: 'Overdue', total: 230.4 },
  { docNum: 'INV-100311', docDate: '2026-04-07', customer: 'OME300009', salesAgent: 'J. Cruz', status: 'Closed', total: 5100 },
  { docNum: 'INV-100312', docDate: '2026-04-07', customer: 'SUN100007', salesAgent: 'M. Reyes', status: 'Open', total: 930.1 },
  { docNum: 'INV-100313', docDate: '2026-04-08', customer: 'CDS100216', salesAgent: 'A. Santos', status: 'Open', total: 615.2 },
  { docNum: 'INV-100314', docDate: '2026-04-08', customer: 'BLU100031', salesAgent: 'J. Cruz', status: 'Closed', total: 120.0 },
  { docNum: 'INV-100315', docDate: '2026-04-09', customer: 'FST400003', salesAgent: 'L. Tan', status: 'Overdue', total: 412.75 },
  { docNum: 'INV-100316', docDate: '2026-04-09', customer: 'WIN700004', salesAgent: 'L. Tan', status: 'Closed', total: 1040.0 },
  { docNum: 'INV-100317', docDate: '2026-04-10', customer: 'RIV200010', salesAgent: 'S. Dela Cruz', status: 'Open', total: 275.0 },
  { docNum: 'INV-100318', docDate: '2026-04-10', customer: 'KAI900002', salesAgent: 'S. Dela Cruz', status: 'Closed', total: 60.0 },
  { docNum: 'INV-100319', docDate: '2026-04-11', customer: 'NEX200014', salesAgent: 'A. Santos', status: 'Closed', total: 180.0 },
  { docNum: 'INV-100320', docDate: '2026-04-11', customer: 'OME300009', salesAgent: 'J. Cruz', status: 'Open', total: 905.9 },
  { docNum: 'INV-100321', docDate: '2026-04-12', customer: 'SUN100007', salesAgent: 'M. Reyes', status: 'Closed', total: 410.0 },
  { docNum: 'INV-100322', docDate: '2026-04-13', customer: 'CDS100216', salesAgent: 'A. Santos', status: 'Overdue', total: 88.0 },
  { docNum: 'INV-100323', docDate: '2026-04-14', customer: 'BLU100031', salesAgent: 'J. Cruz', status: 'Open', total: 710.5 },
  { docNum: 'INV-100324', docDate: '2026-04-15', customer: 'FST400003', salesAgent: 'L. Tan', status: 'Closed', total: 250.0 },
  { docNum: 'INV-100325', docDate: '2026-04-16', customer: 'WIN700004', salesAgent: 'S. Dela Cruz', status: 'Open', total: 1340.25 },
]

type SalesReportFlowState = {
  active: boolean
  step: 'agent'
}

type ArReportFlowState = {
  active: boolean
  step: 'agent'
}

function formatMoney(n: number): string {
  const v = Math.round(n * 100) / 100
  return v.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}

function uniqueSalesAgents(invoices: DemoInvoice[]): string[] {
  return Array.from(new Set(invoices.map((i) => i.salesAgent))).sort((a, b) =>
    a.localeCompare(b),
  )
}

function isSalesReportIntent(text: string): boolean {
  const t = text.trim().toLowerCase()
  return (
    t.includes('sales report') ||
    t.includes('invoice report') ||
    t.includes('sales invoices') ||
    t.includes('invoices report')
  )
}

function isArIntent(text: string): boolean {
  const t = text.trim().toLowerCase()
  return (
    t.includes('accounts receivable') ||
    t.includes('account receivable') ||
    t.includes('a/r') ||
    t === 'ar' ||
    t.includes('ar report') ||
    t.includes('receivables')
  )
}

function buildSalesReportData(agent: string | 'all'): SalesReportData {
  const rows =
    agent === 'all'
      ? demoInvoices
      : demoInvoices.filter(
          (i) => i.salesAgent.toLowerCase() === agent.toLowerCase(),
        )

  const title =
    agent === 'all' ? 'Sales Report' : `Sales Report • ${agent}`

  const dates = rows.map((r) => r.docDate).sort()
  const periodStart = dates[0] ?? ''
  const periodEnd = dates[dates.length - 1] ?? ''

  const totalAmount = rows.reduce((acc, r) => acc + r.total, 0)
  const statuses: SalesReportStatus[] = ['Closed', 'Open', 'Overdue']
  const byStatus = statuses.map((status) => {
    const group = rows.filter((r) => r.status === status)
    const amount = group.reduce((acc, r) => acc + r.total, 0)
    return { status, amount, count: group.length }
  })

  const byAgentMap = new Map<string, number>()
  for (const inv of demoInvoices) {
    byAgentMap.set(inv.salesAgent, (byAgentMap.get(inv.salesAgent) ?? 0) + inv.total)
  }
  const byAgent = Array.from(byAgentMap.entries())
    .map(([agentName, amount]) => ({ agent: agentName, amount }))
    .sort((a, b) => b.amount - a.amount)

  const byDateMap = new Map<string, number>()
  for (const inv of rows) {
    byDateMap.set(inv.docDate, (byDateMap.get(inv.docDate) ?? 0) + inv.total)
  }
  const byDate = Array.from(byDateMap.entries())
    .map(([date, amount]) => ({ date, amount }))
    .sort((a, b) => a.date.localeCompare(b.date))

  const latest = rows
    .slice()
    .sort((a, b) => b.docDate.localeCompare(a.docDate))
    .slice(0, 6)
    .map((r) => ({
      docNum: r.docNum,
      docDate: r.docDate,
      customer: r.customer,
      status: r.status,
      total: r.total,
    }))

  return {
    title,
    periodStart,
    periodEnd,
    currency: 'PHP',
    invoices: rows.length,
    totalAmount,
    byStatus,
    byAgent,
    byDate,
    latest,
  }
}

function demoAssistantReply(text: string): string {
  const t = text.trim().toLowerCase()
  if (t.includes('hello') || t === 'hi') return 'Hi. Try: "create journal entry" or "sales report".'
  if (t.includes('journal')) return 'Type "create journal entry" to start.'
  if (t.includes('sales') || t.includes('invoice')) return 'Type "sales report" to see demo invoice totals by agent.'
  if (t.includes('receivable') || t === 'ar') return 'Type "accounts receivable" to see outstanding invoices in demo mode.'
  return 'For this demo, try: "create journal entry", "sales report", or "accounts receivable".'
}

function donutSegments(items: { value: number; color: string }[]): { dash: number; offset: number; color: string }[] {
  const total = items.reduce((acc, i) => acc + i.value, 0)
  const r = 42
  const c = 2 * Math.PI * r
  if (total <= 0) return []
  let offset = 0
  return items
    .filter((i) => i.value > 0)
    .map((i) => {
      const dash = (i.value / total) * c
      const seg = { dash, offset, color: i.color }
      offset += dash
      return seg
    })
}

function statusColor(status: SalesReportStatus): string {
  if (status === 'Closed') return 'var(--chart-closed)'
  if (status === 'Open') return 'var(--chart-open)'
  return 'var(--chart-overdue)'
}

function buildArReportData(agent: string | 'all'): ArReportData {
  const rows =
    agent === 'all'
      ? demoInvoices
      : demoInvoices.filter(
          (i) => i.salesAgent.toLowerCase() === agent.toLowerCase(),
        )

  const title =
    agent === 'all'
      ? 'Accounts Receivable'
      : `Accounts Receivable • ${agent}`

  const dates = rows.map((r) => r.docDate).sort()
  const periodStart = dates[0] ?? ''
  const periodEnd = dates[dates.length - 1] ?? ''

  const outstanding = rows.filter((r) => r.status !== 'Closed')
  const openInvoices = outstanding.filter((r) => r.status === 'Open').length
  const overdueInvoices = outstanding.filter((r) => r.status === 'Overdue').length
  const currentAmount = outstanding
    .filter((r) => r.status === 'Open')
    .reduce((acc, r) => acc + r.total, 0)
  const overdueAmount = outstanding
    .filter((r) => r.status === 'Overdue')
    .reduce((acc, r) => acc + r.total, 0)
  const outstandingAmount = currentAmount + overdueAmount

  const byCustomerMap = new Map<
    string,
    { customer: string; amount: number; open: number; overdue: number }
  >()
  for (const inv of outstanding) {
    const cur =
      byCustomerMap.get(inv.customer) ?? {
        customer: inv.customer,
        amount: 0,
        open: 0,
        overdue: 0,
      }
    cur.amount += inv.total
    if (inv.status === 'Overdue') cur.overdue += 1
    if (inv.status === 'Open') cur.open += 1
    byCustomerMap.set(inv.customer, cur)
  }
  const byCustomer = Array.from(byCustomerMap.values())
    .sort((a, b) => b.amount - a.amount)
    .slice(0, 6)

  const latest = outstanding
    .slice()
    .sort((a, b) => b.docDate.localeCompare(a.docDate))
    .slice(0, 6)
    .map((r) => ({
      docNum: r.docNum,
      docDate: r.docDate,
      customer: r.customer,
      status: r.status,
      total: r.total,
    }))

  return {
    title,
    periodStart,
    periodEnd,
    currency: 'PHP',
    openInvoices,
    overdueInvoices,
    outstandingAmount,
    currentAmount,
    overdueAmount,
    byCustomer,
    latest,
  }
}

function SalesReportCard({ report }: { report: SalesReportData }) {
  const donut = donutSegments(
    report.byStatus.map((s) => ({ value: s.amount, color: statusColor(s.status) })),
  )

  const maxAgent = Math.max(0, ...report.byAgent.map((a) => a.amount))
  const maxDate = Math.max(0, ...report.byDate.map((d) => d.amount))
  const minDate = report.byDate.length ? Math.min(...report.byDate.map((d) => d.amount)) : 0
  const rangeDate = Math.max(1, maxDate - minDate)

  const lineW = 320
  const lineH = 74
  const pad = 10
  const pts = report.byDate.map((d, idx) => {
    const x =
      report.byDate.length === 1
        ? lineW / 2
        : pad + (idx * (lineW - pad * 2)) / (report.byDate.length - 1)
    const y = pad + (1 - (d.amount - minDate) / rangeDate) * (lineH - pad * 2)
    return `${x},${y}`
  })

  return (
    <div className="reportCard">
      <div className="reportTop">
        <div className="reportTitle">{report.title}</div>
        <div className="reportMeta">
          {report.periodStart && report.periodEnd
            ? `${report.periodStart} → ${report.periodEnd}`
            : 'Demo period'}
        </div>
      </div>

      <div className="kpis">
        <div className="kpi">
          <div className="kpiLabel">Total Sales</div>
          <div className="kpiValue">{formatMoney(report.totalAmount)}</div>
          <div className="kpiSub">{report.currency}</div>
        </div>
        <div className="kpi">
          <div className="kpiLabel">Invoices</div>
          <div className="kpiValue">{report.invoices}</div>
          <div className="kpiSub">Count</div>
        </div>
      </div>

      <div className="reportGrid">
        <div className="panelCard">
          <div className="panelTitle">By Status</div>
          <div className="donutRow">
            <svg className="donut" viewBox="0 0 120 120" role="img" aria-label="Sales by status donut chart">
              <g transform="rotate(-90 60 60)">
                <circle cx="60" cy="60" r="42" fill="none" stroke="rgba(16, 24, 40, 0.08)" strokeWidth="14" />
                {donut.map((s, idx) => (
                  <circle
                    key={idx}
                    cx="60"
                    cy="60"
                    r="42"
                    fill="none"
                    stroke={s.color}
                    strokeWidth="14"
                    strokeDasharray={`${s.dash} ${9999}`}
                    strokeDashoffset={-s.offset}
                    strokeLinecap="butt"
                  />
                ))}
              </g>
            </svg>
            <div className="legend">
              {report.byStatus.map((s) => (
                <div key={s.status} className="legendRow">
                  <span className="dot" style={{ background: statusColor(s.status) }} />
                  <span className="legendLabel">{s.status}</span>
                  <span className="legendValue">{formatMoney(s.amount)}</span>
                </div>
              ))}
            </div>
          </div>
        </div>

        <div className="panelCard">
          <div className="panelTitle">Top Agents</div>
          <div className="bars">
            {report.byAgent.slice(0, 3).map((a) => {
              const pct = maxAgent > 0 ? (a.amount / maxAgent) * 100 : 0
              return (
                <div key={a.agent} className="barRow">
                  <div className="barHead">
                    <div className="barLabel">{a.agent}</div>
                    <div className="barValue">{formatMoney(a.amount)}</div>
                  </div>
                  <div className="barTrack">
                    <div className="barFill" style={{ width: `${pct}%` }} />
                  </div>
                </div>
              )
            })}
          </div>
        </div>

        <div className="panelCard panelWide">
          <div className="panelTitle">Daily Trend</div>
          <svg className="spark" viewBox={`0 0 ${lineW} ${lineH}`} role="img" aria-label="Daily sales trend line chart">
            <polyline
              fill="none"
              stroke="rgba(16, 24, 40, 0.18)"
              strokeWidth="2"
              points={`${pad},${lineH - pad} ${lineW - pad},${lineH - pad}`}
            />
            <polyline
              fill="none"
              stroke="var(--chart-open)"
              strokeWidth="3"
              strokeLinejoin="round"
              strokeLinecap="round"
              points={pts.join(' ')}
            />
          </svg>
          <div className="sparkMeta">
            <div>Min: {formatMoney(minDate)}</div>
            <div>Max: {formatMoney(maxDate)}</div>
          </div>
        </div>

        <div className="panelCard panelWide">
          <div className="panelTitle">Latest Invoices</div>
          <div className="latest">
            {report.latest.map((r) => (
              <div key={r.docNum} className="latestRow">
                <div className="latestMain">
                  <div className="latestDoc">{r.docNum}</div>
                  <div className="latestSub">{r.docDate} • {r.customer}</div>
                </div>
                <div className="latestRight">
                  <div className="badge" data-status={r.status}>
                    {r.status}
                  </div>
                  <div className="latestAmt">{formatMoney(r.total)}</div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}

function ArReportCard({ report }: { report: ArReportData }) {
  const donut = donutSegments([
    { value: report.currentAmount, color: 'var(--chart-open)' },
    { value: report.overdueAmount, color: 'var(--chart-overdue)' },
  ])

  const maxCustomer = Math.max(0, ...report.byCustomer.map((c) => c.amount))

  return (
    <div className="reportCard">
      <div className="reportTop">
        <div className="reportTitle">{report.title}</div>
        <div className="reportMeta">
          {report.periodStart && report.periodEnd
            ? `${report.periodStart} → ${report.periodEnd}`
            : 'Demo period'}
        </div>
      </div>

      <div className="kpis">
        <div className="kpi">
          <div className="kpiLabel">Outstanding</div>
          <div className="kpiValue">{formatMoney(report.outstandingAmount)}</div>
          <div className="kpiSub">{report.currency}</div>
        </div>
        <div className="kpi">
          <div className="kpiLabel">Open / Overdue</div>
          <div className="kpiValue">
            {report.openInvoices} / {report.overdueInvoices}
          </div>
          <div className="kpiSub">Invoices</div>
        </div>
      </div>

      <div className="reportGrid">
        <div className="panelCard">
          <div className="panelTitle">Current vs Overdue</div>
          <div className="donutRow">
            <svg className="donut" viewBox="0 0 120 120" role="img" aria-label="Accounts receivable donut chart">
              <g transform="rotate(-90 60 60)">
                <circle cx="60" cy="60" r="42" fill="none" stroke="rgba(16, 24, 40, 0.08)" strokeWidth="14" />
                {donut.map((s, idx) => (
                  <circle
                    key={idx}
                    cx="60"
                    cy="60"
                    r="42"
                    fill="none"
                    stroke={s.color}
                    strokeWidth="14"
                    strokeDasharray={`${s.dash} ${9999}`}
                    strokeDashoffset={-s.offset}
                    strokeLinecap="butt"
                  />
                ))}
              </g>
            </svg>
            <div className="legend">
              <div className="legendRow">
                <span className="dot" style={{ background: 'var(--chart-open)' }} />
                <span className="legendLabel">Current</span>
                <span className="legendValue">{formatMoney(report.currentAmount)}</span>
              </div>
              <div className="legendRow">
                <span className="dot" style={{ background: 'var(--chart-overdue)' }} />
                <span className="legendLabel">Overdue</span>
                <span className="legendValue">{formatMoney(report.overdueAmount)}</span>
              </div>
            </div>
          </div>
        </div>

        <div className="panelCard">
          <div className="panelTitle">Top Customers</div>
          <div className="bars">
            {report.byCustomer.map((c) => {
              const pct = maxCustomer > 0 ? (c.amount / maxCustomer) * 100 : 0
              return (
                <div key={c.customer} className="barRow">
                  <div className="barHead">
                    <div className="barLabel">{c.customer}</div>
                    <div className="barValue">{formatMoney(c.amount)}</div>
                  </div>
                  <div className="barTrack">
                    <div className="barFill" style={{ width: `${pct}%` }} />
                  </div>
                </div>
              )
            })}
          </div>
        </div>

        <div className="panelCard panelWide">
          <div className="panelTitle">Latest Outstanding</div>
          <div className="latest">
            {report.latest.map((r) => (
              <div key={r.docNum} className="latestRow">
                <div className="latestMain">
                  <div className="latestDoc">{r.docNum}</div>
                  <div className="latestSub">{r.docDate} • {r.customer}</div>
                </div>
                <div className="latestRight">
                  <div className="badge" data-status={r.status}>
                    {r.status}
                  </div>
                  <div className="latestAmt">{formatMoney(r.total)}</div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}

type MenuState = 'root' | 'report' | null

function rootMenuMessage(): ChatMessage {
  return {
    type: 'menu',
    role: 'assistant',
    title: 'What would you like to do?',
    subtitle: 'Choose a demo action to continue.',
    options: [
      { id: 'txn', label: 'Create a Transaction', sendText: 'transaction' },
      { id: 'rep', label: 'Generate a Report', sendText: 'report' },
    ],
  }
}

function reportMenuMessage(): ChatMessage {
  return {
    type: 'menu',
    role: 'assistant',
    title: 'Which report do you want?',
    subtitle: 'Demo reports available.',
    options: [
      { id: 'sales', label: 'Sales Report (Invoices)', sendText: 'sales report' },
      { id: 'ar', label: 'Accounts Receivable', sendText: 'accounts receivable' },
      { id: 'back', label: 'Back', sendText: 'back' },
    ],
  }
}

function App() {
  const [messages, setMessages] = useState<ChatMessage[]>([
    rootMenuMessage(),
  ])
  const [input, setInput] = useState('')
  const [busy, setBusy] = useState(false)
  const [sapModalOpen, setSapModalOpen] = useState(false)
  const [journalFlow, setJournalFlow] = useState<JournalFlowState | null>(null)
  const [menuState, setMenuState] = useState<MenuState>('root')

  const [sap, setSap] = useState<SapConfig>({
    dbType: 'sql',
    demoMode: false,
    baseUrl: '',
    companyDb: '',
    userName: '',
    password: '',
  })

  const scrollerRef = useRef<HTMLDivElement | null>(null)
  const [salesReportFlow, setSalesReportFlow] =
    useState<SalesReportFlowState | null>(null)
  const [arReportFlow, setArReportFlow] = useState<ArReportFlowState | null>(
    null,
  )

  useEffect(() => {
    try {
      const raw = localStorage.getItem('sapConfig')
      if (!raw) {
        setSapModalOpen(true)
        return
      }
      const parsed = JSON.parse(raw) as Partial<SapConfig>
      const next: SapConfig = {
        dbType: parsed.dbType === 'hana' ? 'hana' : 'sql',
        demoMode: Boolean(parsed.demoMode),
        baseUrl: parsed.baseUrl ?? '',
        companyDb: parsed.companyDb ?? '',
        userName: parsed.userName ?? '',
        password: parsed.password ?? '',
      }
      setSap(next)
      const ready = Boolean(
        next.demoMode ||
          (next.baseUrl && next.companyDb && next.userName && next.password),
      )
      setSapModalOpen(!ready)
    } catch {
      setSapModalOpen(true)
    }
  }, [])

  useEffect(() => {
    try {
      localStorage.setItem('sapConfig', JSON.stringify(sap))
    } catch {
      return
    }
  }, [sap])

  useEffect(() => {
    scrollerRef.current?.scrollTo({
      top: scrollerRef.current.scrollHeight,
      behavior: 'smooth',
    })
  }, [messages.length, busy])

  const systemPrompt = useMemo(
    () =>
      [
        'You help the user create SAP Business One Journal Entries.',
        'Be concise. If the user wants to create a journal entry, ask only the minimum required fields.',
        'Do not ask for passwords or API keys.',
      ].join('\n'),
    [],
  )

  const sapReady = Boolean(
    sap.demoMode || (sap.baseUrl && sap.companyDb && sap.userName && sap.password),
  )

  async function send(text: string) {
    const trimmed = text.trim()
    if (!trimmed || busy || sapModalOpen) return

    setMessages((m) => [...m, { type: 'text', role: 'user', content: trimmed }])
    setInput('')

    const lower = trimmed.toLowerCase()

    const inFlow = Boolean(
      salesReportFlow?.active || arReportFlow?.active || journalFlow?.active,
    )

    if (!inFlow && (menuState === null || menuState === 'root')) {
      if (lower === 'transaction' || lower === '1' || lower.includes('transaction')) {
        setMenuState(null)
        const flow = createJournalFlowState()
        setJournalFlow(flow)
        setMessages((m) => [
          ...m,
          { type: 'text', role: 'assistant', content: 'Starting a new journal entry.' },
          { type: 'text', role: 'assistant', content: journalFlowFirstPrompt() },
        ])
        return
      }
      if (lower === 'report' || lower === '2' || lower.includes('report')) {
        setMenuState('report')
        setMessages((m) => [...m, reportMenuMessage()])
        return
      }
    }

    if (!inFlow && menuState === 'report') {
      if (lower === 'back') {
        setMenuState('root')
        setMessages((m) => [...m, rootMenuMessage()])
        return
      }
      if (isSalesReportIntent(trimmed)) {
        setMenuState(null)
        const agents = uniqueSalesAgents(demoInvoices)
        setSalesReportFlow({ active: true, step: 'agent' })
        setMessages((m) => [
          ...m,
          {
            type: 'text',
            role: 'assistant',
            content: `Which sales agent? Type one of: ${agents.join(', ')}, or "all".`,
          },
        ])
        return
      }
      if (isArIntent(trimmed)) {
        setMenuState(null)
        const agents = uniqueSalesAgents(demoInvoices)
        setArReportFlow({ active: true, step: 'agent' })
        setMessages((m) => [
          ...m,
          {
            type: 'text',
            role: 'assistant',
            content: `Accounts Receivable for which sales agent? Type one of: ${agents.join(', ')}, or "all".`,
          },
        ])
        return
      }
    }

    if (salesReportFlow?.active) {
      if (lower === 'cancel' || lower === 'stop') {
        setSalesReportFlow(null)
        setMessages((m) => [
          ...m,
          { type: 'text', role: 'assistant', content: 'Cancelled.' },
        ])
        return
      }

      const agents = uniqueSalesAgents(demoInvoices)
      const isAll = lower === 'all'
      const selected =
        isAll ? 'all' : agents.find((a) => a.toLowerCase() === lower)
      if (!selected) {
        setMessages((m) => [
          ...m,
          {
            type: 'text',
            role: 'assistant',
            content: `Unknown sales agent. Type one of: ${agents.join(', ')}, or "all".`,
          },
        ])
        return
      }

      setSalesReportFlow(null)
      setMessages((m) => [
        ...m,
        { type: 'sales_report', role: 'assistant', report: buildSalesReportData(selected) },
      ])
      return
    }

    if (arReportFlow?.active) {
      if (lower === 'cancel' || lower === 'stop') {
        setArReportFlow(null)
        setMessages((m) => [
          ...m,
          { type: 'text', role: 'assistant', content: 'Cancelled.' },
        ])
        return
      }

      const agents = uniqueSalesAgents(demoInvoices)
      const isAll = lower === 'all'
      const selected =
        isAll ? 'all' : agents.find((a) => a.toLowerCase() === lower)
      if (!selected) {
        setMessages((m) => [
          ...m,
          {
            type: 'text',
            role: 'assistant',
            content: `Unknown sales agent. Type one of: ${agents.join(', ')}, or "all".`,
          },
        ])
        return
      }

      setArReportFlow(null)
      setMessages((m) => [
        ...m,
        { type: 'ar_report', role: 'assistant', report: buildArReportData(selected) },
      ])
      return
    }

    if (journalFlow?.active) {
      const result = handleJournalFlowInput(journalFlow, trimmed)
      if (result.kind === 'reply') {
        setJournalFlow(result.state)
        setMessages((m) => [
          ...m,
          ...result.messages.map((content) => ({
            type: 'text' as const,
            role: 'assistant' as const,
            content,
          })),
        ])
        return
      }

      if (result.kind === 'cancelled') {
        setJournalFlow(null)
        setMessages((m) => [
          ...m,
          ...result.messages.map((content) => ({
            type: 'text' as const,
            role: 'assistant' as const,
            content,
          })),
        ])
        return
      }

      if (result.kind === 'post') {
        if (!sapReady) {
          setJournalFlow(null)
          setMessages((m) => [
            ...m,
            {
              type: 'text',
              role: 'assistant',
              content:
                'SAP connection is not configured. Please enter your SAP B1 Service Layer details to continue.',
            },
          ])
          setSapModalOpen(true)
          return
        }

        if (sap.demoMode) {
          const posted = {
            JdtNum: Math.floor(1000000 + Math.random() * 9000000),
            Number: Math.floor(100000000 + Math.random() * 900000000),
            ReferenceDate: result.payload.referenceDate,
            Memo: result.payload.memo,
            JournalEntryLines: result.payload.lines.map((l, idx) => ({
              Line_ID: idx,
              AccountCode: l.accountCode,
              Debit: l.debit ?? 0,
              Credit: l.credit ?? 0,
            })),
            Demo: true,
          }
          setMessages((m) => [
            ...m,
            {
              type: 'text',
              role: 'assistant',
              content: `Demo mode: journal entry created.\n\n${JSON.stringify(posted, null, 2)}`,
            },
          ])
          setJournalFlow(null)
          return
        }

        setBusy(true)
        try {
          const posted = await postJournalEntry(sap, result.payload)
          setMessages((m) => [
            ...m,
            {
              type: 'text',
              role: 'assistant',
              content: `Posted to SAP.\n\n${JSON.stringify(posted, null, 2)}`,
            },
          ])
        } catch (e) {
          setMessages((m) => [
            ...m,
            {
              type: 'text',
              role: 'assistant',
              content: e instanceof Error ? e.message : 'Failed to post to SAP.',
            },
          ])
        } finally {
          setBusy(false)
          setJournalFlow(null)
        }
        return
      }
    }

    if (isStartJournalEntryIntent(trimmed)) {
      const flow = createJournalFlowState()
      setJournalFlow(flow)
      setMessages((m) => [
        ...m,
        { type: 'text', role: 'assistant', content: journalFlowFirstPrompt() },
      ])
      return
    }

    if (isSalesReportIntent(trimmed)) {
      const agents = uniqueSalesAgents(demoInvoices)
      setSalesReportFlow({ active: true, step: 'agent' })
      setMessages((m) => [
        ...m,
        {
          type: 'text',
          role: 'assistant',
          content: `Which sales agent? Type one of: ${agents.join(', ')}, or "all".`,
        },
      ])
      return
    }

    if (isArIntent(trimmed)) {
      const agents = uniqueSalesAgents(demoInvoices)
      setArReportFlow({ active: true, step: 'agent' })
      setMessages((m) => [
        ...m,
        {
          type: 'text',
          role: 'assistant',
          content: `Accounts Receivable for which sales agent? Type one of: ${agents.join(', ')}, or "all".`,
        },
      ])
      return
    }

    if (sap.demoMode) {
      setMessages((m) => [
        ...m,
        { type: 'text', role: 'assistant', content: demoAssistantReply(trimmed) },
        rootMenuMessage(),
      ])
      setMenuState('root')
      return
    }

    setBusy(true)
    try {
      const recentText = messages.filter((m): m is ChatMessageText => m.type === 'text').slice(-12)
      const history: ChatMessageText[] = [
        { type: 'text', role: 'system', content: systemPrompt },
        ...recentText,
        { type: 'text', role: 'user', content: trimmed },
      ]
      const reply = await aiChat(history)
      setMessages((m) => [...m, { type: 'text', role: 'assistant', content: reply }])
    } catch (e) {
      setMessages((m) => [
        ...m,
        {
          type: 'text',
          role: 'assistant',
          content: e instanceof Error ? e.message : 'AI request failed.',
        },
      ])
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="page">
      {sapModalOpen ? (
        <div className="modalBackdrop" role="presentation">
          <div className="modal" role="dialog" aria-modal="true">
            <div className="modalHeader">
              <div className="modalTitle">Connect to SAP Business One</div>
              <div className="modalSubtitle">Service Layer credentials</div>
            </div>
            <div className="modalBody">
              <div className="formGrid">
                <div className="field">
                  <div className="fieldLabel">Mode</div>
                  <div className="segmented" role="group" aria-label="Mode">
                    <button
                      className={
                        sap.demoMode ? 'segBtn segBtnActive' : 'segBtn'
                      }
                      type="button"
                      onClick={() =>
                        setSap((s) => ({
                          ...s,
                          demoMode: true,
                        }))
                      }
                    >
                      Demo
                    </button>
                    <button
                      className={
                        !sap.demoMode ? 'segBtn segBtnActive' : 'segBtn'
                      }
                      type="button"
                      onClick={() =>
                        setSap((s) => ({
                          ...s,
                          demoMode: false,
                        }))
                      }
                    >
                      Live
                    </button>
                  </div>
                </div>
                <div className="field">
                  <div className="fieldLabel">Database Type</div>
                  <div className="segmented" role="group" aria-label="Database Type">
                    <button
                      className={sap.dbType === 'sql' ? 'segBtn segBtnActive' : 'segBtn'}
                      type="button"
                      onClick={() => setSap((s) => ({ ...s, dbType: 'sql' }))}
                    >
                      SQL
                    </button>
                    <button
                      className={sap.dbType === 'hana' ? 'segBtn segBtnActive' : 'segBtn'}
                      type="button"
                      onClick={() => setSap((s) => ({ ...s, dbType: 'hana' }))}
                    >
                      HANA
                    </button>
                  </div>
                </div>
                {!sap.demoMode ? (
                  <>
                    <label className="field">
                      <div className="fieldLabel">Base URL</div>
                      <input
                        value={sap.baseUrl}
                        onChange={(e) =>
                          setSap((s) => ({ ...s, baseUrl: e.target.value }))
                        }
                        placeholder="https://sap-server:50000"
                        inputMode="url"
                        autoCapitalize="none"
                      />
                    </label>
                    <label className="field">
                      <div className="fieldLabel">Company DB</div>
                      <input
                        value={sap.companyDb}
                        onChange={(e) =>
                          setSap((s) => ({ ...s, companyDb: e.target.value }))
                        }
                        placeholder="SBODEMOUS"
                        autoCapitalize="none"
                      />
                    </label>
                    <label className="field">
                      <div className="fieldLabel">Username</div>
                      <input
                        value={sap.userName}
                        onChange={(e) =>
                          setSap((s) => ({ ...s, userName: e.target.value }))
                        }
                        autoCapitalize="none"
                      />
                    </label>
                    <label className="field">
                      <div className="fieldLabel">Password</div>
                      <input
                        value={sap.password}
                        onChange={(e) =>
                          setSap((s) => ({ ...s, password: e.target.value }))
                        }
                        type="password"
                      />
                    </label>
                  </>
                ) : null}
              </div>
            </div>
            <div className="modalFooter">
              <button
                className="btnPrimary"
                type="button"
                onClick={() => setSapModalOpen(false)}
                disabled={!sapReady}
              >
                Save & Continue
              </button>
            </div>
          </div>
        </div>
      ) : null}

      <div className="shell">
        <header className="header">
          <div className="headerLeft">
            <div className="logoMark" aria-hidden="true">
              S
            </div>
            <div className="headerText">
              <div className="brand">Sepa AI Assistant</div>
              <div className="subBrand">SAP Business One Journal Entries</div>
            </div>
          </div>
          <button
            className="iconBtn"
            type="button"
            onClick={() => setSapModalOpen(true)}
            aria-label="SAP settings"
            disabled={busy}
          >
            <svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true">
              <path
                fill="currentColor"
                d="M19.14 12.94c.04-.31.06-.63.06-.94s-.02-.63-.06-.94l2.03-1.58a.5.5 0 0 0 .12-.64l-1.92-3.32a.5.5 0 0 0-.6-.22l-2.39.96a7.26 7.26 0 0 0-1.63-.94l-.36-2.54a.5.5 0 0 0-.5-.42h-3.84a.5.5 0 0 0-.5.42l-.36 2.54c-.58.23-1.12.54-1.63.94l-2.39-.96a.5.5 0 0 0-.6.22L2.71 7.84a.5.5 0 0 0 .12.64l2.03 1.58c-.04.31-.06.63-.06.94s.02.63.06.94l-2.03 1.58a.5.5 0 0 0-.12.64l1.92 3.32c.13.22.39.3.6.22l2.39-.96c.5.4 1.05.71 1.63.94l.36 2.54c.04.24.25.42.5.42h3.84c.25 0 .46-.18.5-.42l.36-2.54c.58-.23 1.12-.54 1.63-.94l2.39.96c.21.08.47 0 .6-.22l1.92-3.32a.5.5 0 0 0-.12-.64l-2.03-1.58ZM12 15.5A3.5 3.5 0 1 1 12 8a3.5 3.5 0 0 1 0 7.5Z"
              />
            </svg>
          </button>
        </header>

        <main className="chat" ref={scrollerRef}>
          {messages.map((m, idx) => (
            <div
              key={idx}
              className={`msg ${m.role === 'user' ? 'msgUser' : 'msgAssistant'}`}
            >
              {m.type === 'text' ? (
                <div className="bubble">{m.content}</div>
              ) : m.type === 'menu' ? (
                <div className="bubble bubbleMenu">
                  <div className="menuTitle">{m.title}</div>
                  {m.subtitle ? (
                    <div className="menuSubtitle">{m.subtitle}</div>
                  ) : null}
                  <div className="menuGrid">
                    {m.options.map((o) => (
                      <button
                        key={o.id}
                        type="button"
                        className="menuBtn"
                        onClick={() => void send(o.sendText)}
                        disabled={busy || sapModalOpen}
                      >
                        {o.label}
                      </button>
                    ))}
                  </div>
                </div>
              ) : m.type === 'sales_report' ? (
                <div className="bubble bubbleReport">
                  <SalesReportCard report={m.report} />
                </div>
              ) : (
                <div className="bubble bubbleReport">
                  <ArReportCard report={m.report} />
                </div>
              )}
            </div>
          ))}
          {busy ? (
            <div className="msg msgAssistant">
              <div className="bubble typing">Working…</div>
            </div>
          ) : null}
        </main>

        <form
          className="composer"
          onSubmit={(e) => {
            e.preventDefault()
            void send(input)
          }}
        >
          <input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder='Message… (try "transaction" or "report")'
            disabled={busy || sapModalOpen}
          />
          <button
            className="sendBtn"
            type="submit"
            disabled={busy || sapModalOpen || !input.trim()}
            aria-label="Send"
          >
            Send
          </button>
        </form>
      </div>
    </div>
  )
}

export default App

import type { JournalEntryDraft, JournalEntryLineDraft } from './types'

export type JournalFlowStep = 'date' | 'memo' | 'lines' | 'confirm'

export type JournalFlowState = {
  active: boolean
  step: JournalFlowStep
  draft: JournalEntryDraft
}

export function createJournalFlowState(): JournalFlowState {
  return {
    active: true,
    step: 'date',
    draft: { lines: [] },
  }
}

export function isStartJournalEntryIntent(text: string): boolean {
  const t = text.trim().toLowerCase()
  return (
    t === 'new journal entry' ||
    t === 'create journal entry' ||
    t === 'create new journal entry' ||
    t.includes('new journal entry') ||
    t.includes('create journal entry')
  )
}

export function journalFlowFirstPrompt(): string {
  return 'Posting date? (YYYY-MM-DD, or say "today")'
}

export type JournalFlowResult =
  | { kind: 'reply'; state: JournalFlowState; messages: string[] }
  | {
      kind: 'post'
      state: JournalFlowState
      payload: {
        referenceDate: string
        memo: string
        dueDate?: string
        taxDate?: string
        lines: JournalEntryLineDraft[]
      }
    }
  | { kind: 'cancelled'; state: JournalFlowState; messages: string[] }

function toIsoDate(d: Date): string {
  const yyyy = d.getFullYear()
  const mm = String(d.getMonth() + 1).padStart(2, '0')
  const dd = String(d.getDate()).padStart(2, '0')
  return `${yyyy}-${mm}-${dd}`
}

function parseDateInput(input: string): string | null {
  const raw = input.trim()
  if (!raw) return null
  const lower = raw.toLowerCase()
  if (lower === 'today') return toIsoDate(new Date())
  if (/^\d{4}-\d{2}-\d{2}$/.test(raw)) return raw
  const d = new Date(raw)
  if (Number.isNaN(d.getTime())) return null
  return toIsoDate(d)
}

function parseLineInput(input: string): JournalEntryLineDraft | null {
  const t = input.trim()
  const lower = t.toLowerCase()

  const amountMatch = lower.match(/(-?\d+(?:\.\d+)?)/g)
  const amount = amountMatch ? Number(amountMatch[amountMatch.length - 1]) : NaN
  if (!Number.isFinite(amount) || amount <= 0) return null

  const accountMatch = t.match(/[A-Za-z0-9]{3,}/)
  if (!accountMatch) return null
  const accountCode = accountMatch[0]

  const isDebit = /\b(dr|debit)\b/.test(lower)
  const isCredit = /\b(cr|credit)\b/.test(lower)

  if (isDebit && !isCredit) return { accountCode, debit: amount }
  if (isCredit && !isDebit) return { accountCode, credit: amount }

  const parts = lower.split(/\s+/).filter(Boolean)
  const debitIdx = parts.findIndex((p) => p === 'debit' || p === 'dr')
  const creditIdx = parts.findIndex((p) => p === 'credit' || p === 'cr')
  if (debitIdx !== -1 && creditIdx === -1) return { accountCode, debit: amount }
  if (creditIdx !== -1 && debitIdx === -1) return { accountCode, credit: amount }

  return null
}

function totals(lines: JournalEntryLineDraft[]): { debit: number; credit: number } {
  return lines.reduce(
    (acc, l) => ({
      debit: acc.debit + (l.debit ?? 0),
      credit: acc.credit + (l.credit ?? 0),
    }),
    { debit: 0, credit: 0 },
  )
}

function isBalanced(lines: JournalEntryLineDraft[]): boolean {
  const { debit, credit } = totals(lines)
  return Math.abs(debit - credit) < 0.005 && debit > 0
}

function formatDraft(draft: JournalEntryDraft): string {
  const date = draft.referenceDate ?? '—'
  const memo = draft.memo ?? '—'
  const { debit, credit } = totals(draft.lines)

  const linesText =
    draft.lines.length === 0
      ? 'No lines yet.'
      : draft.lines
          .map((l, idx) => {
            const side = l.debit ? `Debit ${l.debit}` : `Credit ${l.credit}`
            return `${idx + 1}. ${l.accountCode}: ${side}`
          })
          .join('\n')

  return `Date: ${date}\nMemo: ${memo}\n\nLines:\n${linesText}\n\nTotals: Debit ${debit} / Credit ${credit}`
}

export function handleJournalFlowInput(
  state: JournalFlowState,
  input: string,
): JournalFlowResult {
  const trimmed = input.trim()
  const lower = trimmed.toLowerCase()

  if (lower === 'cancel' || lower === 'stop') {
    return {
      kind: 'cancelled',
      state: { ...state, active: false },
      messages: ['Cancelled.'],
    }
  }

  if (state.step === 'date') {
    const date = parseDateInput(trimmed)
    if (!date) {
      return { kind: 'reply', state, messages: ['Please enter a date like 2026-04-09, or say "today".'] }
    }
    const next: JournalFlowState = {
      ...state,
      step: 'memo',
      draft: { ...state.draft, referenceDate: date },
    }
    return { kind: 'reply', state: next, messages: ['Memo/description for this journal entry?'] }
  }

  if (state.step === 'memo') {
    if (!trimmed) {
      return { kind: 'reply', state, messages: ['Please provide a memo/description.'] }
    }
    const next: JournalFlowState = {
      ...state,
      step: 'lines',
      draft: { ...state.draft, memo: trimmed },
    }
    return {
      kind: 'reply',
      state: next,
      messages: [
        'Add a line (examples: "debit 121101 27" or "credit 410001 25"). Type "done" when finished.',
      ],
    }
  }

  if (state.step === 'lines') {
    if (lower === 'done' || lower === 'finish') {
      if (state.draft.lines.length < 2) {
        return { kind: 'reply', state, messages: ['Need at least 2 lines. Add another line.'] }
      }
      if (!isBalanced(state.draft.lines)) {
        const { debit, credit } = totals(state.draft.lines)
        const diff = Math.abs(debit - credit)
        const side = debit > credit ? 'credit' : 'debit'
        return {
          kind: 'reply',
          state,
          messages: [
            `Not balanced yet. Add a ${side} line for ${diff}.`,
            formatDraft(state.draft),
          ],
        }
      }

      const next: JournalFlowState = { ...state, step: 'confirm' }
      return {
        kind: 'reply',
        state: next,
        messages: ['Ready to post. Type "post" to create it in SAP, or "cancel".', formatDraft(state.draft)],
      }
    }

    const line = parseLineInput(trimmed)
    if (!line) {
      return {
        kind: 'reply',
        state,
        messages: ['Could not parse that line. Use: "debit <AccountCode> <Amount>" or "credit <AccountCode> <Amount>".'],
      }
    }

    const nextDraft: JournalEntryDraft = { ...state.draft, lines: [...state.draft.lines, line] }
    const nextState: JournalFlowState = { ...state, draft: nextDraft }
    const { debit, credit } = totals(nextDraft.lines)
    return {
      kind: 'reply',
      state: nextState,
      messages: [`Line added. Totals: Debit ${debit} / Credit ${credit}. Add another line or type "done".`],
    }
  }

  if (state.step === 'confirm') {
    if (lower === 'post' || lower === 'yes') {
      const referenceDate = state.draft.referenceDate
      const memo = state.draft.memo
      if (!referenceDate || !memo) {
        return { kind: 'reply', state, messages: ['Missing date or memo. Type "cancel" and start again.'] }
      }
      if (!isBalanced(state.draft.lines)) {
        return { kind: 'reply', state: { ...state, step: 'lines' }, messages: ['Lines are no longer balanced. Add/fix lines.'] }
      }
      return {
        kind: 'post',
        state: { ...state, active: false },
        payload: {
          referenceDate,
          memo,
          dueDate: state.draft.dueDate,
          taxDate: state.draft.taxDate,
          lines: state.draft.lines,
        },
      }
    }

    return { kind: 'reply', state, messages: ['Type "post" to create it in SAP, or "cancel".'] }
  }

  return { kind: 'reply', state, messages: ['Unexpected state. Type "cancel" and start again.'] }
}


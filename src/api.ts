import type { ChatMessageText, JournalEntryDraft, SapConfig } from './types'

export async function aiChat(messages: ChatMessageText[]): Promise<string> {
  const resp = await fetch('/api/ai/chat', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      messages: messages.map((m) => ({ role: m.role, content: m.content })),
    }),
  })

  const text = await resp.text()
  if (!resp.ok) {
    throw new Error(text || `AI error (${resp.status})`)
  }

  const data = JSON.parse(text) as { content?: unknown }
  if (typeof data.content !== 'string') {
    throw new Error('AI response missing content')
  }

  return data.content
}

export async function postJournalEntry(
  sap: SapConfig,
  journalEntry: Required<Pick<JournalEntryDraft, 'referenceDate' | 'memo'>> &
    Partial<Pick<JournalEntryDraft, 'dueDate' | 'taxDate'>> & {
      lines: { accountCode: string; debit?: number; credit?: number }[]
    },
): Promise<unknown> {
  const resp = await fetch('/api/sap/journal-entries', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ sap, journalEntry }),
  })

  const text = await resp.text()
  if (!resp.ok) {
    throw new Error(text || `SAP error (${resp.status})`)
  }

  try {
    return JSON.parse(text)
  } catch {
    return text
  }
}

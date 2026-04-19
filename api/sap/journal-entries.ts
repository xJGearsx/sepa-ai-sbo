import { z } from 'zod'

type Req = {
  method?: string
  body?: unknown
}

type Res = {
  status: (code: number) => Res
  json: (body: unknown) => void
  type: (mime: string) => Res
  send: (body: unknown) => void
}

const sapConfigSchema = z.object({
  baseUrl: z.string().min(1),
  companyDb: z.string().min(1),
  userName: z.string().min(1),
  password: z.string().min(1),
})

const journalEntryLineSchema = z.object({
  accountCode: z.string().min(1),
  debit: z.number().optional(),
  credit: z.number().optional(),
  lineMemo: z.string().optional(),
})

const journalEntrySchema = z.object({
  referenceDate: z.string().min(1),
  memo: z.string().min(1),
  dueDate: z.string().optional(),
  taxDate: z.string().optional(),
  lines: z.array(journalEntryLineSchema).min(2),
})

const createJournalEntrySchema = z.object({
  sap: sapConfigSchema,
  journalEntry: journalEntrySchema,
})

function getSetCookieHeaders(headers: Headers): string[] {
  const anyHeaders = headers as unknown as { getSetCookie?: () => string[] }
  if (typeof anyHeaders.getSetCookie === 'function') return anyHeaders.getSetCookie()
  const single = headers.get('set-cookie')
  return single ? [single] : []
}

function cookieHeaderFromSetCookie(setCookies: string[]): string {
  return setCookies
    .map((c) => c.split(';')[0])
    .filter(Boolean)
    .join('; ')
}

async function sapLogin(sap: z.infer<typeof sapConfigSchema>): Promise<string> {
  const loginUrl = new URL('/b1s/v1/Login', sap.baseUrl).toString()
  const resp = await fetch(loginUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      CompanyDB: sap.companyDb,
      UserName: sap.userName,
      Password: sap.password,
    }),
  })

  if (!resp.ok) {
    throw new Error(await resp.text())
  }

  const setCookies = getSetCookieHeaders(resp.headers)
  const cookie = cookieHeaderFromSetCookie(setCookies)
  if (!cookie) {
    throw new Error('Missing SAP session cookie')
  }

  return cookie
}

export default async function handler(req: Req, res: Res) {
  if (req.method !== 'POST') {
    res.status(405).json({ error: 'Method Not Allowed' })
    return
  }

  const parsed = createJournalEntrySchema.safeParse(req.body)
  if (!parsed.success) {
    res.status(400).json({ error: 'Invalid request body' })
    return
  }

  try {
    const { sap, journalEntry } = parsed.data
    const cookie = await sapLogin(sap)

    const dueDate = journalEntry.dueDate ?? journalEntry.referenceDate
    const taxDate = journalEntry.taxDate ?? journalEntry.referenceDate

    const payload = {
      ReferenceDate: journalEntry.referenceDate,
      DueDate: dueDate,
      TaxDate: taxDate,
      Memo: journalEntry.memo,
      JournalEntryLines: journalEntry.lines.map((l) => ({
        AccountCode: l.accountCode,
        Debit: l.debit ?? 0,
        Credit: l.credit ?? 0,
        LineMemo: l.lineMemo ?? journalEntry.memo,
      })),
    }

    const createUrl = new URL('/b1s/v1/JournalEntries', sap.baseUrl).toString()
    const resp = await fetch(createUrl, {
      method: 'POST',
      headers: {
        Cookie: cookie,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload),
    })

    const text = await resp.text()
    if (!resp.ok) {
      res.status(resp.status).json({ error: text })
      return
    }

    res.status(201).type('application/json').send(text)
  } catch (e) {
    res.status(502).json({ error: e instanceof Error ? e.message : 'SAP error' })
  }
}

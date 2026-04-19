import { z } from 'zod'

type Req = {
  method?: string
  body?: unknown
}

type Res = {
  status: (code: number) => Res
  json: (body: unknown) => void
}

const chatSchema = z.object({
  messages: z.array(
    z.object({
      role: z.enum(['system', 'user', 'assistant']),
      content: z.string(),
    }),
  ),
})

export default async function handler(req: Req, res: Res) {
  if (req.method !== 'POST') {
    res.status(405).json({ error: 'Method Not Allowed' })
    return
  }

  const parsed = chatSchema.safeParse(req.body)
  if (!parsed.success) {
    res.status(400).json({ error: 'Invalid request body' })
    return
  }

  const token = process.env.POLLINATIONS_API_KEY
  if (!token) {
    res.status(500).json({ error: 'Missing POLLINATIONS_API_KEY' })
    return
  }

  const upstream = await fetch(
    'https://enter.pollinations.ai/api/generate/v1/chat/completions',
    {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'openai',
        messages: parsed.data.messages,
      }),
    },
  )

  if (!upstream.ok) {
    res.status(502).json({ error: await upstream.text() })
    return
  }

  const data = await upstream.json()
  const content = data?.choices?.[0]?.message?.content

  if (typeof content !== 'string') {
    res.status(502).json({ error: 'Unexpected AI response shape' })
    return
  }

  res.status(200).json({ content })
}

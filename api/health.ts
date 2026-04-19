type Res = {
  status: (code: number) => Res
  json: (body: unknown) => void
}

export default async function handler(_req: unknown, res: Res) {
  res.status(200).json({ ok: true })
}

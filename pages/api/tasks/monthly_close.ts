import { NextApiRequest, NextApiResponse } from 'next'
import { createClient } from '@supabase/supabase-js'

const SUPABASE_URL = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL || ''
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || ''
const TASK_SECRET = process.env.TASK_SECRET || ''

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY)

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') return res.status(405).end()
  const secret = (req.headers['x-task-secret'] as string) || (req.query.secret as string)
  if (!secret || secret !== TASK_SECRET) return res.status(401).json({ error: 'Unauthorized' })

  // compute previous month
  const d = new Date()
  d.setDate(1)
  d.setHours(0, 0, 0, 0)
  d.setMonth(d.getMonth() - 1)
  const year = d.getFullYear()
  const month = d.getMonth() + 1

  // call RPC to populate monthly_summary
  const { data, error } = await supabase.rpc('populate_monthly_summary', { year_in: year, month_in: month })
  if (error) {
    await supabase.from('audit_logs').insert({ action: 'monthly_close_failed', payload: { error: error.message, year, month } })
    return res.status(500).json({ error: error.message })
  }

  await supabase.from('audit_logs').insert({ action: 'monthly_close', payload: { year, month } })
  res.status(200).json({ ok: true, year, month })
}

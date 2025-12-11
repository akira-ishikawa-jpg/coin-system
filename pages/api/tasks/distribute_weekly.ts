import { NextApiRequest, NextApiResponse } from 'next'
import { createClient } from '@supabase/supabase-js'

const SUPABASE_URL = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL || ''
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || ''
const TASK_SECRET = process.env.TASK_SECRET || ''

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY)

function getWeekStart(date = new Date()) {
  const d = new Date(date)
  const day = d.getDay()
  const diff = (day === 0 ? -6 : 1) - day
  d.setDate(d.getDate() + diff)
  d.setHours(0,0,0,0)
  return d.toISOString().slice(0,10)
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') return res.status(405).end()
  const secret = (req.headers['x-task-secret'] as string) || (req.query.secret as string)
  if (!secret || secret !== TASK_SECRET) return res.status(401).json({ error: 'Unauthorized' })

  const weekStart = getWeekStart()

  // distribute weekly coins
  const { data, error } = await supabase.rpc('distribute_weekly_coins', { week_start_date: weekStart, weekly_amount: 250 })
  if (error) {
    await supabase.from('audit_logs').insert({ action: 'distribute_weekly_failed', payload: { error: error.message, week_start: weekStart } })
    return res.status(500).json({ error: error.message })
  }

  await supabase.from('audit_logs').insert({ action: 'distribute_weekly', payload: { week_start: weekStart, count: data } })
  res.status(200).json({ ok: true, week_start: weekStart, distributed_count: data })
}

import { NextApiRequest, NextApiResponse } from 'next'
import { createClient } from '@supabase/supabase-js'
import { detectAnomalies } from '../../../lib/anomalyDetection'

const SUPABASE_URL = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL || ''
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || ''
const SLACK_BOT_TOKEN = process.env.SLACK_BOT_TOKEN || ''

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
  // 認証: Authorization: Bearer <access_token> を必須にする
  const authHeader = (req.headers.authorization as string) || ''
  if (!authHeader.startsWith('Bearer ')) return res.status(401).json({ error: 'Unauthorized' })
  const token = authHeader.split(' ')[1]
  const { data: authData, error: authErr } = await supabase.auth.getUser(token)
  if (authErr || !authData?.user) return res.status(401).json({ error: 'Unauthorized' })

  const { receiver_id, coins, message } = req.body
  if (!receiver_id || !coins) return res.status(400).json({ error: 'missing params' })

  const senderEmail = authData.user.email
  const { data: sender } = await supabase.from('employees').select('id,name,slack_id,bonus_coins').eq('email', senderEmail).limit(1).maybeSingle()
  const { data: receiver } = await supabase.from('employees').select('id,name,slack_id').eq('id', receiver_id).limit(1).maybeSingle()
  if (!sender) return res.status(400).json({ error: 'sender not found' })
  if (!receiver) return res.status(400).json({ error: 'receiver not found' })

  const weekStart = getWeekStart()
  const { data: sentTx } = await supabase.from('coin_transactions').select('coins').eq('sender_id', sender.id).eq('week_start', weekStart)
  const sentSum = (sentTx || []).reduce((s:any,r:any)=>s+(r.coins||0),0)

  const { data: setting } = await supabase.from('settings').select('value').eq('key','default_weekly_coins').limit(1).maybeSingle()
  const defaultWeekly = setting ? parseInt(setting.value,10) : 250
  const bonusCoins = (sender as any).bonus_coins || 0
  const remaining = defaultWeekly + bonusCoins - sentSum
  if (coins > remaining) return res.status(400).json({ error: `残コイン不足: ${remaining}` })

  const insertPayload = {
    sender_id: sender.id,
    receiver_id: receiver.id,
    coins,
    message,
    emoji: '',
    week_start: weekStart,
    slack_payload: { from_web: true }
  }
  const { error } = await supabase.from('coin_transactions').insert(insertPayload)
  if (error) return res.status(500).json({ error: 'insert failed' })

  // 異常検知を実行
  await detectAnomalies(sender.id, receiver.id, coins, weekStart)

  // DM via Slack bot
  try {
    await fetch('https://slack.com/api/chat.postMessage', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json; charset=utf-8', Authorization: `Bearer ${SLACK_BOT_TOKEN}` },
      body: JSON.stringify({
        channel: receiver.slack_id,
        text: `:tada: *${sender.name}* さんから ${coins} コインの感謝が届きました！\n> ${message}`
      })
    })
  } catch (e) {
    await supabase.from('audit_logs').insert({ actor_id: sender.id, action: 'slack_dm_failed', payload: { error: String(e) } })
  }

  res.status(200).json({ ok: true })
}

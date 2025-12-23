

import { createClient } from '@supabase/supabase-js'

const SUPABASE_URL = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL || ''
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || ''
const ADMIN_EMAIL = process.env.ADMIN_EMAIL || 'admin@example.com' // Default admin email

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY)

type Anomaly = {
  type: 'large_transfer' | 'mutual_transfer' | 'spam'
  sender: string
  receiver: string
  coins: number
  week_start: string
  detail: string
}

/**
 * 大量送付検知：1週間で同一人物へ累計300コイン以上
 */
async function checkLargeTransfer(sender_id: string, receiver_id: string, coins: number, week_start: string): Promise<Anomaly | null> {
  const { data: sent } = await supabase
    .from('coin_transactions')
    .select('coins')
    .eq('sender_id', sender_id)
    .eq('receiver_id', receiver_id)
    .eq('week_start', week_start)

  const total = (sent || []).reduce((s: number, r: any) => s + (r.coins || 0), 0) + coins

  if (total > 300) {
    const { data: senderData } = await supabase.from('employees').select('name').eq('id', sender_id).limit(1).maybeSingle()
    const { data: receiverData } = await supabase.from('employees').select('name').eq('id', receiver_id).limit(1).maybeSingle()
    return {
      type: 'large_transfer',
      sender: senderData?.name || sender_id,
      receiver: receiverData?.name || receiver_id,
      coins: total,
      week_start,
      detail: `1週間で ${receiverData?.name} さんへ ${total} コイン（上限: 300）`
    }
  }
  return null
}

/**
 * 相互送付検知：AがBへ送付後、BもAへ送付（同週）
 */
async function checkMutualTransfer(sender_id: string, receiver_id: string, week_start: string): Promise<Anomaly | null> {
  const { data: reverse } = await supabase
    .from('coin_transactions')
    .select('coins')
    .eq('sender_id', receiver_id)
    .eq('receiver_id', sender_id)
    .eq('week_start', week_start)

  if ((reverse || []).length > 0) {
    const { data: senderData } = await supabase.from('employees').select('name').eq('id', sender_id).limit(1).maybeSingle()
    const { data: receiverData } = await supabase.from('employees').select('name').eq('id', receiver_id).limit(1).maybeSingle()
    return {
      type: 'mutual_transfer',
      sender: senderData?.name || sender_id,
      receiver: receiverData?.name || receiver_id,
      coins: 0,
      week_start,
      detail: `${senderData?.name} さんと ${receiverData?.name} さんが同週内で相互送付（形式的送付の可能性）`
    }
  }
  return null
}

/**
 * スパム検知：1日に5回以上の送付
 */
async function checkSpam(sender_id: string, today: string): Promise<Anomaly | null> {
  const { data: daily } = await supabase
    .from('coin_transactions')
    .select('id')
    .eq('sender_id', sender_id)
    .gte('created_at', `${today}T00:00:00`)
    .lt('created_at', `${today}T23:59:59`)

  if ((daily || []).length > 5) {
    const { data: senderData } = await supabase.from('employees').select('name').eq('id', sender_id).limit(1).maybeSingle()
    return {
      type: 'spam',
      sender: senderData?.name || sender_id,
      receiver: '-',
      coins: (daily || []).length,
      week_start: today,
      detail: `1日に ${(daily || []).length} 回以上送付（スパムの可能性）`
    }
  }
  return null
}

/**
 * 管理者へメール通知を送信（Supabase Auth管理者）
 */
async function notifyAdmin(anomalies: Anomaly[], actorId: string): Promise<boolean> {
  if (anomalies.length === 0) return true

  // typeごとに日本語で簡潔な説明文を生成
  const typeToLabel: Record<string, string> = {
    large_transfer: '大量送付',
    mutual_transfer: '相互送付',
    spam: 'スパム送付'
  }

  // 1件でも複数件でも簡潔な日本語でまとめる
  const messages = anomalies.map(a => {
    let label = typeToLabel[a.type] || a.type
    // detailは既に日本語なので活用
    return `【${label}】${a.detail}`
  })

  const message = messages.join('／')

  // 監査ログには日本語メッセージのみ格納し、actor_idも記録
  await supabase
    .from('audit_logs')
    .insert({
      action: 'anomaly_detected',
      payload: { message },
      actor_id: actorId
    })

  console.log('Anomalies detected:', message)
  return true
}

/**
 * トランザクション後に異常検知を実行
 */
export async function detectAnomalies(sender_id: string, receiver_id: string, coins: number, week_start: string) {
  const anomalies: Anomaly[] = []

  // 大量送付検知
  const large = await checkLargeTransfer(sender_id, receiver_id, coins, week_start)
  if (large) anomalies.push(large)

  // 相互送付検知
  const mutual = await checkMutualTransfer(sender_id, receiver_id, week_start)
  if (mutual) anomalies.push(mutual)

  // スパム検知
  const today = new Date().toISOString().slice(0, 10)
  const spam = await checkSpam(sender_id, today)
  if (spam) anomalies.push(spam)

  // 管理者への通知
  if (anomalies.length > 0) {
    await notifyAdmin(anomalies, sender_id)
  }
}

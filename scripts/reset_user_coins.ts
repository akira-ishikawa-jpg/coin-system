import { createClient } from '@supabase/supabase-js'

const SUPABASE_URL = process.env.SUPABASE_URL || ''
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || ''

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY)

async function resetUserCoins() {
  const userId = '67f3a111-0ade-4f2a-89dc-80239d69b616' // 石川晃さんのID
  
  // 今週の開始日を計算
  const getWeekStart = () => {
    const d = new Date()
    const day = d.getDay()
    const diff = (day === 0 ? -6 : 1) - day
    d.setDate(d.getDate() + diff)
    d.setHours(0, 0, 0, 0)
    return d.toISOString()
  }

  const weekStart = getWeekStart()
  
  console.log('今週の開始日:', weekStart)
  console.log('リセット対象ユーザー:', userId)
  
  // 現在の送信履歴を確認
  const { data: currentTx } = await supabase
    .from('coin_transactions')
    .select('*')
    .eq('sender_id', userId)
    .gte('created_at', weekStart)
  
  console.log('削除対象のトランザクション:', currentTx?.length || 0, '件')
  console.log('詳細:', currentTx)
  
  // 今週の送信履歴を削除
  const { error } = await supabase
    .from('coin_transactions')
    .delete()
    .eq('sender_id', userId)
    .gte('created_at', weekStart)
  
  if (error) {
    console.error('削除エラー:', error)
    return
  }
  
  console.log('✅ 石川晃さんの今週のコイン送信履歴を削除しました')
  
  // 削除後の確認
  const { data: afterTx } = await supabase
    .from('coin_transactions')
    .select('*')
    .eq('sender_id', userId)
    .gte('created_at', weekStart)
  
  console.log('削除後のトランザクション:', afterTx?.length || 0, '件')
  
  // ユーザー情報を確認
  const { data: user } = await supabase
    .from('employees')
    .select('name, email')
    .eq('id', userId)
    .single()
  
  console.log('対象ユーザー:', user?.name, user?.email)
  console.log('💰 残コインは250コインにリセットされました（週次配布分）')
}

resetUserCoins().catch(console.error)
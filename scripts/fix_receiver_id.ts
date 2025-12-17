// coin_transactionsテーブルのreceiver_idを補完するスクリプト
// 1. receiver_idがNULLのレコードを抽出
// 2. receiver_nameからemployeesテーブルのidを特定し、receiver_idをUPDATE
//
// 実行方法: npx ts-node scripts/fix_receiver_id.ts

import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.SUPABASE_URL || ''
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || ''
const supabase = createClient(supabaseUrl, supabaseKey)

async function main() {
  // receiver_idがNULLの取引を取得
  const { data: txns, error } = await supabase
    .from('coin_transactions')
    .select('id, receiver_name')
    .is('receiver_id', null)

  if (error) {
    console.error('取引取得エラー:', error)
    return
  }
  if (!txns || txns.length === 0) {
    console.log('補完対象の取引はありません')
    return
  }

  let updated = 0
  for (const tx of txns) {
    if (!tx.receiver_name) continue
    // receiver_nameからemployees.idを取得
    const { data: emp, error: empError } = await supabase
      .from('employees')
      .select('id')
      .eq('name', tx.receiver_name)
      .limit(1)
      .maybeSingle()
    if (empError || !emp) {
      console.warn(`社員未特定: ${tx.receiver_name}`)
      continue
    }
    // UPDATE
    const { error: updateError } = await supabase
      .from('coin_transactions')
      .update({ receiver_id: emp.id })
      .eq('id', tx.id)
    if (updateError) {
      console.error(`更新失敗: tx.id=${tx.id}`, updateError)
      continue
    }
    updated++
    console.log(`補完: tx.id=${tx.id} → receiver_id=${emp.id}`)
  }
  console.log(`補完完了: ${updated}件`)
}

main()

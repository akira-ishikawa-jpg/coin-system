
import 'dotenv/config'

import 'dotenv/config'
import { createClient } from '@supabase/supabase-js'

const SUPABASE_URL = process.env.SUPABASE_URL || ''
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || ''

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY)

async function setWeeklyCoins() {
  console.log('週次配布コイン数を250に設定中...')
  
  // 設定を250コインに更新
  const { error } = await supabase
    .from('settings')
    .upsert({
      key: 'default_weekly_coins',
      value: '250'
    })
  
  if (error) {
    console.error('設定更新エラー:', error)
    return
  }
  
  console.log('✅ 週次配布コイン数を250に設定しました')
  
  // 確認
  const { data } = await supabase
    .from('settings')
    .select('*')
    .eq('key', 'default_weekly_coins')
    .single()
  
  console.log('確認:', data)
}

setWeeklyCoins().catch(console.error)
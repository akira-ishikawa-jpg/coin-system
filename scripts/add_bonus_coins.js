const { createClient } = require('@supabase/supabase-js')

async function addBonusCoinsColumn() {
  const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY)
  
  console.log('employeesテーブルにbonus_coinsカラムを追加中...')
  
  // Add bonus_coins column to employees table
  const { error } = await supabase.rpc('exec_sql', {
    sql: 'ALTER TABLE employees ADD COLUMN IF NOT EXISTS bonus_coins int DEFAULT 0;'
  })
  
  if (error) {
    console.error('エラー:', error)
    // Try alternative approach
    const { error: altError } = await supabase
      .from('employees')
      .select('bonus_coins')
      .limit(1)
    
    if (altError && altError.message.includes('column "bonus_coins" does not exist')) {
      console.log('カラムが存在しません。手動で追加する必要があります。')
      console.log('Supabase SQL Editorで以下を実行してください:')
      console.log('ALTER TABLE employees ADD COLUMN bonus_coins int DEFAULT 0;')
    } else {
      console.log('✅ bonus_coinsカラムは既に存在するか、正常に追加されました')
    }
  } else {
    console.log('✅ bonus_coinsカラムが正常に追加されました')
  }
}

// 環境変数をロードして実行
require('dotenv').config({ path: '.env.local' })
addBonusCoinsColumn()
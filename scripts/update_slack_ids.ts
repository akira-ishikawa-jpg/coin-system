import { supabase } from '../lib/supabaseClient'

async function updateSlackIds() {
  try {
    console.log('Slack IDを更新しています...')

    // 荒木さんのSlack ID更新
    const { error: arakiError } = await supabase
      .from('employees')
      .update({ slack_id: 'U0993V6VCVD' })
      .eq('email', 'osamu-araki@salesnow.jp')

    if (arakiError) {
      console.error('荒木さんのSlack ID更新エラー:', arakiError)
    } else {
      console.log('✅ 荒木さんのSlack IDを更新しました: U0993V6VCVD')
    }

    // 石川さんのSlack ID更新
    const { error: ishikawaError } = await supabase
      .from('employees')
      .update({ slack_id: 'U08HZ16NEPM' })
      .eq('email', 'akira-ishikawa@salesnow.jp')

    if (ishikawaError) {
      console.error('石川さんのSlack ID更新エラー:', ishikawaError)
    } else {
      console.log('✅ 石川さんのSlack IDを更新しました: U08HZ16NEPM')
    }

    // 更新結果を確認
    const { data: employees, error: selectError } = await supabase
      .from('employees')
      .select('name, email, slack_id')
      .in('email', ['osamu-araki@salesnow.jp', 'akira-ishikawa@salesnow.jp'])

    if (selectError) {
      console.error('確認エラー:', selectError)
    } else {
      console.log('\n更新後の状態:')
      employees.forEach(emp => {
        console.log(`- ${emp.name} (${emp.email}): ${emp.slack_id || '未設定'}`)
      })
    }

  } catch (error) {
    console.error('スクリプト実行エラー:', error)
  }
}

updateSlackIds().then(() => {
  console.log('スクリプト完了')
  process.exit(0)
}).catch((error) => {
  console.error('スクリプトエラー:', error)
  process.exit(1)
})
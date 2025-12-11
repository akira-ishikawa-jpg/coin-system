import { createClient } from '@supabase/supabase-js'
import * as dotenv from 'dotenv'

dotenv.config({ path: '.env.local' })

const url = process.env.SUPABASE_URL || ''
const key = process.env.SUPABASE_SERVICE_ROLE_KEY || ''

if (!url || !key) {
  console.error('SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY must be set in env')
  process.exit(1)
}

const supabase = createClient(url, key)

async function main() {
  // Delete existing test employees
  await supabase.from('employees').delete().in('email', ['taro@example.com', 'hanako@example.com', 'jiro@example.com'])

  const employees = [
    { name: 'Admin User', email: 'ishiishijunjun0413@gmail.com', department: '営業', slack_id: 'U12345678', role: 'admin' },
    { name: '佐藤 花子', email: 'hanako@example.com', department: '開発', slack_id: 'U23456789', role: 'user' },
    { name: '鈴木 次郎', email: 'jiro@example.com', department: '人事', slack_id: 'U34567890', role: 'user' },
  ]

  const { data, error } = await supabase.from('employees').upsert(employees)
  if (error) {
    console.error('insert error', error)
    process.exit(1)
  }
  console.log('Inserted/updated dummy employees:', data)
}

main()
  .then(() => process.exit(0))
  .catch((err) => { console.error(err); process.exit(1) })

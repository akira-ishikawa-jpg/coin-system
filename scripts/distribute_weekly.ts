import { createClient } from '@supabase/supabase-js'

const url = process.env.SUPABASE_URL || ''
const key = process.env.SUPABASE_SERVICE_ROLE_KEY || ''

if (!url || !key) {
  console.error('SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY required')
  process.exit(1)
}

const supabase = createClient(url, key)

function getWeekStart(date = new Date()) {
  const d = new Date(date)
  const day = d.getDay()
  const diff = (day === 0 ? -6 : 1) - day
  d.setDate(d.getDate() + diff)
  d.setHours(0,0,0,0)
  return d.toISOString().slice(0,10)
}

async function main() {
  const weekStart = getWeekStart()
  console.log('Distributing coins for week starting:', weekStart)
  const { data, error } = await supabase.rpc('distribute_weekly_coins', { week_start_date: weekStart, weekly_amount: 250 })
  if (error) {
    console.error('RPC error:', error)
    process.exit(1)
  }
  console.log('Distributed coins to', data, 'employees')
}

main().catch(e => { console.error(e); process.exit(1) })

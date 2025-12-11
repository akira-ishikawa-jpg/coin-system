import { createClient } from '@supabase/supabase-js'

const url = process.env.SUPABASE_URL || ''
const key = process.env.SUPABASE_SERVICE_ROLE_KEY || ''

if (!url || !key) {
  console.error('SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY required')
  process.exit(1)
}

const supabase = createClient(url, key)

async function main() {
  const d = new Date()
  d.setDate(1)
  d.setHours(0,0,0,0)
  d.setMonth(d.getMonth() - 1)
  const y = d.getFullYear()
  const m = d.getMonth() + 1
  const { data, error } = await supabase.rpc('populate_monthly_summary', { year_in: y, month_in: m })
  if (error) {
    console.error('rpc error', error)
    process.exit(1)
  }
  console.log('monthly summary populated', y, m)
}

main().catch((e)=>{ console.error(e); process.exit(1) })

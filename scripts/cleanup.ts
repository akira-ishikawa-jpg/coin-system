import { createClient } from '@supabase/supabase-js'
import * as dotenv from 'dotenv'

dotenv.config({ path: '.env.local' })
const url = process.env.SUPABASE_URL || ''
const key = process.env.SUPABASE_SERVICE_ROLE_KEY || ''
const supabase = createClient(url, key)

async function deleteAll() {
  const { error } = await supabase.from('employees').delete().gte('id', '00000000-0000-0000-0000-000000000000')
  if (error) console.error('delete error:', error)
  else console.log('All employees deleted')
}
deleteAll().then(() => process.exit(0)).catch(e => { console.error(e); process.exit(1) })

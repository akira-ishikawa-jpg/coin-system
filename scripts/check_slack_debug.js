const { createClient } = require('@supabase/supabase-js')

async function checkSlackDebug() {
  const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY)
  
  const { data, error } = await supabase
    .from('audit_logs')
    .select('*')
    .eq('action', 'slack_debug')
    .order('created_at', { ascending: false })
    .limit(3)
  
  if (error) {
    console.error('Error:', error)
    return
  }
  
  console.log('Recent Slack debug logs:')
  data.forEach((log, index) => {
    console.log(`${index + 1}. Created: ${log.created_at}`)
    console.log(`   Payload:`, JSON.stringify(log.payload, null, 2))
    console.log('')
  })
}

checkSlackDebug()
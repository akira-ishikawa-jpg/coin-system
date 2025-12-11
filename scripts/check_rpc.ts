import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || '';

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

async function check() {
  const now = new Date();
  const y = now.getFullYear();
  const m = now.getMonth() + 1;
  
  console.log('=== aggregate_monthly_received を試行 ===');
  const { data: oldData, error: oldError } = await supabase.rpc('aggregate_monthly_received', { year_in: y, month_in: m });
  if (oldError) {
    console.error('エラー:', oldError);
  } else {
    console.log('成功:', JSON.stringify(oldData, null, 2));
  }
  
  console.log('\n=== aggregate_monthly_stats を試行 ===');
  const { data: newData, error: newError } = await supabase.rpc('aggregate_monthly_stats', { year_in: y, month_in: m });
  if (newError) {
    console.error('エラー:', newError);
  } else {
    console.log('成功:', JSON.stringify(newData, null, 2));
  }
}

check().catch(console.error);

const { createClient } = require('@supabase/supabase-js')

async function updateRpcFunction() {
  const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY)
  
  const rpcSql = `
CREATE OR REPLACE FUNCTION aggregate_monthly_stats(year_in int, month_in int)
RETURNS TABLE(employee_id uuid, name text, email text, department text, role text, total_received int, total_sent int, total_likes int) AS $$
  SELECT
    e.id,
    e.name,
    e.email,
    e.department,
    e.role,
    COALESCE(SUM(CASE WHEN ct_recv.receiver_id = e.id THEN ct_recv.coins ELSE 0 END), 0) AS total_received,
    COALESCE(SUM(CASE WHEN ct_sent.sender_id = e.id THEN ct_sent.coins ELSE 0 END), 0) AS total_sent,
    COALESCE((
      SELECT COUNT(*)
      FROM coin_transactions ct_like
      LEFT JOIN transaction_likes tl ON tl.transaction_id = ct_like.id
      WHERE ct_like.receiver_id = e.id
        AND ct_like.created_at >= make_date(year_in, month_in, 1)
        AND ct_like.created_at < (make_date(year_in, month_in, 1) + INTERVAL '1 month')
        AND NOT (ct_like.slack_payload @> '{"bonus":true}')
    ), 0) AS total_likes
  FROM employees e
  LEFT JOIN coin_transactions ct_recv
    ON ct_recv.receiver_id = e.id
    AND ct_recv.created_at >= make_date(year_in, month_in, 1)
    AND ct_recv.created_at < (make_date(year_in, month_in, 1) + INTERVAL '1 month')
    AND NOT (ct_recv.slack_payload @> '{"bonus":true}')
  LEFT JOIN coin_transactions ct_sent
    ON ct_sent.sender_id = e.id
    AND ct_sent.created_at >= make_date(year_in, month_in, 1)
    AND ct_sent.created_at < (make_date(year_in, month_in, 1) + INTERVAL '1 month')
    AND NOT (ct_sent.slack_payload @> '{"bonus":true}')
  GROUP BY e.id, e.name, e.email, e.department, e.role
  HAVING COALESCE(SUM(CASE WHEN ct_recv.receiver_id = e.id THEN ct_recv.coins ELSE 0 END), 0) > 0
      OR COALESCE(SUM(CASE WHEN ct_sent.sender_id = e.id THEN ct_sent.coins ELSE 0 END), 0) > 0;
$$ LANGUAGE sql STABLE;
  `

  console.log('RPC関数を更新中...')
  const { error } = await supabase.rpc('exec', { sql: rpcSql })
  
  if (error) {
    console.error('RPC更新エラー:', error)
    // 直接SQLを実行
    const { error: directError } = await supabase.from('sql').select().eq('query', rpcSql)
    console.error('Direct error:', directError)
  } else {
    console.log('✅ RPC関数が正常に更新されました')
  }
}

// 環境変数をロードして実行
require('dotenv').config({ path: '.env.local' })
updateRpcFunction()
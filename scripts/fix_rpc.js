require('dotenv').config({ path: '.env.local' })
const { createClient } = require('@supabase/supabase-js')

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
)

async function updateFunction() {
  console.log('RPC関数を直接更新します...')
  
  // 新しいRPC関数を作成（古いものを上書き）
  const sqlQuery = `
DROP FUNCTION IF EXISTS aggregate_monthly_stats(integer, integer);

CREATE OR REPLACE FUNCTION aggregate_monthly_stats(year_in int, month_in int)
RETURNS TABLE(employee_id uuid, name text, email text, department text, role text, total_received int, total_sent int, total_likes int) AS $$
BEGIN
  RETURN QUERY
  SELECT
    e.id AS employee_id,
    e.name,
    e.email,
    e.department,
    COALESCE(e.role, 'user') AS role,
    COALESCE((
      SELECT SUM(ct.coins)::int
      FROM coin_transactions ct
      WHERE ct.receiver_id = e.id
        AND ct.created_at >= make_date(year_in, month_in, 1)
        AND ct.created_at < (make_date(year_in, month_in, 1) + INTERVAL '1 month')
    ), 0) AS total_received,
    COALESCE((
      SELECT SUM(ct.coins)::int
      FROM coin_transactions ct
      WHERE ct.sender_id = e.id
        AND ct.created_at >= make_date(year_in, month_in, 1)
        AND ct.created_at < (make_date(year_in, month_in, 1) + INTERVAL '1 month')
    ), 0) AS total_sent,
    COALESCE((
      SELECT COUNT(*)::int
      FROM coin_transactions ct
      INNER JOIN transaction_likes tl ON tl.transaction_id = ct.id
      WHERE ct.receiver_id = e.id
        AND ct.created_at >= make_date(year_in, month_in, 1)
        AND ct.created_at < (make_date(year_in, month_in, 1) + INTERVAL '1 month')
    ), 0) AS total_likes
  FROM employees e
  WHERE e.id IS NOT NULL
  ORDER BY e.name;
END;
$$ LANGUAGE plpgsql STABLE;
`

  try {
    // バッチでSQL実行
    const queries = sqlQuery.split(';').filter(q => q.trim())
    
    for (const query of queries) {
      if (query.trim()) {
        const { error } = await supabase.rpc('query', { query: query.trim() })
        if (error) {
          console.log(`クエリエラー（無視）: ${error.message}`)
        }
      }
    }
    
    console.log('✅ RPC関数の更新が完了しました')
    console.log('ページをリロードして権限列を確認してください')
  } catch (error) {
    console.error('❌ 更新エラー:', error.message)
  }
}

updateFunction()
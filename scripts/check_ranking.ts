import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || '';

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

async function check() {
  // 全取引を確認
  console.log(`=== 全取引データ ===`);
  const { data: allTxs } = await supabase
    .from('coin_transactions')
    .select('id, coins, message, created_at, sender:employees!sender_id(name), receiver:employees!receiver_id(name)')
    .order('created_at', { ascending: false })
    .limit(20);
    
  if (allTxs && allTxs.length > 0) {
    allTxs.forEach((tx: any) => {
      const sender = tx.sender?.name || '不明';
      const receiver = tx.receiver?.name || '不明';
      console.log(`${sender} → ${receiver}: ${tx.coins}コイン (${new Date(tx.created_at).toLocaleString('ja-JP')})`);
      if (tx.message) console.log(`  メッセージ: ${tx.message}`);
    });
  } else {
    console.log('取引データなし');
  }
  
  const now = new Date();
  const y = now.getFullYear();
  const m = now.getMonth() + 1;
  
  console.log(`\n=== 今月(${y}年${m}月)の取引データ ===`);
  const { data: txs } = await supabase
    .from('coin_transactions')
    .select('id, coins, message, created_at, sender:employees!sender_id(name), receiver:employees!receiver_id(name)')
    .gte('created_at', `${y}-${String(m).padStart(2,'0')}-01`)
    .lt('created_at', `${y}-${String(m+1).padStart(2,'0')}-01`)
    .order('created_at', { ascending: false });
  
  if (txs && txs.length > 0) {
    txs.forEach((tx: any) => {
      const sender = tx.sender?.name || '不明';
      const receiver = tx.receiver?.name || '不明';
      console.log(`${sender} → ${receiver}: ${tx.coins}コイン (${new Date(tx.created_at).toLocaleString('ja-JP')})`);
      if (tx.message) console.log(`  メッセージ: ${tx.message}`);
    });
  } else {
    console.log('取引データなし');
  }
  
  console.log(`\n=== RPC関数の集計結果 ===`);
  const { data: stats, error } = await supabase.rpc('aggregate_monthly_stats', { year_in: y, month_in: m });
  
  if (error) {
    console.error('エラー:', error);
  } else if (stats) {
    (stats as any[]).forEach((s: any) => {
      console.log(`${s.name}: 受取${s.total_received} 贈呈${s.total_sent} いいね${s.total_likes}`);
    });
  } else {
    console.log('集計結果なし');
  }
}

check().catch(console.error);

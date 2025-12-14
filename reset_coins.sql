-- 今週の開始日を計算（月曜日）
WITH week_start AS (
  SELECT DATE_TRUNC('week', CURRENT_DATE + INTERVAL '1 day') - INTERVAL '1 day' AS week_start_date
)
-- 石川晃さんの今週の送信履歴を削除
DELETE FROM coin_transactions 
WHERE sender_id = '67f3a111-0ade-4f2a-89dc-80239d69b616'
  AND created_at >= (SELECT week_start_date FROM week_start);

-- 確認用：削除後の状況を表示
SELECT 
  e.name,
  COUNT(ct.id) as transactions_this_week,
  COALESCE(SUM(ct.coins), 0) as coins_sent_this_week
FROM employees e
LEFT JOIN coin_transactions ct ON e.id = ct.sender_id 
  AND ct.created_at >= (SELECT week_start_date FROM week_start)
WHERE e.id = '67f3a111-0ade-4f2a-89dc-80239d69b616'
GROUP BY e.id, e.name;

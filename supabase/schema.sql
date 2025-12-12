-- Supabase schema for Employee Appreciation Coin System

-- Employees
CREATE TABLE IF NOT EXISTS employees (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  email text UNIQUE NOT NULL,
  department text,
  slack_id text UNIQUE,
  role text DEFAULT 'user',
  created_at timestamptz DEFAULT now()
);

-- Coin transactions (sender -> receiver)
CREATE TABLE IF NOT EXISTS coin_transactions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  sender_id uuid REFERENCES employees(id) ON DELETE SET NULL,
  receiver_id uuid REFERENCES employees(id) ON DELETE SET NULL,
  coins int NOT NULL CHECK (coins > 0),
  message text,
  emoji text,-- 1. いいねテーブルの作成
CREATE TABLE IF NOT EXISTS transaction_likes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  transaction_id uuid REFERENCES coin_transactions(id) ON DELETE CASCADE,
  employee_id uuid REFERENCES employees(id) ON DELETE CASCADE,
  created_at timestamptz DEFAULT now(),
  UNIQUE(transaction_id, employee_id)
);

CREATE INDEX IF NOT EXISTS idx_transaction_likes_transaction ON transaction_likes(transaction_id);
CREATE INDEX IF NOT EXISTS idx_transaction_likes_employee ON transaction_likes(employee_id);

-- 2. 新しいRPC関数（受取・贈呈・いいね数を集計）
CREATE OR REPLACE FUNCTION aggregate_monthly_stats(year_in int, month_in int)
RETURNS TABLE(employee_id uuid, name text, email text, department text, total_received int, total_sent int, total_likes int) AS $$
  SELECT
    e.id,
    e.name,
    e.email,
    e.department,
    COALESCE(SUM(CASE WHEN ct_recv.receiver_id = e.id THEN ct_recv.coins ELSE 0 END), 0) AS total_received,
    COALESCE(SUM(CASE WHEN ct_sent.sender_id = e.id THEN ct_sent.coins ELSE 0 END), 0) AS total_sent,
    COALESCE((
      SELECT COUNT(*)
      FROM coin_transactions ct_like
      LEFT JOIN transaction_likes tl ON tl.transaction_id = ct_like.id
      WHERE ct_like.receiver_id = e.id
        AND ct_like.created_at >= make_date(year_in, month_in, 1)
        AND ct_like.created_at < (make_date(year_in, month_in, 1) + INTERVAL '1 month')
    ), 0) AS total_likes
  FROM employees e
  LEFT JOIN coin_transactions ct_recv
    ON ct_recv.receiver_id = e.id
    AND ct_recv.created_at >= make_date(year_in, month_in, 1)
    AND ct_recv.created_at < (make_date(year_in, month_in, 1) + INTERVAL '1 month')
  LEFT JOIN coin_transactions ct_sent
    ON ct_sent.sender_id = e.id
    AND ct_sent.created_at >= make_date(year_in, month_in, 1)
    AND ct_sent.created_at < (make_date(year_in, month_in, 1) + INTERVAL '1 month')
  GROUP BY e.id, e.name, e.email, e.department
  HAVING COALESCE(SUM(CASE WHEN ct_recv.receiver_id = e.id THEN ct_recv.coins ELSE 0 END), 0) > 0
      OR COALESCE(SUM(CASE WHEN ct_sent.sender_id = e.id THEN ct_sent.coins ELSE 0 END), 0) > 0;
$$ LANGUAGE sql STABLE;
  week_start date NOT NULL,
  slack_payload jsonb,
  created_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_coin_transactions_week_start ON coin_transactions(week_start);
CREATE INDEX IF NOT EXISTS idx_coin_transactions_receiver ON coin_transactions(receiver_id);
CREATE INDEX IF NOT EXISTS idx_coin_transactions_sender ON coin_transactions(sender_id);

-- Settings (key-value)
CREATE TABLE IF NOT EXISTS settings (
  key text PRIMARY KEY,
  value text NOT NULL
);

-- Default settings
INSERT INTO settings (key, value) VALUES
  ('default_weekly_coins', '250'),
  ('coin_to_yen_rate', '1')
ON CONFLICT (key) DO NOTHING;

-- Monthly summary (populated by batch job)
CREATE TABLE IF NOT EXISTS monthly_summary (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  employee_id uuid REFERENCES employees(id) ON DELETE CASCADE,
  year int NOT NULL,
  month int NOT NULL,
  total_received int DEFAULT 0,
  created_at timestamptz DEFAULT now(),
  UNIQUE(employee_id, year, month)
);

-- Audit log for actions
CREATE TABLE IF NOT EXISTS audit_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  actor_id uuid REFERENCES employees(id),
  action text NOT NULL,
  payload jsonb,
  created_at timestamptz DEFAULT now()
);

-- Likes for coin transactions
CREATE TABLE IF NOT EXISTS transaction_likes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  transaction_id uuid REFERENCES coin_transactions(id) ON DELETE CASCADE,
  employee_id uuid REFERENCES employees(id) ON DELETE CASCADE,
  created_at timestamptz DEFAULT now(),
  UNIQUE(transaction_id, employee_id)
);

CREATE INDEX IF NOT EXISTS idx_transaction_likes_transaction ON transaction_likes(transaction_id);
CREATE INDEX IF NOT EXISTS idx_transaction_likes_employee ON transaction_likes(employee_id);

-- View: current week start (helper; optional)
-- We'll compute week_start from transactions in server code when inserting.

-- RPC: aggregate monthly stats per employee (received, sent, likes)
CREATE OR REPLACE FUNCTION aggregate_monthly_stats(year_in int, month_in int)
RETURNS TABLE(employee_id uuid, name text, email text, department text, total_received int, total_sent int, total_likes int) AS $$
  SELECT
    e.id AS employee_id,
    e.name,
    e.email,
    e.department,
    COALESCE((
      SELECT SUM(ct.coins)
      FROM coin_transactions ct
      WHERE ct.receiver_id = e.id
        AND ct.created_at >= make_date(year_in, month_in, 1)
        AND ct.created_at < (make_date(year_in, month_in, 1) + INTERVAL '1 month')
    ), 0)::int AS total_received,
    COALESCE((
      SELECT SUM(ct.coins)
      FROM coin_transactions ct
      WHERE ct.sender_id = e.id
        AND ct.created_at >= make_date(year_in, month_in, 1)
        AND ct.created_at < (make_date(year_in, month_in, 1) + INTERVAL '1 month')
    ), 0)::int AS total_sent,
    COALESCE((
      SELECT COUNT(*)
      FROM coin_transactions ct
      INNER JOIN transaction_likes tl ON tl.transaction_id = ct.id
      WHERE ct.receiver_id = e.id
        AND ct.created_at >= make_date(year_in, month_in, 1)
        AND ct.created_at < (make_date(year_in, month_in, 1) + INTERVAL '1 month')
    ), 0)::int AS total_likes
  FROM employees e;
$$ LANGUAGE sql STABLE;

-- Keep old function for backward compatibility
CREATE OR REPLACE FUNCTION aggregate_monthly_received(year_in int, month_in int)
RETURNS TABLE(employee_id uuid, name text, email text, department text, total_received int) AS $$
  SELECT
    e.id,
    e.name,
    e.email,
    e.department,
    COALESCE(SUM(ct.coins), 0) AS total_received
  FROM employees e
  LEFT JOIN coin_transactions ct
    ON ct.receiver_id = e.id
    AND ct.created_at >= make_date(year_in, month_in, 1)
    AND ct.created_at < (make_date(year_in, month_in, 1) + INTERVAL '1 month')
  GROUP BY e.id, e.name, e.email, e.department
  HAVING COALESCE(SUM(ct.coins), 0) > 0;
$$ LANGUAGE sql STABLE;

-- RPC: populate monthly_summary (upsert totals)
CREATE OR REPLACE FUNCTION populate_monthly_summary(year_in int, month_in int)
RETURNS void AS $$
BEGIN
  INSERT INTO monthly_summary (employee_id, year, month, total_received, created_at)
  SELECT e.id, year_in, month_in, COALESCE(SUM(ct.coins),0), now()
  FROM employees e
  LEFT JOIN coin_transactions ct
    ON ct.receiver_id = e.id
    AND ct.created_at >= make_date(year_in, month_in, 1)
    AND ct.created_at < (make_date(year_in, month_in, 1) + INTERVAL '1 month')
  GROUP BY e.id
  ON CONFLICT (employee_id, year, month) DO UPDATE
    SET total_received = EXCLUDED.total_received,
        created_at = now();
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- RPC: distribute weekly coins (every Monday or specified day)
CREATE OR REPLACE FUNCTION distribute_weekly_coins(week_start_date date, weekly_amount int DEFAULT 250)
RETURNS int AS $$
DECLARE
  count int;
BEGIN
  INSERT INTO weekly_coins (employee_id, week_start, amount, created_at)
  SELECT e.id, week_start_date, weekly_amount, now()
  FROM employees e
  WHERE e.role = 'user'
  ON CONFLICT DO NOTHING;
  GET DIAGNOSTICS count = ROW_COUNT;
  RETURN count;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

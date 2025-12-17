ALTER TABLE employees ADD COLUMN IF NOT EXISTS notify_email boolean DEFAULT true;
ALTER TABLE employees ADD COLUMN IF NOT EXISTS notify_slack boolean DEFAULT true;

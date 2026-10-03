ALTER TABLE purchase_payments
  ADD COLUMN IF NOT EXISTS register_session_id bigint REFERENCES register_sessions(id) ON DELETE SET NULL;

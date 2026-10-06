-- Pagination and fixed-period list support.
CREATE INDEX IF NOT EXISTS idx_stock_transfers_from_created
  ON stock_transfers(from_branch_id,created_at DESC);

CREATE INDEX IF NOT EXISTS idx_stock_transfers_to_created
  ON stock_transfers(to_branch_id,created_at DESC);

CREATE INDEX IF NOT EXISTS idx_stock_counts_branch_started
  ON stock_counts(branch_id,started_at DESC);

CREATE INDEX IF NOT EXISTS idx_customers_org_active_name
  ON customers(organization_id,active,name);

CREATE INDEX IF NOT EXISTS idx_suppliers_org_active_name
  ON suppliers(organization_id,active,name);

CREATE INDEX IF NOT EXISTS idx_expenses_branch_method_created
  ON expenses(branch_id,payment_method,created_at DESC);

CREATE INDEX IF NOT EXISTS idx_batches_branch_status_expiry
  ON medicine_batches(branch_id,status,expiry_date,id);

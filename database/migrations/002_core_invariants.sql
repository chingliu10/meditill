-- Core operational invariants discovered during the first vertical-slice review.

-- One physical register must never have two simultaneous open sessions.
CREATE UNIQUE INDEX IF NOT EXISTS uq_open_register_register
  ON register_sessions(register_id)
  WHERE status = 'OPEN';

-- Common lookup paths used by POS/reporting.
CREATE INDEX IF NOT EXISTS idx_sales_branch_created
  ON sales(branch_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_sale_items_medicine
  ON sale_items(medicine_id);

CREATE INDEX IF NOT EXISTS idx_sale_item_batches_batch
  ON sale_item_batches(batch_id);

CREATE INDEX IF NOT EXISTS idx_purchase_items_medicine
  ON purchase_items(medicine_id);

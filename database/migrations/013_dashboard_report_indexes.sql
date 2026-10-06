-- Keep dashboard/report range scans efficient. The dashboard UI caps history at one year.
CREATE INDEX IF NOT EXISTS idx_purchases_branch_purchase_date
  ON purchases(branch_id,purchase_date DESC);

CREATE INDEX IF NOT EXISTS idx_sale_items_sale
  ON sale_items(sale_id);

CREATE INDEX IF NOT EXISTS idx_sale_item_batches_sale_item
  ON sale_item_batches(sale_item_id);

CREATE INDEX IF NOT EXISTS idx_sale_returns_sale
  ON sale_returns(sale_id);

CREATE INDEX IF NOT EXISTS idx_sale_return_items_sale_item
  ON sale_return_items(sale_item_id);

CREATE INDEX IF NOT EXISTS idx_sale_return_items_return
  ON sale_return_items(sale_return_id);

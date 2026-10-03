CREATE TABLE IF NOT EXISTS purchase_payments (
  id bigserial PRIMARY KEY,
  purchase_id bigint NOT NULL REFERENCES purchases(id) ON DELETE CASCADE,
  payment_method varchar(30) NOT NULL CHECK(payment_method IN('CASH','MOBILE_MONEY','CARD','BANK')),
  amount numeric(18,2) NOT NULL CHECK(amount>0),
  reference varchar(180),
  created_by bigint REFERENCES users(id),
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS purchase_returns (
  id bigserial PRIMARY KEY,
  organization_id bigint NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  branch_id bigint NOT NULL REFERENCES branches(id),
  purchase_id bigint NOT NULL REFERENCES purchases(id),
  return_number varchar(80) NOT NULL,
  reason text NOT NULL,
  total_value numeric(18,2) NOT NULL DEFAULT 0,
  created_by bigint NOT NULL REFERENCES users(id),
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS purchase_return_items (
  id bigserial PRIMARY KEY,
  purchase_return_id bigint NOT NULL REFERENCES purchase_returns(id) ON DELETE CASCADE,
  purchase_item_id bigint NOT NULL REFERENCES purchase_items(id),
  batch_id bigint NOT NULL REFERENCES medicine_batches(id),
  quantity numeric(18,4) NOT NULL CHECK(quantity>0),
  unit_cost numeric(18,2) NOT NULL CHECK(unit_cost>=0),
  line_total numeric(18,2) NOT NULL CHECK(line_total>=0)
);

INSERT INTO permissions(code,description) VALUES('purchase.payment','Record supplier purchase payments') ON CONFLICT(code) DO NOTHING;
INSERT INTO role_permissions(role_id,permission_id)
SELECT r.id,p.id FROM roles r CROSS JOIN permissions p
WHERE r.name='OWNER' AND p.code='purchase.payment'
ON CONFLICT DO NOTHING;

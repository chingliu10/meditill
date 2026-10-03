INSERT INTO permissions(code,description) VALUES
  ('customer.view','View customers'),
  ('customer.manage','Create and update customers'),
  ('expense.view','View expenses'),
  ('expense.create','Create expenses'),
  ('inventory.batch_status','Quarantine, recall or damage batches'),
  ('sales.receipt','View and print receipts')
ON CONFLICT(code) DO NOTHING;

INSERT INTO role_permissions(role_id,permission_id)
SELECT r.id,p.id
FROM roles r
CROSS JOIN permissions p
WHERE r.name='OWNER'
  AND p.code IN(
    'customer.view','customer.manage','expense.view','expense.create',
    'inventory.batch_status','sales.receipt'
  )
ON CONFLICT DO NOTHING;

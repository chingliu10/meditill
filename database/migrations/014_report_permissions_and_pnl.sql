INSERT INTO permissions(code,description) VALUES
  ('reports.purchases','View purchase reports')
ON CONFLICT(code) DO NOTHING;

INSERT INTO role_permissions(role_id,permission_id)
SELECT r.id,p.id
FROM roles r
CROSS JOIN permissions p
WHERE r.name='OWNER'
  AND p.code='reports.purchases'
ON CONFLICT DO NOTHING;

CREATE INDEX IF NOT EXISTS idx_expenses_branch_created
  ON expenses(branch_id,created_at DESC);

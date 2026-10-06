INSERT INTO permissions(code,description) VALUES
  ('supplier.view','View suppliers'),
  ('supplier.manage','Create, archive and restore suppliers')
ON CONFLICT(code) DO NOTHING;

INSERT INTO role_permissions(role_id,permission_id)
SELECT r.id,p.id
FROM roles r
CROSS JOIN permissions p
WHERE r.name='OWNER'
  AND p.code IN('supplier.view','supplier.manage')
ON CONFLICT DO NOTHING;

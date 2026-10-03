-- OWNER is the system super-role. Keep it synchronized with every permission
-- that exists now or is added by previous migrations.
INSERT INTO role_permissions(role_id,permission_id)
SELECT r.id,p.id
FROM roles r
CROSS JOIN permissions p
WHERE r.name='OWNER'
ON CONFLICT DO NOTHING;

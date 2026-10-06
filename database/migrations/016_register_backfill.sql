-- Ensure every active branch has at least one active cash register.
-- Older branches may pre-date automatic register creation.

UPDATE registers r
SET active=true
FROM branches b
WHERE r.branch_id=b.id
  AND b.active=true
  AND r.name='Register 1'
  AND r.active=false
  AND NOT EXISTS (
    SELECT 1
    FROM registers active_register
    WHERE active_register.branch_id=b.id
      AND active_register.active=true
  );

INSERT INTO registers(branch_id,name,active)
SELECT b.id,'Register 1',true
FROM branches b
WHERE b.active=true
  AND NOT EXISTS (
    SELECT 1
    FROM registers r
    WHERE r.branch_id=b.id
      AND r.active=true
  )
ON CONFLICT(branch_id,name) DO NOTHING;

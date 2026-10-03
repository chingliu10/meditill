async function findLoginUser(db, username) {
  const { rows } = await db.query(
    `SELECT u.id,u.organization_id,u.default_branch_id,u.name,u.username,u.password_hash
     FROM users u
     WHERE lower(u.username)=lower($1) AND u.active=true
     LIMIT 1`,[username]
  );
  return rows[0] || null;
}

async function getUserContext(db,userId) {
  const { rows } = await db.query(
    `SELECT
      u.id,
      u.organization_id,
      u.name,
      u.username,
      u.default_branch_id,
      COALESCE(array_agg(DISTINCT p.code) FILTER (WHERE p.code IS NOT NULL),'{}') AS permissions,
      COALESCE(array_agg(DISTINCT r.name) FILTER (WHERE r.name IS NOT NULL),'{}') AS roles,
      COALESCE(bool_or(r.name='OWNER'),false) AS is_owner
     FROM users u
     LEFT JOIN user_roles ur ON ur.user_id=u.id
     LEFT JOIN roles r ON r.id=ur.role_id
     LEFT JOIN role_permissions rp ON rp.role_id=ur.role_id
     LEFT JOIN permissions p ON p.id=rp.permission_id
     WHERE u.id=$1
     GROUP BY u.id`,[userId]
  );
  return rows[0] || null;
}

async function getBranches(db,userId) {
  const { rows } = await db.query(
    `SELECT b.id,b.name,b.code
     FROM branches b JOIN user_branches ub ON ub.branch_id=b.id
     WHERE ub.user_id=$1 AND b.active=true ORDER BY b.name`,[userId]
  );
  return rows;
}

module.exports={findLoginUser,getUserContext,getBranches};

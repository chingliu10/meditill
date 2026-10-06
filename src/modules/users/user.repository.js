async function list(db,organizationId){
  const {rows}=await db.query(
    `SELECT
       u.id,u.name,u.username,u.email,u.phone,u.active,
       b.name default_branch,
       COALESCE(string_agg(DISTINCT r.name,', '),'') roles
     FROM users u
     LEFT JOIN branches b ON b.id=u.default_branch_id
     LEFT JOIN user_roles ur ON ur.user_id=u.id
     LEFT JOIN roles r ON r.id=ur.role_id
     WHERE u.organization_id=$1
     GROUP BY u.id,b.name
     ORDER BY u.name`,
    [organizationId]
  );
  return rows;
}

async function masters(db,organizationId){
  const [roles,branches]=await Promise.all([
    db.query('SELECT id,name FROM roles WHERE organization_id=$1 ORDER BY name',[organizationId]),
    db.query('SELECT id,name FROM branches WHERE organization_id=$1 AND active=true ORDER BY name',[organizationId])
  ]);
  return {roles:roles.rows,branches:branches.rows};
}

async function findForEdit(db,organizationId,id){
  const [userResult,branchResult]=await Promise.all([
    db.query(
      `SELECT
         u.id,u.name,u.username,u.email,u.phone,u.active,u.default_branch_id,
         (
           SELECT ur.role_id
           FROM user_roles ur
           JOIN roles r ON r.id=ur.role_id
           WHERE ur.user_id=u.id AND r.organization_id=u.organization_id
           ORDER BY ur.role_id
           LIMIT 1
         ) AS role_id
       FROM users u
       WHERE u.organization_id=$1 AND u.id=$2
       LIMIT 1`,
      [organizationId,id]
    ),
    db.query(
      `SELECT ub.branch_id
       FROM user_branches ub
       JOIN users u ON u.id=ub.user_id
       JOIN branches b ON b.id=ub.branch_id
       WHERE u.organization_id=$1 AND u.id=$2 AND b.organization_id=$1
       ORDER BY ub.branch_id`,
      [organizationId,id]
    )
  ]);

  const user=userResult.rows[0];
  if(!user)return null;
  return {...user,branch_ids:branchResult.rows.map(row=>Number(row.branch_id))};
}

async function create(db,d){
  const {rows}=await db.query(
    `INSERT INTO users(organization_id,default_branch_id,name,username,email,phone,password_hash)
     VALUES($1,$2,$3,$4,$5,$6,$7)
     RETURNING *`,
    [d.organizationId,d.defaultBranchId,d.name,d.username,d.email||null,d.phone||null,d.hash]
  );
  return rows[0];
}

async function update(db,d){
  const {rows}=await db.query(
    `UPDATE users
     SET default_branch_id=$3,
         name=$4,
         username=$5,
         email=$6,
         phone=$7,
         password_hash=COALESCE($8,password_hash),
         updated_at=now()
     WHERE organization_id=$1 AND id=$2
     RETURNING id,organization_id,default_branch_id,name,username,email,phone,active,updated_at`,
    [
      d.organizationId,d.id,d.defaultBranchId,d.name,d.username,
      d.email||null,d.phone||null,d.hash||null
    ]
  );
  return rows[0]||null;
}

async function usernameTaken(db,organizationId,username,excludeUserId=null){
  const params=[organizationId,username];
  let sql=`SELECT 1
           FROM users
           WHERE organization_id=$1
             AND lower(username)=lower($2)`;
  if(excludeUserId){
    params.push(excludeUserId);
    sql+=' AND id<>$3';
  }
  sql+=' LIMIT 1';
  const {rows}=await db.query(sql,params);
  return rows.length>0;
}

async function role(db,userId,roleId){
  await db.query(
    'INSERT INTO user_roles(user_id,role_id) VALUES($1,$2) ON CONFLICT DO NOTHING',
    [userId,roleId]
  );
}

async function replaceRole(db,userId,roleId){
  await db.query('DELETE FROM user_roles WHERE user_id=$1',[userId]);
  await role(db,userId,roleId);
}

async function branch(db,userId,branchId){
  await db.query(
    'INSERT INTO user_branches(user_id,branch_id) VALUES($1,$2) ON CONFLICT DO NOTHING',
    [userId,branchId]
  );
}

async function replaceBranches(db,userId,branchIds){
  await db.query('DELETE FROM user_branches WHERE user_id=$1',[userId]);
  for(const branchId of branchIds){
    await branch(db,userId,branchId);
  }
}

async function setActive(db,organizationId,id,active){
  const {rows}=await db.query(
    'UPDATE users SET active=$3,updated_at=now() WHERE organization_id=$1 AND id=$2 RETURNING id,name,active',
    [organizationId,id,active]
  );
  return rows[0]||null;
}

module.exports={
  list,
  masters,
  findForEdit,
  create,
  update,
  usernameTaken,
  role,
  replaceRole,
  branch,
  replaceBranches,
  setActive
};

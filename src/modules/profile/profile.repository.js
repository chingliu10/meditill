async function getById(db,organizationId,userId){
  const {rows}=await db.query(
    `SELECT id,name,username,email,phone,active,updated_at
     FROM users
     WHERE organization_id=$1 AND id=$2
     LIMIT 1`,
    [organizationId,userId]
  );
  return rows[0]||null;
}

async function updateName(db,organizationId,userId,name){
  const {rows}=await db.query(
    `UPDATE users
     SET name=$3,updated_at=now()
     WHERE organization_id=$1 AND id=$2
     RETURNING id,name,username,email,phone,active,updated_at`,
    [organizationId,userId,name]
  );
  return rows[0]||null;
}

module.exports={getById,updateName};

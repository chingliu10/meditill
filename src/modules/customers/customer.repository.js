async function list(db,organizationId,q=''){
  const query=String(q||'').trim();
  const term=`%${query}%`;
  const {rows}=await db.query(
    `SELECT id,name,phone,email,address,is_walk_in,active,created_at
     FROM customers
     WHERE organization_id=$1
       AND active=true
       AND ($2='' OR name ILIKE $3 OR COALESCE(phone,'') ILIKE $3 OR COALESCE(email,'') ILIKE $3)
     ORDER BY is_walk_in DESC,name
     LIMIT 100`,
    [organizationId,query,term]
  );
  return rows;
}
async function create(db,data){
  const {rows}=await db.query(
    `INSERT INTO customers(organization_id,name,phone,email,address,is_walk_in)
     VALUES($1,$2,$3,$4,$5,false) RETURNING *`,
    [data.organizationId,data.name,data.phone||null,data.email||null,data.address||null]
  );
  return rows[0];
}
async function findById(db,organizationId,id){
  const {rows}=await db.query(
    'SELECT * FROM customers WHERE organization_id=$1 AND id=$2 AND active=true LIMIT 1',
    [organizationId,id]
  );
  return rows[0]||null;
}
module.exports={list,create,findById};

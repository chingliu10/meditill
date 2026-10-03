async function list(db,organizationId,q='',includeInactive=false){
  const query=String(q||'').trim();
  const term=`%${query}%`;
  const {rows}=await db.query(
    `SELECT id,name,phone,email,address,is_walk_in,active,created_at
     FROM customers
     WHERE organization_id=$1
       AND ($2::boolean OR active=true)
       AND ($3='' OR name ILIKE $4 OR COALESCE(phone,'') ILIKE $4 OR COALESCE(email,'') ILIKE $4)
     ORDER BY is_walk_in DESC,active DESC,name
     LIMIT 150`,
    [organizationId,includeInactive,query,term]
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
  const {rows}=await db.query('SELECT * FROM customers WHERE organization_id=$1 AND id=$2 LIMIT 1',[organizationId,id]);
  return rows[0]||null;
}
async function setActive(db,organizationId,id,active){
  const {rows}=await db.query(
    `UPDATE customers SET active=$3
     WHERE organization_id=$1 AND id=$2 AND is_walk_in=false
     RETURNING id,name,active`,
    [organizationId,id,active]
  );
  return rows[0]||null;
}
module.exports={list,create,findById,setActive};
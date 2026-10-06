async function list(db,organizationId,q='',includeInactive=false,page=1,pageSize=25){
  const query=String(q||'').trim();
  const term=`%${query}%`;
  const offset=(Math.max(1,Number(page)||1)-1)*pageSize;
  const params=[organizationId,includeInactive,query,term];

  const total=Number((await db.query(
    `SELECT COUNT(*)::int total
     FROM suppliers
     WHERE organization_id=$1
       AND ($2::boolean OR active=true)
       AND ($3='' OR name ILIKE $4 OR COALESCE(contact_person,'') ILIKE $4 OR COALESCE(phone,'') ILIKE $4 OR COALESCE(email,'') ILIKE $4)`,
    params
  )).rows[0]?.total||0);

  const {rows}=await db.query(
    `SELECT *
     FROM suppliers
     WHERE organization_id=$1
       AND ($2::boolean OR active=true)
       AND ($3='' OR name ILIKE $4 OR COALESCE(contact_person,'') ILIKE $4 OR COALESCE(phone,'') ILIKE $4 OR COALESCE(email,'') ILIKE $4)
     ORDER BY active DESC,name
     LIMIT $5 OFFSET $6`,
    [...params,pageSize,offset]
  );
  return {rows,total};
}

async function search(db,organizationId,q=''){
  const term=`%${String(q||'').trim()}%`;
  const {rows}=await db.query(
    `SELECT id,name,contact_person,phone,email FROM suppliers
     WHERE organization_id=$1 AND active=true
       AND ($2='' OR name ILIKE $3 OR COALESCE(contact_person,'') ILIKE $3 OR COALESCE(phone,'') ILIKE $3)
     ORDER BY name LIMIT 20`,
    [organizationId,String(q||'').trim(),term]
  );
  return rows;
}
async function create(db,d){const {rows}=await db.query(`INSERT INTO suppliers(organization_id,name,contact_person,phone,email,address,notes) VALUES($1,$2,$3,$4,$5,$6,$7) RETURNING *`,[d.organizationId,d.name,d.contactPerson||null,d.phone||null,d.email||null,d.address||null,d.notes||null]);return rows[0];}
async function setActive(db,organizationId,id,active){const {rows}=await db.query('UPDATE suppliers SET active=$3 WHERE organization_id=$1 AND id=$2 RETURNING id,name,active',[organizationId,id,active]);return rows[0]||null;}
module.exports={list,search,create,setActive};

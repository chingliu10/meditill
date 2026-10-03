async function list(db,organizationId){
  const {rows}=await db.query(
    'SELECT * FROM suppliers WHERE organization_id=$1 AND active=true ORDER BY name',
    [organizationId]
  );
  return rows;
}

async function search(db,organizationId,q=''){
  const term=`%${String(q||'').trim()}%`;
  const {rows}=await db.query(
    `SELECT id,name,contact_person,phone,email
     FROM suppliers
     WHERE organization_id=$1
       AND active=true
       AND (
         $2=''
         OR name ILIKE $3
         OR COALESCE(contact_person,'') ILIKE $3
         OR COALESCE(phone,'') ILIKE $3
       )
     ORDER BY name
     LIMIT 20`,
    [organizationId,String(q||'').trim(),term]
  );
  return rows;
}

async function create(db,d){
  const {rows}=await db.query(
    `INSERT INTO suppliers(
      organization_id,name,contact_person,phone,email,address,notes
    )
    VALUES($1,$2,$3,$4,$5,$6,$7)
    RETURNING *`,
    [
      d.organizationId,d.name,d.contactPerson||null,d.phone||null,
      d.email||null,d.address||null,d.notes||null
    ]
  );
  return rows[0];
}

module.exports={list,search,create};

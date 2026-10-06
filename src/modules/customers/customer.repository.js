async function list(db,organizationId,q='',includeInactive=false,page=1,pageSize=25){
  const query=String(q||'').trim();
  const term=`%${query}%`;
  const offset=(Math.max(1,Number(page)||1)-1)*pageSize;
  const params=[organizationId,includeInactive,query,term];

  const total=Number((await db.query(
    `SELECT COUNT(*)::int total
     FROM customers
     WHERE organization_id=$1
       AND ($2::boolean OR active=true)
       AND ($3='' OR name ILIKE $4 OR COALESCE(phone,'') ILIKE $4 OR COALESCE(email,'') ILIKE $4)`,
    params
  )).rows[0]?.total||0);

  const {rows}=await db.query(
    `SELECT id,name,phone,email,address,is_walk_in,active,created_at
     FROM customers
     WHERE organization_id=$1
       AND ($2::boolean OR active=true)
       AND ($3='' OR name ILIKE $4 OR COALESCE(phone,'') ILIKE $4 OR COALESCE(email,'') ILIKE $4)
     ORDER BY is_walk_in DESC,active DESC,name
     LIMIT $5 OFFSET $6`,
    [...params,pageSize,offset]
  );
  return {rows,total};
}

async function search(db,organizationId,q=''){
  const query=String(q||'').trim();
  const term=`%${query}%`;
  const prefix=`${query}%`;
  const {rows}=await db.query(
    `SELECT id,name,phone,email,address,is_walk_in,active,created_at
     FROM customers
     WHERE organization_id=$1
       AND active=true
       AND ($2='' OR name ILIKE $3 OR COALESCE(phone,'') ILIKE $3 OR COALESCE(email,'') ILIKE $3)
     ORDER BY
       CASE
         WHEN $2='' AND is_walk_in THEN 0
         WHEN $2='' THEN 50
         WHEN COALESCE(phone,'')=$2 THEN 0
         WHEN lower(COALESCE(email,''))=lower($2) THEN 0
         WHEN lower(name)=lower($2) THEN 1
         WHEN name ILIKE $4 THEN 2
         WHEN COALESCE(phone,'') ILIKE $4 THEN 3
         WHEN COALESCE(email,'') ILIKE $4 THEN 4
         ELSE 20
       END,
       is_walk_in DESC,
       name
     LIMIT 25`,
    [organizationId,query,term,prefix]
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

module.exports={list,search,create,findById,setActive};

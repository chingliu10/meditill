async function all(db,organizationId){const [categories,manufacturers,units]=await Promise.all([db.query('SELECT * FROM categories WHERE organization_id=$1 ORDER BY active DESC,name',[organizationId]),db.query('SELECT * FROM manufacturers WHERE organization_id=$1 ORDER BY active DESC,name',[organizationId]),db.query('SELECT * FROM units WHERE organization_id=$1 ORDER BY active DESC,name',[organizationId])]);return {categories:categories.rows,manufacturers:manufacturers.rows,units:units.rows};}
async function category(db,organizationId,name){const {rows}=await db.query('INSERT INTO categories(organization_id,name) VALUES($1,$2) RETURNING *',[organizationId,name]);return rows[0];}
async function manufacturer(db,organizationId,name,country){const {rows}=await db.query('INSERT INTO manufacturers(organization_id,name,country) VALUES($1,$2,$3) RETURNING *',[organizationId,name,country||null]);return rows[0];}
async function unit(db,organizationId,name,symbol,allowFraction){const {rows}=await db.query('INSERT INTO units(organization_id,name,symbol,allow_fraction) VALUES($1,$2,$3,$4) RETURNING *',[organizationId,name,symbol||null,allowFraction]);return rows[0];}
async function setActive(db,organizationId,kind,id,active){
  const queries={
    category:'UPDATE categories SET active=$3 WHERE organization_id=$1 AND id=$2 RETURNING id,name,active',
    manufacturer:'UPDATE manufacturers SET active=$3 WHERE organization_id=$1 AND id=$2 RETURNING id,name,active',
    unit:'UPDATE units SET active=$3 WHERE organization_id=$1 AND id=$2 RETURNING id,name,active'
  };
  const sql=queries[kind];
  if(!sql)return null;
  const {rows}=await db.query(sql,[organizationId,id,active]);
  return rows[0]||null;
}
module.exports={all,category,manufacturer,unit,setActive};
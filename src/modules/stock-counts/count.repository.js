async function businessClock(db,branchId){
  const {rows}=await db.query(
    `SELECT o.timezone,to_char(now() AT TIME ZONE o.timezone,'YYYY-MM-DD') business_date
     FROM branches b JOIN organizations o ON o.id=b.organization_id
     WHERE b.id=$1 LIMIT 1`,
    [branchId]
  );
  return rows[0]||{timezone:'Africa/Dar_es_Salaam',business_date:null};
}

async function list(db,branchId,filters={}){
  const q=String(filters.q||'').trim();
  const term=`%${q}%`;
  const status=String(filters.status||'').trim().toUpperCase();
  const startDate=filters.startDate;
  const endDate=filters.endDate;
  const timezone=filters.timezone||'Africa/Dar_es_Salaam';
  const page=Math.max(1,Number(filters.page)||1);
  const pageSize=Math.min(100,Math.max(1,Number(filters.pageSize)||25));
  const offset=(page-1)*pageSize;
  const params=[branchId,q,term,status,startDate,endDate,timezone];

  const where=`sc.branch_id=$1
    AND ($2='' OR sc.count_number ILIKE $3 OR u.name ILIKE $3)
    AND ($4='' OR sc.status=$4)
    AND sc.started_at >= ($5::date::timestamp AT TIME ZONE $7)
    AND sc.started_at < ($6::date::timestamp AT TIME ZONE $7)`;

  const total=Number((await db.query(
    `SELECT COUNT(*)::int total
     FROM stock_counts sc JOIN users u ON u.id=sc.started_by
     WHERE ${where}`,
    params
  )).rows[0]?.total||0);

  const {rows}=await db.query(
    `SELECT sc.*,u.name started_by_name
     FROM stock_counts sc
     JOIN users u ON u.id=sc.started_by
     WHERE ${where}
     ORDER BY sc.started_at DESC,sc.id DESC
     LIMIT $8 OFFSET $9`,
    [...params,pageSize,offset]
  );
  return {rows,total};
}

async function create(db,d){const {rows}=await db.query(`INSERT INTO stock_counts(organization_id,branch_id,count_number,started_by) VALUES($1,$2,$3,$4) RETURNING *`,[d.organizationId,d.branchId,d.number,d.userId]);return rows[0];}
async function snapshot(db,countId,branchId){await db.query(`INSERT INTO stock_count_items(stock_count_id,medicine_id,batch_id,system_quantity) SELECT $1,b.medicine_id,b.id,b.quantity_available FROM medicine_batches b WHERE b.branch_id=$2 AND b.quantity_available>0`,[countId,branchId]);}
async function detail(db,branchId,id,lock=false){const suffix=lock?' FOR UPDATE':'';const count=(await db.query(`SELECT * FROM stock_counts WHERE branch_id=$1 AND id=$2${suffix}`,[branchId,id])).rows[0];if(!count)return null;const {rows}=await db.query(`SELECT sci.*,m.name,m.strength,b.batch_number,b.expiry_date,u.name unit_name,COALESCE(u.allow_fraction,false) allow_fraction FROM stock_count_items sci JOIN medicines m ON m.id=sci.medicine_id LEFT JOIN units u ON u.id=m.base_unit_id LEFT JOIN medicine_batches b ON b.id=sci.batch_id WHERE sci.stock_count_id=$1 ORDER BY m.name,b.expiry_date NULLS LAST`,[id]);return {count,items:rows};}
async function lockBatch(db,id){const {rows}=await db.query('SELECT * FROM medicine_batches WHERE id=$1 FOR UPDATE',[id]);return rows[0]||null;}
async function updateItem(db,id,counted,diff){await db.query('UPDATE stock_count_items SET counted_quantity=$2,difference=$3 WHERE id=$1',[id,counted,diff]);}
async function updateBatch(db,id,qty){await db.query(`UPDATE medicine_batches SET quantity_available=$2::numeric,status=CASE WHEN $2::numeric=0 THEN 'DEPLETED' WHEN status='DEPLETED' THEN 'SALEABLE' ELSE status END WHERE id=$1`,[id,qty]);}
async function movement(db,d){await db.query(`INSERT INTO stock_movements(organization_id,branch_id,medicine_id,batch_id,movement_type,quantity,unit_cost,reference_type,reference_id,performed_by) VALUES($1,$2,$3,$4,'STOCK_COUNT',$5,$6,'STOCK_COUNT',$7,$8)`,[d.organizationId,d.branchId,d.medicineId,d.batchId,d.quantity,d.unitCost,d.countId,d.userId]);}
async function complete(db,id){await db.query(`UPDATE stock_counts SET status='COMPLETED',completed_at=now() WHERE id=$1`,[id]);}
module.exports={businessClock,list,create,snapshot,detail,lockBatch,updateItem,updateBatch,movement,complete};
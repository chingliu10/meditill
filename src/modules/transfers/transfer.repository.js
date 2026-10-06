async function businessClock(db,branchId){
  const {rows}=await db.query(
    `SELECT o.timezone,to_char(now() AT TIME ZONE o.timezone,'YYYY-MM-DD') business_date
     FROM branches b JOIN organizations o ON o.id=b.organization_id
     WHERE b.id=$1 LIMIT 1`,
    [branchId]
  );
  return rows[0]||{timezone:'Africa/Dar_es_Salaam',business_date:null};
}

async function list(db,organizationId,branchId,filters={}){
  const q=String(filters.q||'').trim();
  const term=`%${q}%`;
  const status=String(filters.status||'').trim().toUpperCase();
  const startDate=filters.startDate;
  const endDate=filters.endDate;
  const timezone=filters.timezone||'Africa/Dar_es_Salaam';
  const page=Math.max(1,Number(filters.page)||1);
  const pageSize=Math.min(100,Math.max(1,Number(filters.pageSize)||25));
  const offset=(page-1)*pageSize;
  const params=[organizationId,branchId,q,term,status,startDate,endDate,timezone];

  const where=`t.organization_id=$1
    AND (t.from_branch_id=$2 OR t.to_branch_id=$2)
    AND ($3='' OR t.transfer_number ILIKE $4 OR fb.name ILIKE $4 OR tb.name ILIKE $4)
    AND ($5='' OR t.status=$5)
    AND t.created_at >= ($6::date::timestamp AT TIME ZONE $8)
    AND t.created_at < ($7::date::timestamp AT TIME ZONE $8)`;

  const total=Number((await db.query(
    `SELECT COUNT(*)::int total
     FROM stock_transfers t
     JOIN branches fb ON fb.id=t.from_branch_id
     JOIN branches tb ON tb.id=t.to_branch_id
     WHERE ${where}`,
    params
  )).rows[0]?.total||0);

  const {rows}=await db.query(
    `SELECT t.*,fb.name from_branch,tb.name to_branch,u.name created_by_name
     FROM stock_transfers t
     JOIN branches fb ON fb.id=t.from_branch_id
     JOIN branches tb ON tb.id=t.to_branch_id
     JOIN users u ON u.id=t.created_by
     WHERE ${where}
     ORDER BY t.created_at DESC,t.id DESC
     LIMIT $9 OFFSET $10`,
    [...params,pageSize,offset]
  );
  return {rows,total};
}

async function destinations(db,organizationId,branchId){const {rows}=await db.query('SELECT id,name FROM branches WHERE organization_id=$1 AND id<>$2 AND active=true ORDER BY name',[organizationId,branchId]);return rows;}
async function sourceBatches(db,branchId){const {rows}=await db.query(`SELECT b.id,m.name,m.strength,b.batch_number,b.expiry_date,b.quantity_available,u.name unit_name,COALESCE(u.allow_fraction,false) allow_fraction FROM medicine_batches b JOIN medicines m ON m.id=b.medicine_id LEFT JOIN units u ON u.id=m.base_unit_id WHERE b.branch_id=$1 AND b.status='SALEABLE' AND b.quantity_available>0 ORDER BY m.name,b.expiry_date NULLS LAST`,[branchId]);return rows;}
async function lockBatch(db,branchId,id){
  const {rows}=await db.query(
    `SELECT * FROM medicine_batches WHERE branch_id=$1 AND id=$2 FOR UPDATE`,
    [branchId,id]
  );
  const batch=rows[0]||null;
  if(!batch) return null;
  const meta=await db.query(
    `SELECT m.name medicine_name,u.name unit_name,COALESCE(u.allow_fraction,false) allow_fraction
     FROM medicines m
     LEFT JOIN units u ON u.id=m.base_unit_id
     WHERE m.id=$1
     LIMIT 1`,
    [batch.medicine_id]
  );
  return {...batch,...(meta.rows[0]||{})};
}
async function create(db,d){const {rows}=await db.query(`INSERT INTO stock_transfers(organization_id,from_branch_id,to_branch_id,transfer_number,status,created_by,sent_at) VALUES($1,$2,$3,$4,'IN_TRANSIT',$5,now()) RETURNING *`,[d.organizationId,d.fromBranchId,d.toBranchId,d.number,d.userId]);return rows[0];}
async function item(db,transferId,batch,qty){await db.query('INSERT INTO stock_transfer_items(transfer_id,medicine_id,batch_id,quantity) VALUES($1,$2,$3,$4)',[transferId,batch.medicine_id,batch.id,qty]);}
async function deduct(db,batchId,qty){await db.query(`UPDATE medicine_batches SET quantity_available=quantity_available-$2::numeric,status=CASE WHEN quantity_available-$2::numeric=0 THEN 'DEPLETED' ELSE status END WHERE id=$1`,[batchId,qty]);}
async function transferDetail(db,id){const t=(await db.query('SELECT * FROM stock_transfers WHERE id=$1 FOR UPDATE',[id])).rows[0];if(!t)return null;const items=(await db.query(`SELECT ti.*,b.batch_number,b.expiry_date,b.manufacturing_date,b.unit_cost,b.default_selling_price FROM stock_transfer_items ti JOIN medicine_batches b ON b.id=ti.batch_id WHERE ti.transfer_id=$1`,[id])).rows;return {transfer:t,items};}
async function receiveBatch(db,organizationId,branchId,item){const {rows}=await db.query(`INSERT INTO medicine_batches(organization_id,branch_id,medicine_id,batch_number,manufacturing_date,expiry_date,unit_cost,default_selling_price,quantity_received,quantity_available,status) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$9,'SALEABLE') RETURNING *`,[organizationId,branchId,item.medicine_id,item.batch_number,item.manufacturing_date,item.expiry_date,item.unit_cost,item.default_selling_price,item.quantity]);return rows[0];}
async function markReceived(db,id,userId){await db.query(`UPDATE stock_transfers SET status='RECEIVED',received_at=now(),received_by=$2 WHERE id=$1`,[id,userId]);}
async function movement(db,d){await db.query(`INSERT INTO stock_movements(organization_id,branch_id,medicine_id,batch_id,movement_type,quantity,unit_cost,reference_type,reference_id,performed_by) VALUES($1,$2,$3,$4,$5,$6,$7,'TRANSFER',$8,$9)`,[d.organizationId,d.branchId,d.medicineId,d.batchId,d.type,d.quantity,d.unitCost,d.transferId,d.userId]);}
module.exports={businessClock,list,destinations,sourceBatches,lockBatch,create,item,deduct,transferDetail,receiveBatch,markReceived,movement};
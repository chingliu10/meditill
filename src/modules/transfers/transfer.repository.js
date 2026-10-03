async function list(db,organizationId,branchId){const {rows}=await db.query(`SELECT t.*,fb.name from_branch,tb.name to_branch,u.name created_by_name FROM stock_transfers t JOIN branches fb ON fb.id=t.from_branch_id JOIN branches tb ON tb.id=t.to_branch_id JOIN users u ON u.id=t.created_by WHERE t.organization_id=$1 AND (t.from_branch_id=$2 OR t.to_branch_id=$2) ORDER BY t.created_at DESC LIMIT 100`,[organizationId,branchId]);return rows;}
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
module.exports={list,destinations,sourceBatches,lockBatch,create,item,deduct,transferDetail,receiveBatch,markReceived,movement};
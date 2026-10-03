async function stock(db,organizationId,branchId){const {rows}=await db.query(`SELECT m.id,m.name,m.generic_name,m.strength,m.reorder_level,m.image_path,u.name unit_name,COALESCE(sum(b.quantity_available) FILTER(WHERE b.status='SALEABLE' AND b.quantity_available>0 AND (b.expiry_date IS NULL OR b.expiry_date>=current_date)),0) saleable_stock,COALESCE(sum(b.quantity_available*b.unit_cost) FILTER(WHERE b.status='SALEABLE' AND b.quantity_available>0 AND (b.expiry_date IS NULL OR b.expiry_date>=current_date)),0) stock_value,min(b.expiry_date) FILTER(WHERE b.status='SALEABLE' AND b.quantity_available>0 AND b.expiry_date>=current_date) next_expiry FROM medicines m LEFT JOIN units u ON u.id=m.base_unit_id LEFT JOIN medicine_batches b ON b.medicine_id=m.id AND b.branch_id=$2 WHERE m.organization_id=$1 AND m.active=true GROUP BY m.id,u.id ORDER BY m.name`,[organizationId,branchId]);return rows;}
async function batches(db,branchId,q=''){const term=`%${String(q||'').trim()}%`;const {rows}=await db.query(`SELECT b.id,b.medicine_id,m.name,m.strength,b.batch_number,b.expiry_date,b.quantity_available,b.quantity_received,b.unit_cost,b.status,b.received_at,u.name unit_name,COALESCE(u.allow_fraction,false) allow_fraction FROM medicine_batches b JOIN medicines m ON m.id=b.medicine_id LEFT JOIN units u ON u.id=m.base_unit_id WHERE b.branch_id=$1 AND b.quantity_available>0 AND ($2='' OR m.name ILIKE $3 OR COALESCE(b.batch_number,'') ILIKE $3) ORDER BY CASE WHEN b.expiry_date IS NULL THEN 1 ELSE 0 END,b.expiry_date,b.id LIMIT 300`,[branchId,String(q||'').trim(),term]);return rows;}
async function expiring(db,branchId,days=90){const safeDays=Math.max(0,Math.min(Number(days)||90,3650));const {rows}=await db.query(`SELECT b.id,m.name,m.strength,b.batch_number,b.expiry_date,b.quantity_available,b.unit_cost,b.quantity_available*b.unit_cost value_at_risk FROM medicine_batches b JOIN medicines m ON m.id=b.medicine_id WHERE b.branch_id=$1 AND b.quantity_available>0 AND b.expiry_date IS NOT NULL AND b.expiry_date BETWEEN current_date AND current_date+$2::int ORDER BY b.expiry_date,b.id`,[branchId,safeDays]);return rows;}
async function lockBatch(db,branchId,batchId){
  const {rows}=await db.query(
    `SELECT *
     FROM medicine_batches
     WHERE branch_id=$1 AND id=$2
     FOR UPDATE`,
    [branchId,batchId]
  );
  const batch=rows[0]||null;
  if(!batch) return null;

  const meta=await db.query(
    `SELECT m.name medicine_name,
            u.name unit_name,
            COALESCE(u.allow_fraction,false) allow_fraction
     FROM medicines m
     LEFT JOIN units u ON u.id=m.base_unit_id
     WHERE m.id=$1
     LIMIT 1`,
    [batch.medicine_id]
  );

  return {...batch,...(meta.rows[0]||{})};
}
async function createAdjustment(db,data){const {rows}=await db.query(`INSERT INTO stock_adjustments(organization_id,branch_id,adjustment_number,reason,notes,created_by) VALUES($1,$2,$3,$4,$5,$6) RETURNING *`,[data.organizationId,data.branchId,data.number,data.reason,data.notes||null,data.userId]);return rows[0];}
async function createAdjustmentItem(db,adjustmentId,batch,change,notes){await db.query(`INSERT INTO stock_adjustment_items(adjustment_id,medicine_id,batch_id,quantity_change,notes) VALUES($1,$2,$3,$4,$5)`,[adjustmentId,batch.medicine_id,batch.id,change,notes||null]);}
async function updateBatchQuantity(db,batchId,newQty){const {rows}=await db.query(`UPDATE medicine_batches SET quantity_available=$2::numeric,status=CASE WHEN $2::numeric=0 THEN 'DEPLETED' WHEN status='DEPLETED' THEN 'SALEABLE' ELSE status END WHERE id=$1 RETURNING *`,[batchId,newQty]);return rows[0];}
async function movement(db,data){await db.query(`INSERT INTO stock_movements(organization_id,branch_id,medicine_id,batch_id,movement_type,quantity,unit_cost,reference_type,reference_id,notes,performed_by) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)`,[data.organizationId,data.branchId,data.medicineId,data.batchId,data.type,data.quantity,data.unitCost,data.referenceType,data.referenceId,data.notes||null,data.userId]);}
async function setBatchStatus(db,branchId,batchId,status){const {rows}=await db.query(`UPDATE medicine_batches SET status=$3 WHERE branch_id=$1 AND id=$2 AND quantity_available>0 RETURNING *`,[branchId,batchId,status]);return rows[0]||null;}
module.exports={stock,batches,expiring,lockBatch,createAdjustment,createAdjustmentItem,updateBatchQuantity,movement,setBatchStatus};
async function metrics(db,organizationId,branchId){
  const {rows}=await db.query(
    `SELECT
      COALESCE((SELECT sum(total) FROM sales WHERE organization_id=$1 AND branch_id=$2 AND status='COMPLETED' AND created_at::date=current_date),0) sales_today,
      COALESCE((SELECT count(*) FROM sales WHERE organization_id=$1 AND branch_id=$2 AND status='COMPLETED' AND created_at::date=current_date),0) transactions_today,
      COALESCE((SELECT count(*) FROM medicines m WHERE m.organization_id=$1 AND m.active=true AND
        COALESCE((SELECT sum(b.quantity_available) FROM medicine_batches b WHERE b.medicine_id=m.id AND b.branch_id=$2 AND b.status='SALEABLE'),0)<=m.reorder_level),0) low_stock,
      COALESCE((SELECT count(*) FROM medicine_batches WHERE branch_id=$2 AND status='SALEABLE' AND expiry_date BETWEEN current_date AND current_date+30),0) expiring_30`,
    [organizationId,branchId]);
  return rows[0];
}
module.exports={metrics};

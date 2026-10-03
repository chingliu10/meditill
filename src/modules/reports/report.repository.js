async function businessClock(db,branchId){
  const {rows}=await db.query(
    `SELECT o.timezone,to_char(now() AT TIME ZONE o.timezone,'YYYY-MM-DD') business_date
     FROM branches b JOIN organizations o ON o.id=b.organization_id
     WHERE b.id=$1 LIMIT 1`,
    [branchId]
  );
  return rows[0]||{timezone:'Africa/Dar_es_Salaam',business_date:null};
}
async function salesSummary(db,branchId,from,to,timezone='Africa/Dar_es_Salaam'){
  const {rows}=await db.query(
    `WITH filtered_sales AS (
      SELECT s.id,s.total,COALESCE((SELECT SUM(sr.total_refund) FROM sale_returns sr WHERE sr.sale_id=s.id),0) refunds
      FROM sales s WHERE s.branch_id=$1 AND s.status IN('COMPLETED','PARTIALLY_REFUNDED','REFUNDED')
        AND (s.created_at AT TIME ZONE $4)::date >= $2::date
        AND (s.created_at AT TIME ZONE $4)::date <= $3::date
    ),
    costs AS (
      SELECT si.sale_id,SUM(sib.quantity*sib.unit_cost) cost
      FROM sale_items si JOIN sale_item_batches sib ON sib.sale_item_id=si.id JOIN filtered_sales fs ON fs.id=si.sale_id GROUP BY si.sale_id
    ),
    returned_cost AS (
      SELECT sr.sale_id,SUM(sri.quantity*mb.unit_cost) cost
      FROM sale_returns sr JOIN sale_return_items sri ON sri.sale_return_id=sr.id JOIN medicine_batches mb ON mb.id=sri.batch_id
      JOIN filtered_sales fs ON fs.id=sr.sale_id GROUP BY sr.sale_id
    )
    SELECT COUNT(fs.id)::int transactions,
      COALESCE(SUM(fs.total-fs.refunds),0) revenue,
      COALESCE(SUM(COALESCE(c.cost,0)-COALESCE(rc.cost,0)),0) cost,
      COALESCE(SUM(fs.total-fs.refunds)-SUM(COALESCE(c.cost,0)-COALESCE(rc.cost,0)),0) gross_profit
    FROM filtered_sales fs LEFT JOIN costs c ON c.sale_id=fs.id LEFT JOIN returned_cost rc ON rc.sale_id=fs.id`,
    [branchId,from,to,timezone]);return rows[0];
}
async function daily(db,branchId,from,to,timezone='Africa/Dar_es_Salaam'){
  const {rows}=await db.query(
    `SELECT (s.created_at AT TIME ZONE $4)::date sale_date,COUNT(*)::int transactions,
      COALESCE(SUM(s.total-COALESCE((SELECT SUM(sr.total_refund) FROM sale_returns sr WHERE sr.sale_id=s.id),0)),0) revenue
     FROM sales s
     WHERE s.branch_id=$1 AND s.status IN('COMPLETED','PARTIALLY_REFUNDED','REFUNDED')
       AND (s.created_at AT TIME ZONE $4)::date >= $2::date
       AND (s.created_at AT TIME ZONE $4)::date <= $3::date
     GROUP BY (s.created_at AT TIME ZONE $4)::date ORDER BY sale_date DESC`,
    [branchId,from,to,timezone]);return rows;
}
async function inventory(db,organizationId,branchId){const {rows}=await db.query(`SELECT m.name,m.strength,u.name unit_name,COALESCE(SUM(b.quantity_available) FILTER(WHERE b.status='SALEABLE' AND (b.expiry_date IS NULL OR b.expiry_date>=current_date)),0) quantity,COALESCE(SUM(b.quantity_available*b.unit_cost) FILTER(WHERE b.status='SALEABLE' AND (b.expiry_date IS NULL OR b.expiry_date>=current_date)),0) value FROM medicines m LEFT JOIN units u ON u.id=m.base_unit_id LEFT JOIN medicine_batches b ON b.medicine_id=m.id AND b.branch_id=$2 WHERE m.organization_id=$1 AND m.active=true GROUP BY m.id,u.id ORDER BY value DESC,m.name`,[organizationId,branchId]);return rows;}
async function purchases(db,branchId,from,to){const {rows}=await db.query(`SELECT p.purchase_date::date purchase_date,COUNT(*)::int purchases,COALESCE(SUM(p.total-COALESCE((SELECT SUM(pr.total_value) FROM purchase_returns pr WHERE pr.purchase_id=p.id),0)),0) total FROM purchases p WHERE p.branch_id=$1 AND p.status='RECEIVED' AND p.purchase_date >= $2::date AND p.purchase_date < ($3::date+interval '1 day') GROUP BY p.purchase_date::date ORDER BY purchase_date DESC`,[branchId,from,to]);return rows;}
async function expiry(db,branchId){const {rows}=await db.query(`SELECT m.name,m.strength,b.batch_number,b.expiry_date,b.quantity_available,b.unit_cost,b.quantity_available*b.unit_cost value_at_risk,CASE WHEN b.expiry_date<current_date THEN 'EXPIRED' WHEN b.expiry_date<=current_date+30 THEN '0-30 DAYS' WHEN b.expiry_date<=current_date+60 THEN '31-60 DAYS' ELSE '61-90 DAYS' END bucket FROM medicine_batches b JOIN medicines m ON m.id=b.medicine_id WHERE b.branch_id=$1 AND b.quantity_available>0 AND b.expiry_date IS NOT NULL AND b.expiry_date<=current_date+90 ORDER BY b.expiry_date`,[branchId]);return rows;}
module.exports={businessClock,salesSummary,daily,inventory,purchases,expiry};
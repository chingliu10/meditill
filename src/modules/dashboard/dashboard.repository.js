async function metrics(db,organizationId,branchId){
  const {rows}=await db.query(
    `WITH today_sales AS (
      SELECT id,total
      FROM sales
      WHERE organization_id=$1
        AND branch_id=$2
        AND status IN('COMPLETED','PARTIALLY_REFUNDED')
        AND created_at::date=current_date
    ),
    today_cost AS (
      SELECT COALESCE(SUM(sib.quantity*sib.unit_cost),0) cost
      FROM sale_items si
      JOIN sale_item_batches sib ON sib.sale_item_id=si.id
      JOIN today_sales ts ON ts.id=si.sale_id
    )
    SELECT
      COALESCE((SELECT SUM(total) FROM today_sales),0) sales_today,
      COALESCE((SELECT COUNT(*) FROM today_sales),0)::int transactions_today,
      COALESCE((SELECT SUM(total) FROM today_sales),0) - COALESCE((SELECT cost FROM today_cost),0) gross_profit_today,
      COALESCE((
        SELECT SUM(total)
        FROM purchases
        WHERE organization_id=$1
          AND branch_id=$2
          AND status='RECEIVED'
          AND purchase_date::date=current_date
      ),0) purchases_today,
      COALESCE((
        SELECT COUNT(*)
        FROM medicines m
        WHERE m.organization_id=$1
          AND m.active=true
          AND COALESCE((
            SELECT SUM(b.quantity_available)
            FROM medicine_batches b
            WHERE b.medicine_id=m.id
              AND b.branch_id=$2
              AND b.status='SALEABLE'
              AND b.quantity_available>0
              AND (b.expiry_date IS NULL OR b.expiry_date>=current_date)
          ),0)<=m.reorder_level
      ),0)::int low_stock,
      COALESCE((
        SELECT COUNT(*)
        FROM medicines m
        WHERE m.organization_id=$1
          AND m.active=true
          AND COALESCE((
            SELECT SUM(b.quantity_available)
            FROM medicine_batches b
            WHERE b.medicine_id=m.id
              AND b.branch_id=$2
              AND b.status='SALEABLE'
              AND b.quantity_available>0
              AND (b.expiry_date IS NULL OR b.expiry_date>=current_date)
          ),0)=0
      ),0)::int out_of_stock,
      COALESCE((
        SELECT COUNT(*)
        FROM medicine_batches
        WHERE branch_id=$2
          AND status='SALEABLE'
          AND quantity_available>0
          AND expiry_date BETWEEN current_date AND current_date+30
      ),0)::int expiring_30,
      COALESCE((
        SELECT COUNT(*)
        FROM medicine_batches
        WHERE branch_id=$2
          AND quantity_available>0
          AND expiry_date<current_date
      ),0)::int expired_batches`,
    [organizationId,branchId]
  );
  return rows[0];
}

async function topSelling(db,branchId){
  const {rows}=await db.query(
    `SELECT
      m.id,
      m.name,
      m.strength,
      m.image_path,
      SUM(si.quantity) quantity_sold,
      SUM(si.line_total) revenue
     FROM sale_items si
     JOIN sales s ON s.id=si.sale_id
     JOIN medicines m ON m.id=si.medicine_id
     WHERE s.branch_id=$1
       AND s.status IN('COMPLETED','PARTIALLY_REFUNDED')
       AND s.created_at>=current_date-interval '30 days'
     GROUP BY m.id
     ORDER BY quantity_sold DESC,revenue DESC
     LIMIT 6`,
    [branchId]
  );
  return rows;
}

async function expiryRisk(db,branchId){
  const {rows}=await db.query(
    `SELECT
      m.name,
      m.strength,
      b.batch_number,
      b.expiry_date,
      b.quantity_available,
      b.quantity_available*b.unit_cost value_at_risk
     FROM medicine_batches b
     JOIN medicines m ON m.id=b.medicine_id
     WHERE b.branch_id=$1
       AND b.quantity_available>0
       AND b.expiry_date IS NOT NULL
       AND b.expiry_date<=current_date+90
     ORDER BY b.expiry_date,b.quantity_available*b.unit_cost DESC
     LIMIT 6`,
    [branchId]
  );
  return rows;
}

async function recentSales(db,branchId){
  const {rows}=await db.query(
    `SELECT
      s.sale_number,
      s.total,
      s.created_at,
      u.name cashier
     FROM sales s
     JOIN users u ON u.id=s.user_id
     WHERE s.branch_id=$1
       AND s.status IN('COMPLETED','PARTIALLY_REFUNDED')
     ORDER BY s.created_at DESC
     LIMIT 6`,
    [branchId]
  );
  return rows;
}

module.exports={metrics,topSelling,expiryRisk,recentSales};

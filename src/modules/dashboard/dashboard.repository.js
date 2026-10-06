async function access(db,userId){
  const {rows}=await db.query(
    `SELECT
       COALESCE(bool_or(r.name='OWNER'),false) is_owner,
       COALESCE(array_agg(DISTINCT p.code) FILTER(WHERE p.code IS NOT NULL),'{}') permissions
     FROM users u
     LEFT JOIN user_roles ur ON ur.user_id=u.id
     LEFT JOIN roles r ON r.id=ur.role_id
     LEFT JOIN role_permissions rp ON rp.role_id=ur.role_id
     LEFT JOIN permissions p ON p.id=rp.permission_id
     WHERE u.id=$1
     GROUP BY u.id`,
    [userId]
  );
  return rows[0]||{is_owner:false,permissions:[]};
}

async function businessClock(db,organizationId){
  const {rows}=await db.query(
    `SELECT timezone,to_char(now() AT TIME ZONE timezone,'YYYY-MM-DD') business_date
     FROM organizations
     WHERE id=$1
     LIMIT 1`,
    [organizationId]
  );
  return rows[0]||{timezone:'Africa/Dar_es_Salaam',business_date:new Date().toISOString().slice(0,10)};
}

function rangeSql(column,startParam,endParam,tzParam){
  return `${column} >= ($${startParam}::date::timestamp AT TIME ZONE $${tzParam})
      AND ${column} < ($${endParam}::date::timestamp AT TIME ZONE $${tzParam})`;
}

async function salesMetrics(db,organizationId,branchId,startDate,endDate,timezone){
  const {rows}=await db.query(
    `WITH period_sales AS (
      SELECT s.id,s.total,
        COALESCE((SELECT SUM(sr.total_refund) FROM sale_returns sr WHERE sr.sale_id=s.id),0) refunds
      FROM sales s
      WHERE s.organization_id=$1 AND s.branch_id=$2
        AND s.status IN('COMPLETED','PARTIALLY_REFUNDED','REFUNDED')
        AND ${rangeSql('s.created_at',3,4,5)}
    )
    SELECT
      COALESCE(SUM(total-refunds),0)::numeric sales_period,
      COUNT(*)::int transactions_period
    FROM period_sales`,
    [organizationId,branchId,startDate,endDate,timezone]
  );
  return rows[0];
}

async function profitMetric(db,organizationId,branchId,startDate,endDate,timezone){
  const {rows}=await db.query(
    `WITH period_sales AS (
      SELECT s.id,s.total,
        COALESCE((SELECT SUM(sr.total_refund) FROM sale_returns sr WHERE sr.sale_id=s.id),0) refunds
      FROM sales s
      WHERE s.organization_id=$1 AND s.branch_id=$2
        AND s.status IN('COMPLETED','PARTIALLY_REFUNDED','REFUNDED')
        AND ${rangeSql('s.created_at',3,4,5)}
    ),
    period_cost AS (
      SELECT COALESCE(SUM(sib.quantity*sib.unit_cost),0) original_cost
      FROM sale_items si
      JOIN sale_item_batches sib ON sib.sale_item_id=si.id
      JOIN period_sales ps ON ps.id=si.sale_id
    ),
    returned_cost AS (
      SELECT COALESCE(SUM(sri.quantity*mb.unit_cost),0) returned_cost
      FROM sale_return_items sri
      JOIN sale_returns sr ON sr.id=sri.sale_return_id
      JOIN medicine_batches mb ON mb.id=sri.batch_id
      WHERE sr.sale_id IN(SELECT id FROM period_sales)
    )
    SELECT
      COALESCE((SELECT SUM(total-refunds) FROM period_sales),0)
      -(COALESCE((SELECT original_cost FROM period_cost),0)-COALESCE((SELECT returned_cost FROM returned_cost),0))
      AS gross_profit_period`,
    [organizationId,branchId,startDate,endDate,timezone]
  );
  return rows[0];
}

async function purchaseMetric(db,organizationId,branchId,startDate,endDate,timezone){
  const {rows}=await db.query(
    `SELECT COALESCE(SUM(total),0)::numeric purchases_period
     FROM purchases
     WHERE organization_id=$1 AND branch_id=$2 AND status='RECEIVED'
       AND ${rangeSql('purchase_date',3,4,5)}`,
    [organizationId,branchId,startDate,endDate,timezone]
  );
  return rows[0];
}

async function inventoryHealth(db,organizationId,branchId,businessDate){
  const {rows}=await db.query(
    `SELECT
      COALESCE((SELECT COUNT(*)
        FROM medicines m
        WHERE m.organization_id=$1 AND m.active=true
          AND COALESCE((SELECT SUM(b.quantity_available)
            FROM medicine_batches b
            WHERE b.medicine_id=m.id AND b.branch_id=$2
              AND b.status='SALEABLE' AND b.quantity_available>0
              AND (b.expiry_date IS NULL OR b.expiry_date>=$3::date)),0)<=m.reorder_level),0)::int low_stock,
      COALESCE((SELECT COUNT(*)
        FROM medicines m
        WHERE m.organization_id=$1 AND m.active=true
          AND COALESCE((SELECT SUM(b.quantity_available)
            FROM medicine_batches b
            WHERE b.medicine_id=m.id AND b.branch_id=$2
              AND b.status='SALEABLE' AND b.quantity_available>0
              AND (b.expiry_date IS NULL OR b.expiry_date>=$3::date)),0)=0),0)::int out_of_stock`,
    [organizationId,branchId,businessDate]
  );
  return rows[0];
}

async function expiryHealth(db,branchId,businessDate){
  const {rows}=await db.query(
    `SELECT
      COALESCE((SELECT COUNT(*) FROM medicine_batches
        WHERE branch_id=$1 AND status='SALEABLE' AND quantity_available>0
          AND expiry_date BETWEEN $2::date AND $2::date+30),0)::int expiring_30,
      COALESCE((SELECT COUNT(*) FROM medicine_batches
        WHERE branch_id=$1 AND quantity_available>0 AND expiry_date<$2::date),0)::int expired_batches`,
    [branchId,businessDate]
  );
  return rows[0];
}

async function topSelling(db,branchId,startDate,endDate,timezone){
  const {rows}=await db.query(
    `WITH period_sales AS (
      SELECT id
      FROM sales
      WHERE branch_id=$1
        AND status IN('COMPLETED','PARTIALLY_REFUNDED','REFUNDED')
        AND ${rangeSql('created_at',2,3,4)}
    ),
    item_returns AS (
      SELECT
        sri.sale_item_id,
        COALESCE(SUM(sri.quantity),0) returned_quantity,
        COALESCE(SUM(sri.refund_amount),0) refund_amount
      FROM sale_return_items sri
      JOIN sale_returns sr ON sr.id=sri.sale_return_id
      WHERE sr.sale_id IN(SELECT id FROM period_sales)
      GROUP BY sri.sale_item_id
    )
    SELECT
      m.id,m.name,m.strength,m.image_path,
      SUM(si.quantity-COALESCE(ir.returned_quantity,0)) quantity_sold,
      SUM(si.line_total-COALESCE(ir.refund_amount,0)) revenue
    FROM sale_items si
    JOIN period_sales ps ON ps.id=si.sale_id
    JOIN medicines m ON m.id=si.medicine_id
    LEFT JOIN item_returns ir ON ir.sale_item_id=si.id
    GROUP BY m.id
    HAVING
      SUM(si.quantity-COALESCE(ir.returned_quantity,0))>0
      OR SUM(si.line_total-COALESCE(ir.refund_amount,0))>0
    ORDER BY quantity_sold DESC,revenue DESC
    LIMIT 6`,
    [branchId,startDate,endDate,timezone]
  );
  return rows;
}

async function expiryRisk(db,branchId,businessDate){
  const {rows}=await db.query(
    `SELECT m.name,m.strength,b.batch_number,b.expiry_date,b.quantity_available,
            b.quantity_available*b.unit_cost value_at_risk
     FROM medicine_batches b
     JOIN medicines m ON m.id=b.medicine_id
     WHERE b.branch_id=$1 AND b.quantity_available>0
       AND b.expiry_date IS NOT NULL
       AND b.expiry_date<=$2::date+90
     ORDER BY b.expiry_date,b.quantity_available*b.unit_cost DESC
     LIMIT 6`,
    [branchId,businessDate]
  );
  return rows;
}

async function recentSales(db,branchId,startDate,endDate,timezone){
  const {rows}=await db.query(
    `SELECT s.sale_number,
            s.total-COALESCE((SELECT SUM(sr.total_refund) FROM sale_returns sr WHERE sr.sale_id=s.id),0) total,
            s.created_at,u.name cashier
     FROM sales s
     JOIN users u ON u.id=s.user_id
     WHERE s.branch_id=$1
       AND s.status IN('COMPLETED','PARTIALLY_REFUNDED','REFUNDED')
       AND ${rangeSql('s.created_at',2,3,4)}
     ORDER BY s.created_at DESC
     LIMIT 6`,
    [branchId,startDate,endDate,timezone]
  );
  return rows;
}

module.exports={
  access,
  businessClock,
  salesMetrics,
  profitMetric,
  purchaseMetric,
  inventoryHealth,
  expiryHealth,
  topSelling,
  expiryRisk,
  recentSales
};

async function stock(db,organizationId,branchId){
  const {rows}=await db.query(
    `SELECT
      m.id,
      m.name,
      m.generic_name,
      m.strength,
      m.reorder_level,
      COALESCE(
        sum(b.quantity_available) FILTER(
          WHERE b.status='SALEABLE'
            AND b.quantity_available>0
            AND (b.expiry_date IS NULL OR b.expiry_date>=current_date)
        ),
        0
      ) saleable_stock,
      COALESCE(
        sum(b.quantity_available*b.unit_cost) FILTER(
          WHERE b.status='SALEABLE'
            AND b.quantity_available>0
            AND (b.expiry_date IS NULL OR b.expiry_date>=current_date)
        ),
        0
      ) stock_value,
      min(b.expiry_date) FILTER(
        WHERE b.status='SALEABLE'
          AND b.quantity_available>0
          AND b.expiry_date>=current_date
      ) next_expiry
     FROM medicines m
     LEFT JOIN medicine_batches b
       ON b.medicine_id=m.id
      AND b.branch_id=$2
     WHERE m.organization_id=$1
       AND m.active=true
     GROUP BY m.id
     ORDER BY m.name`,
    [organizationId,branchId]
  );
  return rows;
}

async function expiring(db,branchId,days=90){
  const safeDays=Math.max(0,Math.min(Number(days)||90,3650));
  const {rows}=await db.query(
    `SELECT
      b.id,
      m.name,
      m.strength,
      b.batch_number,
      b.expiry_date,
      b.quantity_available,
      b.unit_cost,
      b.quantity_available*b.unit_cost value_at_risk
     FROM medicine_batches b
     JOIN medicines m ON m.id=b.medicine_id
     WHERE b.branch_id=$1
       AND b.status='SALEABLE'
       AND b.quantity_available>0
       AND b.expiry_date IS NOT NULL
       AND b.expiry_date BETWEEN current_date AND current_date+$2::int
     ORDER BY b.expiry_date,b.id`,
    [branchId,safeDays]
  );
  return rows;
}

module.exports={stock,expiring};

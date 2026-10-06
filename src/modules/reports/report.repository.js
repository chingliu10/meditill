async function businessClock(db,branchId){
  const {rows}=await db.query(
    `SELECT o.timezone,to_char(now() AT TIME ZONE o.timezone,'YYYY-MM-DD') business_date
     FROM branches b JOIN organizations o ON o.id=b.organization_id
     WHERE b.id=$1 LIMIT 1`,
    [branchId]
  );
  return rows[0]||{timezone:'Africa/Dar_es_Salaam',business_date:null};
}

async function salesSummary(db,branchId,startDate,endDate,timezone='Africa/Dar_es_Salaam'){
  const {rows}=await db.query(
    `WITH filtered_sales AS (
      SELECT s.id,s.total
      FROM sales s
      WHERE s.branch_id=$1
        AND s.status IN('COMPLETED','PARTIALLY_REFUNDED','REFUNDED')
        AND s.created_at >= ($2::date::timestamp AT TIME ZONE $4)
        AND s.created_at < ($3::date::timestamp AT TIME ZONE $4)
    ),
    refunds AS (
      SELECT sr.sale_id,SUM(sr.total_refund) refunds
      FROM sale_returns sr
      JOIN filtered_sales fs ON fs.id=sr.sale_id
      GROUP BY sr.sale_id
    ),
    costs AS (
      SELECT si.sale_id,SUM(sib.quantity*sib.unit_cost) cost
      FROM sale_items si
      JOIN filtered_sales fs ON fs.id=si.sale_id
      JOIN sale_item_batches sib ON sib.sale_item_id=si.id
      GROUP BY si.sale_id
    ),
    returned_cost AS (
      SELECT sr.sale_id,SUM(sri.quantity*mb.unit_cost) cost
      FROM sale_returns sr
      JOIN filtered_sales fs ON fs.id=sr.sale_id
      JOIN sale_return_items sri ON sri.sale_return_id=sr.id
      JOIN medicine_batches mb ON mb.id=sri.batch_id
      GROUP BY sr.sale_id
    )
    SELECT COUNT(fs.id)::int transactions,
      COALESCE(SUM(fs.total-COALESCE(r.refunds,0)),0) revenue,
      COALESCE(SUM(COALESCE(c.cost,0)-COALESCE(rc.cost,0)),0) cost,
      COALESCE(
        SUM(fs.total-COALESCE(r.refunds,0))
        - SUM(COALESCE(c.cost,0)-COALESCE(rc.cost,0)),
        0
      ) gross_profit
    FROM filtered_sales fs
    LEFT JOIN refunds r ON r.sale_id=fs.id
    LEFT JOIN costs c ON c.sale_id=fs.id
    LEFT JOIN returned_cost rc ON rc.sale_id=fs.id`,
    [branchId,startDate,endDate,timezone]
  );
  return rows[0];
}

async function daily(db,branchId,startDate,endDate,timezone='Africa/Dar_es_Salaam'){
  const {rows}=await db.query(
    `WITH filtered_sales AS (
      SELECT s.id,s.total,s.created_at
      FROM sales s
      WHERE s.branch_id=$1
        AND s.status IN('COMPLETED','PARTIALLY_REFUNDED','REFUNDED')
        AND s.created_at >= ($2::date::timestamp AT TIME ZONE $4)
        AND s.created_at < ($3::date::timestamp AT TIME ZONE $4)
    ),
    refunds AS (
      SELECT sr.sale_id,SUM(sr.total_refund) refunds
      FROM sale_returns sr
      JOIN filtered_sales fs ON fs.id=sr.sale_id
      GROUP BY sr.sale_id
    )
    SELECT (fs.created_at AT TIME ZONE $4)::date sale_date,
      COUNT(*)::int transactions,
      COALESCE(SUM(fs.total-COALESCE(r.refunds,0)),0) revenue
    FROM filtered_sales fs
    LEFT JOIN refunds r ON r.sale_id=fs.id
    GROUP BY (fs.created_at AT TIME ZONE $4)::date
    ORDER BY sale_date DESC`,
    [branchId,startDate,endDate,timezone]
  );
  return rows;
}

async function inventory(db,organizationId,branchId,filters={}){
  const q=String(filters.q||'').trim();
  const term=`%${q}%`;
  const page=Math.max(1,Number(filters.page)||1);
  const pageSize=Math.min(100,Math.max(1,Number(filters.pageSize)||25));
  const offset=(page-1)*pageSize;

  const base=`
    SELECT m.id,m.name,m.strength,u.name unit_name,
      COALESCE(SUM(b.quantity_available) FILTER(WHERE b.status='SALEABLE' AND (b.expiry_date IS NULL OR b.expiry_date>=current_date)),0) quantity,
      COALESCE(SUM(b.quantity_available*b.unit_cost) FILTER(WHERE b.status='SALEABLE' AND (b.expiry_date IS NULL OR b.expiry_date>=current_date)),0) value
    FROM medicines m
    LEFT JOIN units u ON u.id=m.base_unit_id
    LEFT JOIN medicine_batches b ON b.medicine_id=m.id AND b.branch_id=$2
    WHERE m.organization_id=$1 AND m.active=true
      AND ($3='' OR m.name ILIKE $4 OR COALESCE(m.generic_name,'') ILIKE $4 OR COALESCE(m.strength,'') ILIKE $4)
    GROUP BY m.id,u.id
  `;

  const params=[organizationId,branchId,q,term];
  const total=Number((await db.query(`SELECT COUNT(*)::int total FROM (${base}) x`,params)).rows[0]?.total||0);
  const {rows}=await db.query(
    `SELECT * FROM (${base}) x ORDER BY value DESC,name LIMIT $5 OFFSET $6`,
    [...params,pageSize,offset]
  );
  return {rows,total};
}

async function purchases(db,branchId,from,to){
  const {rows}=await db.query(
    `SELECT p.purchase_date::date purchase_date,COUNT(*)::int purchases,
      COALESCE(SUM(p.total-COALESCE((SELECT SUM(pr.total_value) FROM purchase_returns pr WHERE pr.purchase_id=p.id),0)),0) total
     FROM purchases p
     WHERE p.branch_id=$1 AND p.status='RECEIVED'
       AND p.purchase_date >= $2::date
       AND p.purchase_date < ($3::date+interval '1 day')
     GROUP BY p.purchase_date::date
     ORDER BY purchase_date DESC`,
    [branchId,from,to]
  );
  return rows;
}

async function expiry(db,branchId,filters={}){
  const q=String(filters.q||'').trim();
  const term=`%${q}%`;
  const days=Math.max(1,Math.min(Number(filters.days)||90,365));
  const page=Math.max(1,Number(filters.page)||1);
  const pageSize=Math.min(100,Math.max(1,Number(filters.pageSize)||25));
  const offset=(page-1)*pageSize;
  const params=[branchId,q,term,days];

  const where=`b.branch_id=$1 AND b.quantity_available>0
    AND b.expiry_date IS NOT NULL
    AND b.expiry_date<=current_date+$4::int
    AND ($2='' OR m.name ILIKE $3 OR COALESCE(m.generic_name,'') ILIKE $3 OR COALESCE(b.batch_number,'') ILIKE $3)`;

  const total=Number((await db.query(
    `SELECT COUNT(*)::int total FROM medicine_batches b JOIN medicines m ON m.id=b.medicine_id WHERE ${where}`,
    params
  )).rows[0]?.total||0);

  const {rows}=await db.query(
    `SELECT m.name,m.strength,b.batch_number,b.expiry_date,b.quantity_available,b.unit_cost,
      b.quantity_available*b.unit_cost value_at_risk,
      CASE
        WHEN b.expiry_date<current_date THEN 'EXPIRED'
        WHEN b.expiry_date<=current_date+30 THEN '0-30 DAYS'
        WHEN b.expiry_date<=current_date+60 THEN '31-60 DAYS'
        ELSE '61-90+ DAYS'
      END bucket
     FROM medicine_batches b
     JOIN medicines m ON m.id=b.medicine_id
     WHERE ${where}
     ORDER BY b.expiry_date,b.id
     LIMIT $5 OFFSET $6`,
    [...params,pageSize,offset]
  );
  return {rows,total};
}

async function profitLoss(db,branchId,startDate,endDate,timezone='Africa/Dar_es_Salaam'){
  const {rows}=await db.query(
    `WITH filtered_sales AS (
      SELECT s.id,s.total
      FROM sales s
      WHERE s.branch_id=$1
        AND s.status IN('COMPLETED','PARTIALLY_REFUNDED','REFUNDED')
        AND s.created_at >= ($2::date::timestamp AT TIME ZONE $4)
        AND s.created_at < ($3::date::timestamp AT TIME ZONE $4)
    ),
    refunds AS (
      SELECT sr.sale_id,SUM(sr.total_refund) refunds
      FROM sale_returns sr
      JOIN filtered_sales fs ON fs.id=sr.sale_id
      GROUP BY sr.sale_id
    ),
    costs AS (
      SELECT si.sale_id,SUM(sib.quantity*sib.unit_cost) cost
      FROM sale_items si
      JOIN filtered_sales fs ON fs.id=si.sale_id
      JOIN sale_item_batches sib ON sib.sale_item_id=si.id
      GROUP BY si.sale_id
    ),
    returned_cost AS (
      SELECT sr.sale_id,SUM(sri.quantity*mb.unit_cost) cost
      FROM sale_returns sr
      JOIN filtered_sales fs ON fs.id=sr.sale_id
      JOIN sale_return_items sri ON sri.sale_return_id=sr.id
      JOIN medicine_batches mb ON mb.id=sri.batch_id
      GROUP BY sr.sale_id
    ),
    sales_totals AS (
      SELECT
        COUNT(fs.id)::int transactions,
        COALESCE(SUM(fs.total-COALESCE(r.refunds,0)),0)::numeric revenue,
        COALESCE(SUM(COALESCE(c.cost,0)-COALESCE(rc.cost,0)),0)::numeric cost
      FROM filtered_sales fs
      LEFT JOIN refunds r ON r.sale_id=fs.id
      LEFT JOIN costs c ON c.sale_id=fs.id
      LEFT JOIN returned_cost rc ON rc.sale_id=fs.id
    ),
    expense_totals AS (
      SELECT COALESCE(SUM(e.amount),0)::numeric operating_expenses
      FROM expenses e
      WHERE e.branch_id=$1
        AND e.created_at >= ($2::date::timestamp AT TIME ZONE $4)
        AND e.created_at < ($3::date::timestamp AT TIME ZONE $4)
    )
    SELECT
      st.transactions,
      st.revenue,
      st.cost,
      (st.revenue-st.cost)::numeric gross_profit,
      et.operating_expenses,
      (st.revenue-st.cost-et.operating_expenses)::numeric net_profit
    FROM sales_totals st
    CROSS JOIN expense_totals et`,
    [branchId,startDate,endDate,timezone]
  );
  return rows[0]||{
    transactions:0,
    revenue:0,
    cost:0,
    gross_profit:0,
    operating_expenses:0,
    net_profit:0
  };
}

async function expenseBreakdown(db,branchId,startDate,endDate,timezone='Africa/Dar_es_Salaam'){
  const {rows}=await db.query(
    `SELECT e.category,COUNT(*)::int entries,COALESCE(SUM(e.amount),0)::numeric total
     FROM expenses e
     WHERE e.branch_id=$1
       AND e.created_at >= ($2::date::timestamp AT TIME ZONE $4)
       AND e.created_at < ($3::date::timestamp AT TIME ZONE $4)
     GROUP BY e.category
     ORDER BY total DESC,e.category`,
    [branchId,startDate,endDate,timezone]
  );
  return rows;
}

module.exports={
  businessClock,
  salesSummary,
  daily,
  inventory,
  purchases,
  expiry,
  profitLoss,
  expenseBreakdown
};

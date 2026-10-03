async function salesSummary(db,branchId,from,to){
  const {rows}=await db.query(
    `WITH filtered_sales AS (
      SELECT id,total
      FROM sales
      WHERE branch_id=$1
        AND status IN('COMPLETED','PARTIALLY_REFUNDED')
        AND created_at >= $2::date
        AND created_at < ($3::date + interval '1 day')
    ),
    costs AS (
      SELECT
        si.sale_id,
        SUM(sib.quantity*sib.unit_cost) AS cost
      FROM sale_items si
      JOIN sale_item_batches sib ON sib.sale_item_id=si.id
      JOIN filtered_sales fs ON fs.id=si.sale_id
      GROUP BY si.sale_id
    )
    SELECT
      COUNT(fs.id)::int AS transactions,
      COALESCE(SUM(fs.total),0) AS revenue,
      COALESCE(SUM(COALESCE(c.cost,0)),0) AS cost,
      COALESCE(SUM(fs.total)-SUM(COALESCE(c.cost,0)),0) AS gross_profit
    FROM filtered_sales fs
    LEFT JOIN costs c ON c.sale_id=fs.id`,
    [branchId,from,to]
  );
  return rows[0];
}

async function daily(db,branchId,from,to){
  const {rows}=await db.query(
    `SELECT
      s.created_at::date AS sale_date,
      COUNT(*)::int AS transactions,
      COALESCE(SUM(s.total),0) AS revenue
     FROM sales s
     WHERE s.branch_id=$1
       AND s.status IN('COMPLETED','PARTIALLY_REFUNDED')
       AND s.created_at >= $2::date
       AND s.created_at < ($3::date + interval '1 day')
     GROUP BY s.created_at::date
     ORDER BY sale_date DESC`,
    [branchId,from,to]
  );
  return rows;
}

module.exports={salesSummary,daily};

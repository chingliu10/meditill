async function salesSummary(db,branchId,from,to){
  const {rows}=await db.query(
    `SELECT count(DISTINCT s.id)::int transactions,COALESCE(sum(s.total),0) revenue,
      COALESCE(sum(cost.cost),0) cost,COALESCE(sum(s.total)-sum(cost.cost),0) gross_profit
     FROM sales s
     LEFT JOIN (
       SELECT si.sale_id,sum(sib.quantity*sib.unit_cost) cost
       FROM sale_items si JOIN sale_item_batches sib ON sib.sale_item_id=si.id GROUP BY si.sale_id
     ) cost ON cost.sale_id=s.id
     WHERE s.branch_id=$1 AND s.status IN('COMPLETED','PARTIALLY_REFUNDED')
       AND s.created_at >= $2::date AND s.created_at < ($3::date + interval '1 day')`,[branchId,from,to]);
  return rows[0];
}
async function daily(db,branchId,from,to){
  const {rows}=await db.query(
    `SELECT s.created_at::date day,count(*) transactions,sum(s.total) revenue
     FROM sales s WHERE s.branch_id=$1 AND s.status IN('COMPLETED','PARTIALLY_REFUNDED')
       AND s.created_at >= $2::date AND s.created_at < ($3::date + interval '1 day')
     GROUP BY s.created_at::date ORDER BY day DESC`,[branchId,from,to]);
  return rows;
}
module.exports={salesSummary,daily};

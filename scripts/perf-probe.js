const {pool}=require('../src/config/db');

const ORG_NAME='MediTill Performance Lab';

async function timed(label,fn){
  const start=process.hrtime.bigint();
  const result=await fn();
  const ms=Number(process.hrtime.bigint()-start)/1e6;
  console.log(label.padEnd(34),ms.toFixed(1).padStart(8),'ms');
  return result;
}

async function probe(){
  const org=(await pool.query('SELECT id FROM organizations WHERE name=$1 LIMIT 1',[ORG_NAME])).rows[0];
  if(!org) throw new Error('Performance dataset not found. Run npm run perf:seed first.');
  const branch=(await pool.query('SELECT id FROM branches WHERE organization_id=$1 ORDER BY id LIMIT 1',[org.id])).rows[0];

  const counts=(await pool.query(
    `SELECT
       (SELECT COUNT(*) FROM medicines WHERE organization_id=$1) medicines,
       (SELECT COUNT(*) FROM purchases WHERE organization_id=$1) purchases,
       (SELECT COUNT(*) FROM sales WHERE organization_id=$1) sales,
       (SELECT COUNT(*) FROM expenses WHERE organization_id=$1) expenses,
       (SELECT COUNT(*) FROM stock_movements WHERE organization_id=$1) stock_movements`,
    [org.id]
  )).rows[0];

  console.log('Performance Lab row counts:',counts);
  console.log('');

  await timed('Sales list (latest 200)',()=>pool.query(
    `SELECT s.id,s.sale_number,s.created_at,s.total,s.status,c.name customer,u.name cashier
     FROM sales s
     LEFT JOIN customers c ON c.id=s.customer_id
     JOIN users u ON u.id=s.user_id
     WHERE s.organization_id=$1 AND s.branch_id=$2
     ORDER BY s.created_at DESC
     LIMIT 200`,[org.id,branch.id]
  ));

  await timed('Inventory valuation',()=>pool.query(
    `SELECT m.id,COALESCE(SUM(b.quantity_available) FILTER(WHERE b.status='SALEABLE'),0) quantity,
            COALESCE(SUM(b.quantity_available*b.unit_cost) FILTER(WHERE b.status='SALEABLE'),0) value
     FROM medicines m
     LEFT JOIN medicine_batches b ON b.medicine_id=m.id AND b.branch_id=$2
     WHERE m.organization_id=$1
     GROUP BY m.id`,[org.id,branch.id]
  ));

  await timed('Purchases last 365 days',()=>pool.query(
    `SELECT p.purchase_date::date,COUNT(*)::int,COALESCE(SUM(p.total),0)
     FROM purchases p
     WHERE p.branch_id=$1 AND p.purchase_date>=current_date-364
     GROUP BY p.purchase_date::date`,[branch.id]
  ));

  await timed('P&L sales/cost 365 days',()=>pool.query(
    `WITH fs AS (
       SELECT s.id,s.total,COALESCE((SELECT SUM(sr.total_refund) FROM sale_returns sr WHERE sr.sale_id=s.id),0) refunds
       FROM sales s
       WHERE s.branch_id=$1 AND s.created_at>=current_date-364
     ),
     c AS (
       SELECT si.sale_id,SUM(sib.quantity*sib.unit_cost) cost
       FROM sale_items si JOIN sale_item_batches sib ON sib.sale_item_id=si.id
       JOIN fs ON fs.id=si.sale_id GROUP BY si.sale_id
     ),
     rc AS (
       SELECT sr.sale_id,SUM(sri.quantity*mb.unit_cost) cost
       FROM sale_returns sr JOIN sale_return_items sri ON sri.sale_return_id=sr.id
       JOIN medicine_batches mb ON mb.id=sri.batch_id
       JOIN fs ON fs.id=sr.sale_id GROUP BY sr.sale_id
     )
     SELECT COALESCE(SUM(fs.total-fs.refunds),0) revenue,
            COALESCE(SUM(COALESCE(c.cost,0)-COALESCE(rc.cost,0)),0) cost
     FROM fs LEFT JOIN c ON c.sale_id=fs.id LEFT JOIN rc ON rc.sale_id=fs.id`,
    [branch.id]
  ));

  await timed('Expenses aggregate 365 days',()=>pool.query(
    `SELECT category,COUNT(*)::int,SUM(amount)
     FROM expenses
     WHERE branch_id=$1 AND created_at>=current_date-364
     GROUP BY category`,[branch.id]
  ));

  await timed('Medicine text search',()=>pool.query(
    `SELECT id,name,generic_name
     FROM medicines
     WHERE organization_id=$1
       AND (name ILIKE '%Medicine 014%' OR COALESCE(generic_name,'') ILIKE '%Medicine 014%')
     ORDER BY name LIMIT 60`,[org.id]
  ));

  await pool.end();
}

probe().catch(error=>{console.error(error);process.exit(1);});

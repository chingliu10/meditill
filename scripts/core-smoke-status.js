require('dotenv').config();
const {pool}=require('../src/config/db');

const barcode=String(process.argv[2]||'').trim();

if(!barcode){
  console.error('Usage: npm run smoke:core -- <barcode>');
  console.error('Example: npm run smoke:core -- 123456789');
  process.exit(1);
}

function heading(text){
  console.log('\n=== '+text+' ===');
}

async function run(){
  const client=await pool.connect();

  try{
    const medicineResult=await client.query(
      `SELECT
        m.id,
        m.name,
        m.generic_name,
        m.strength,
        m.default_selling_price,
        mb.barcode,
        m.organization_id
       FROM medicine_barcodes mb
       JOIN medicines m ON m.id=mb.medicine_id
       WHERE mb.barcode=$1
       LIMIT 1`,
      [barcode]
    );

    if(!medicineResult.rowCount){
      console.error(`No medicine found for barcode ${barcode}`);
      process.exitCode=2;
      return;
    }

    const medicine=medicineResult.rows[0];
    heading('MEDICINE');
    console.table([medicine]);

    const batchResult=await client.query(
      `SELECT
        b.id batch_id,
        br.name branch,
        b.batch_number,
        b.expiry_date,
        b.status,
        b.quantity_received,
        b.quantity_available,
        b.unit_cost,
        COALESCE(sum(sm.quantity),0) ledger_quantity
       FROM medicine_batches b
       JOIN branches br ON br.id=b.branch_id
       LEFT JOIN stock_movements sm ON sm.batch_id=b.id
       WHERE b.medicine_id=$1
       GROUP BY b.id,br.name
       ORDER BY b.received_at,b.id`,
      [medicine.id]
    );

    heading('BATCHES + LEDGER RECONCILIATION');
    console.table(batchResult.rows);

    const mismatches=batchResult.rows.filter(row=>
      Number(row.quantity_available)!==Number(row.ledger_quantity)
    );

    if(mismatches.length){
      console.error('FAIL: batch quantity does not match stock movement ledger');
      console.table(mismatches);
      process.exitCode=3;
    }else if(batchResult.rows.length){
      console.log('PASS: batch quantities reconcile with stock movements.');
    }

    const movementResult=await client.query(
      `SELECT
        sm.id,
        br.name branch,
        sm.movement_type,
        sm.quantity,
        sm.unit_cost,
        sm.reference_type,
        sm.reference_id,
        sm.created_at
       FROM stock_movements sm
       JOIN branches br ON br.id=sm.branch_id
       WHERE sm.medicine_id=$1
       ORDER BY sm.created_at,sm.id`,
      [medicine.id]
    );

    heading('STOCK MOVEMENTS');
    console.table(movementResult.rows);

    const purchaseResult=await client.query(
      `SELECT
        p.purchase_number,
        p.purchase_date,
        p.total purchase_total,
        pi.quantity,
        pi.unit_cost,
        pi.batch_number,
        pi.expiry_date,
        br.name branch
       FROM purchase_items pi
       JOIN purchases p ON p.id=pi.purchase_id
       JOIN branches br ON br.id=p.branch_id
       WHERE pi.medicine_id=$1
       ORDER BY p.purchase_date DESC,p.id DESC
       LIMIT 10`,
      [medicine.id]
    );

    heading('PURCHASE HISTORY');
    console.table(purchaseResult.rows);

    const saleResult=await client.query(
      `SELECT
        s.sale_number,
        s.created_at,
        br.name branch,
        si.quantity sold_quantity,
        si.unit_price,
        s.total sale_total,
        sib.quantity batch_quantity,
        sib.unit_cost,
        mb.batch_number
       FROM sale_items si
       JOIN sales s ON s.id=si.sale_id
       JOIN branches br ON br.id=s.branch_id
       JOIN sale_item_batches sib ON sib.sale_item_id=si.id
       JOIN medicine_batches mb ON mb.id=sib.batch_id
       WHERE si.medicine_id=$1
       ORDER BY s.created_at DESC,s.id DESC
       LIMIT 20`,
      [medicine.id]
    );

    heading('SALE / FEFO ALLOCATION HISTORY');
    console.table(saleResult.rows);

    const registerResult=await client.query(
      `SELECT
        rs.id session_id,
        br.name branch,
        r.name register,
        u.username cashier,
        rs.opening_cash,
        rs.status,
        rs.opened_at,
        rs.expected_cash,
        rs.actual_cash,
        rs.difference
       FROM register_sessions rs
       JOIN branches br ON br.id=rs.branch_id
       JOIN registers r ON r.id=rs.register_id
       JOIN users u ON u.id=rs.user_id
       ORDER BY rs.opened_at DESC
       LIMIT 10`
    );

    heading('RECENT REGISTER SESSIONS');
    console.table(registerResult.rows);

    const summaryResult=await client.query(
      `SELECT
        br.name branch,
        count(DISTINCT s.id)::int transactions,
        COALESCE(sum(si.quantity),0) units_sold,
        COALESCE(sum(si.line_total),0) line_revenue,
        COALESCE(sum(sib.quantity*sib.unit_cost),0) cost,
        COALESCE(sum(si.line_total)-sum(sib.quantity*sib.unit_cost),0) gross_margin
       FROM branches br
       LEFT JOIN sales s
         ON s.branch_id=br.id
        AND s.status IN('COMPLETED','PARTIALLY_REFUNDED')
       LEFT JOIN sale_items si
         ON si.sale_id=s.id
        AND si.medicine_id=$1
       LEFT JOIN sale_item_batches sib ON sib.sale_item_id=si.id
       WHERE br.organization_id=$2
       GROUP BY br.id,br.name
       ORDER BY br.name`,
      [medicine.id,medicine.organization_id]
    );

    heading('MEDICINE SALES SUMMARY BY BRANCH');
    console.table(summaryResult.rows);

    heading('RESULT');
    if(!batchResult.rows.length){
      console.log('Medicine exists, but no stock has been received yet.');
    }else if(!saleResult.rows.length){
      console.log('Purchase/stock exists. No sale has been recorded for this medicine yet.');
    }else if(!process.exitCode){
      console.log('PASS: medicine, purchase, stock ledger, sale allocation and register data are present.');
    }
  }finally{
    client.release();
    await pool.end();
  }
}

run().catch(error=>{
  console.error(error);
  process.exit(1);
});

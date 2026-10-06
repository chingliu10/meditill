async function openRegister(db,userId,branchId){const {rows}=await db.query(`SELECT rs.*,r.name register_name FROM register_sessions rs JOIN registers r ON r.id=rs.register_id WHERE rs.user_id=$1 AND rs.branch_id=$2 AND rs.status='OPEN' LIMIT 1`,[userId,branchId]);return rows[0]||null;}
async function search(db,organizationId,branchId,q){
  const query=String(q||'').trim();
  const term=`%${query}%`;
  const prefix=`${query}%`;

  const {rows}=await db.query(
    `SELECT
       m.id,m.name,m.generic_name,m.brand_name,m.strength,m.default_selling_price,m.image_path,
       c.name category,u.name unit_name,u.symbol unit,COALESCE(u.allow_fraction,false) allow_fraction,
       1::numeric conversion_to_base,NULL::bigint medicine_unit_id,NULL::varchar sale_unit_name,NULL::numeric sale_unit_price,
       COALESCE(SUM(b.quantity_available) FILTER(
         WHERE b.status='SALEABLE' AND b.quantity_available>0
           AND (b.expiry_date IS NULL OR b.expiry_date>=current_date)
       ),0) stock,
       CASE
         WHEN $3='' THEN 50
         WHEN EXISTS(SELECT 1 FROM medicine_barcodes mb WHERE mb.medicine_id=m.id AND mb.barcode=$3) THEN 0
         WHEN EXISTS(SELECT 1 FROM medicine_units mu WHERE mu.medicine_id=m.id AND mu.active=true AND mu.barcode=$3) THEN 0
         WHEN COALESCE(m.sku,'') ILIKE $3 THEN 1
         WHEN m.name ILIKE $3 THEN 2
         WHEN COALESCE(m.generic_name,'') ILIKE $3 THEN 3
         WHEN COALESCE(m.brand_name,'') ILIKE $3 THEN 4
         WHEN m.name ILIKE $5 THEN 5
         WHEN COALESCE(m.generic_name,'') ILIKE $5 THEN 6
         WHEN COALESCE(m.brand_name,'') ILIKE $5 THEN 7
         ELSE 20
       END relevance
     FROM medicines m
     LEFT JOIN categories c ON c.id=m.category_id
     LEFT JOIN units u ON u.id=m.base_unit_id
     LEFT JOIN medicine_batches b ON b.medicine_id=m.id AND b.branch_id=$2
     WHERE m.organization_id=$1
       AND m.active=true
       AND (
         $3='' OR
         m.name ILIKE $4 OR
         COALESCE(m.generic_name,'') ILIKE $4 OR
         COALESCE(m.brand_name,'') ILIKE $4 OR
         COALESCE(m.sku,'') ILIKE $4 OR
         EXISTS(SELECT 1 FROM medicine_barcodes mb WHERE mb.medicine_id=m.id AND mb.barcode ILIKE $4) OR
         EXISTS(SELECT 1 FROM medicine_units mu WHERE mu.medicine_id=m.id AND mu.active=true AND mu.barcode ILIKE $4)
       )
     GROUP BY m.id,c.id,u.id
     ORDER BY relevance,
       (COALESCE(SUM(b.quantity_available) FILTER(
         WHERE b.status='SALEABLE' AND b.quantity_available>0
           AND (b.expiry_date IS NULL OR b.expiry_date>=current_date)
       ),0)>0) DESC,
       m.name
     LIMIT 25`,
    [organizationId,branchId,query,term,prefix]
  );
  return rows;
}
async function lockBatches(db,medicineId,branchId){const {rows}=await db.query(`SELECT id,quantity_available,expiry_date,unit_cost FROM medicine_batches WHERE medicine_id=$1 AND branch_id=$2 AND quantity_available>0 AND status='SALEABLE' AND (expiry_date IS NULL OR expiry_date>=current_date) ORDER BY expiry_date NULLS LAST,received_at,id FOR UPDATE`,[medicineId,branchId]);return rows;}
async function medicine(db,organizationId,id){const {rows}=await db.query(`SELECT m.id,m.name,m.default_selling_price,u.name unit_name,u.symbol unit,COALESCE(u.allow_fraction,false) allow_fraction FROM medicines m LEFT JOIN units u ON u.id=m.base_unit_id WHERE m.organization_id=$1 AND m.id=$2 AND m.active=true`,[organizationId,id]);return rows[0]||null;}
async function medicineUnit(db,organizationId,medicineId,id){const {rows}=await db.query(`SELECT mu.id,mu.name,mu.conversion_to_base,mu.selling_price FROM medicine_units mu JOIN medicines m ON m.id=mu.medicine_id WHERE m.organization_id=$1 AND mu.medicine_id=$2 AND mu.id=$3 AND mu.active=true`,[organizationId,medicineId,id]);return rows[0]||null;}
async function customer(db,organizationId,id){if(!id)return null;const {rows}=await db.query('SELECT id,name FROM customers WHERE organization_id=$1 AND id=$2 AND active=true',[organizationId,id]);return rows[0]||null;}
async function recent(db,branchId){const {rows}=await db.query(`SELECT s.id,s.sale_number,s.total,s.created_at,c.name customer FROM sales s LEFT JOIN customers c ON c.id=s.customer_id WHERE s.branch_id=$1 AND s.status IN('COMPLETED','PARTIALLY_REFUNDED','REFUNDED') ORDER BY s.created_at DESC LIMIT 8`,[branchId]);return rows;}
async function createSale(db,d){const {rows}=await db.query(`INSERT INTO sales(organization_id,branch_id,register_session_id,customer_id,user_id,sale_number,subtotal,discount,tax,total,amount_paid,change_amount,payment_status,status) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,'PAID','COMPLETED') RETURNING *`,[d.organizationId,d.branchId,d.registerSessionId,d.customerId||null,d.userId,d.saleNumber,d.subtotal,d.discount,d.tax,d.total,d.amountPaid,d.change]);return rows[0];}
async function createItem(db,saleId,d){const {rows}=await db.query(`INSERT INTO sale_items(sale_id,medicine_id,quantity,unit_price,discount,line_total,medicine_unit_id,sale_unit_name,sale_unit_quantity,conversion_to_base,sale_unit_price) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11) RETURNING *`,[saleId,d.medicineId,d.quantity,d.unitPrice,d.discount||0,d.lineTotal,d.medicineUnitId||null,d.saleUnitName||null,d.saleUnitQuantity,d.conversion,d.saleUnitPrice]);return rows[0];}
async function allocateBatch(db,saleItemId,batchId,qty,cost){await db.query('INSERT INTO sale_item_batches(sale_item_id,batch_id,quantity,unit_cost) VALUES($1,$2,$3,$4)',[saleItemId,batchId,qty,cost]);const {rows}=await db.query(`UPDATE medicine_batches SET quantity_available=quantity_available-$2,status=CASE WHEN quantity_available-$2=0 THEN 'DEPLETED' ELSE status END WHERE id=$1 AND quantity_available >= $2 RETURNING medicine_id,branch_id,organization_id,quantity_available`,[batchId,qty]);if(!rows.length){const e=new Error('Stock changed while completing sale');e.statusCode=409;throw e;}return rows[0];}
async function movement(db,batchId,medicineId,ctx,qty,cost,saleId){await db.query(`INSERT INTO stock_movements(organization_id,branch_id,medicine_id,batch_id,movement_type,quantity,unit_cost,reference_type,reference_id,performed_by) VALUES($1,$2,$3,$4,'SALE',$5,$6,'SALE',$7,$8)`,[ctx.organizationId,ctx.branchId,medicineId,batchId,-qty,cost,saleId,ctx.userId]);}
async function payment(db,saleId,sessionId,userId,p){const {rows}=await db.query(`INSERT INTO sale_payments(sale_id,register_session_id,payment_method,amount,reference,created_by) VALUES($1,$2,$3,$4,$5,$6) RETURNING *`,[saleId,sessionId,p.method,p.amount,p.reference||null,userId]);return rows[0];}
async function registerCash(db,sessionId,amount,saleId,userId){if(amount<=0)return;await db.query(`INSERT INTO register_movements(register_session_id,movement_type,amount,reference_type,reference_id,performed_by) VALUES($1,'CASH_SALE',$2,'SALE',$3,$4)`,[sessionId,amount,saleId,userId]);}
module.exports={openRegister,search,lockBatches,medicine,medicineUnit,customer,recent,createSale,createItem,allocateBatch,movement,payment,registerCash};
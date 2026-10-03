async function list(db,organizationId,branchId){
  const {rows}=await db.query(
    `SELECT p.id,p.purchase_number,p.purchase_date,p.total,p.status,p.payment_status,s.name supplier
     FROM purchases p
     LEFT JOIN suppliers s ON s.id=p.supplier_id
     WHERE p.organization_id=$1
       AND p.branch_id=$2
     ORDER BY p.purchase_date DESC
     LIMIT 100`,
    [organizationId,branchId]
  );
  return rows;
}

async function masters(db,organizationId){
  const suppliers=await db.query(
    'SELECT id,name FROM suppliers WHERE organization_id=$1 AND active=true ORDER BY name LIMIT 20',
    [organizationId]
  );
  return {suppliers:suppliers.rows};
}

async function medicineRule(db,organizationId,medicineId){
  const {rows}=await db.query(
    `SELECT
      m.id,m.name,
      u.name unit_name,
      u.symbol unit,
      COALESCE(u.allow_fraction,false) allow_fraction
     FROM medicines m
     LEFT JOIN units u ON u.id=m.base_unit_id
     WHERE m.organization_id=$1
       AND m.id=$2
       AND m.active=true
     LIMIT 1`,
    [organizationId,medicineId]
  );
  return rows[0]||null;
}

async function insertPurchase(db,data){
  const {rows}=await db.query(
    `INSERT INTO purchases(
      organization_id,branch_id,supplier_id,purchase_number,supplier_invoice_number,
      purchase_date,subtotal,discount,tax,total,status,payment_status,notes,created_by,received_at
    )
    VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,'RECEIVED',$11,$12,$13,now())
    RETURNING *`,
    [
      data.organizationId,data.branchId,data.supplierId||null,data.purchaseNumber,
      data.supplierInvoiceNumber||null,data.purchaseDate||new Date(),data.subtotal,
      data.discount,data.tax,data.total,data.paymentStatus,data.notes||null,data.userId
    ]
  );
  return rows[0];
}

async function insertItem(db,purchaseId,item){
  const {rows}=await db.query(
    `INSERT INTO purchase_items(
      purchase_id,medicine_id,quantity,unit_cost,selling_price,batch_number,
      manufacturing_date,expiry_date,line_total
    )
    VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9)
    RETURNING *`,
    [
      purchaseId,item.medicineId,item.quantity,item.unitCost,item.sellingPrice||null,
      item.batchNumber||null,item.manufacturingDate||null,item.expiryDate||null,
      item.quantity*item.unitCost
    ]
  );
  return rows[0];
}

async function createBatch(db,ctx,item,purchaseItemId){
  const {rows}=await db.query(
    `INSERT INTO medicine_batches(
      organization_id,branch_id,medicine_id,purchase_item_id,batch_number,
      manufacturing_date,expiry_date,unit_cost,default_selling_price,
      quantity_received,quantity_available,status
    )
    VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$10,'SALEABLE')
    RETURNING *`,
    [
      ctx.organizationId,ctx.branchId,item.medicineId,purchaseItemId,
      item.batchNumber||null,item.manufacturingDate||null,item.expiryDate||null,
      item.unitCost,item.sellingPrice||null,item.quantity
    ]
  );
  return rows[0];
}

async function stockMovement(db,ctx,batch,item,purchaseId){
  await db.query(
    `INSERT INTO stock_movements(
      organization_id,branch_id,medicine_id,batch_id,movement_type,quantity,
      unit_cost,reference_type,reference_id,performed_by
    )
    VALUES($1,$2,$3,$4,'PURCHASE',$5,$6,'PURCHASE',$7,$8)`,
    [
      ctx.organizationId,ctx.branchId,item.medicineId,batch.id,item.quantity,
      item.unitCost,purchaseId,ctx.userId
    ]
  );
}

module.exports={
  list,
  masters,
  medicineRule,
  insertPurchase,
  insertItem,
  createBatch,
  stockMovement
};

const {withTransaction}=require('../../config/db');
const repo=require('./purchase.repository');
const {nextDocumentNumber}=require('../../shared/document-number');
const {appError}=require('../../shared/app-error');

function normalizeItems(input){
  const source=input && input.items ? input.items : [];
  const raw=Array.isArray(source) ? source : Object.values(source);

  return raw.map(i=>({
    medicineId:Number(i.medicine_id),
    quantity:Number(i.quantity),
    unitCost:Number(i.unit_cost),
    sellingPrice:i.selling_price==='' || i.selling_price==null ? null : Number(i.selling_price),
    batchNumber:String(i.batch_number||'').trim(),
    manufacturingDate:i.manufacturing_date||null,
    expiryDate:i.expiry_date||null
  })).filter(i=>
    Number.isInteger(i.medicineId) &&
    i.medicineId>0 &&
    Number.isFinite(i.quantity) &&
    i.quantity>0 &&
    Number.isFinite(i.unitCost) &&
    i.unitCost>=0 &&
    (i.sellingPrice===null || (Number.isFinite(i.sellingPrice) && i.sellingPrice>=0))
  );
}

function startOfToday(){
  const now=new Date();
  return new Date(now.getFullYear(),now.getMonth(),now.getDate());
}

async function receivePurchase(input,context){
  const items=normalizeItems(input);
  if(!items.length) throw appError('At least one valid purchase item is required');

  for(const item of items){
    if(item.expiryDate && new Date(item.expiryDate+'T00:00:00')<startOfToday()){
      throw appError('Cannot receive already expired stock');
    }
    if(item.manufacturingDate && item.expiryDate && item.manufacturingDate>item.expiryDate){
      throw appError('Manufacturing date cannot be after expiry date');
    }
  }

  const discount=Math.max(0,Number(input.discount||0));
  const tax=Math.max(0,Number(input.tax||0));
  if(!Number.isFinite(discount) || !Number.isFinite(tax)) throw appError('Invalid discount or tax');

  return withTransaction(async client=>{
    const purchaseNumber=await nextDocumentNumber(
      client,
      context.user.organization_id,
      context.branch.id,
      'PURCHASE',
      'PUR'
    );

    const subtotal=items.reduce((sum,item)=>sum+(item.quantity*item.unitCost),0);
    const total=Math.max(0,subtotal-discount+tax);

    const purchase=await repo.insertPurchase(client,{
      organizationId:context.user.organization_id,
      branchId:context.branch.id,
      userId:context.user.id,
      supplierId:Number(input.supplier_id)||null,
      purchaseNumber,
      supplierInvoiceNumber:input.supplier_invoice_number,
      purchaseDate:input.purchase_date||null,
      subtotal,
      discount,
      tax,
      total,
      paymentStatus:'UNPAID',
      notes:input.notes
    });

    for(const item of items){
      const purchaseItem=await repo.insertItem(client,purchase.id,item);
      const batch=await repo.createBatch(
        client,
        {
          organizationId:context.user.organization_id,
          branchId:context.branch.id,
          userId:context.user.id
        },
        item,
        purchaseItem.id
      );

      await repo.stockMovement(
        client,
        {
          organizationId:context.user.organization_id,
          branchId:context.branch.id,
          userId:context.user.id
        },
        batch,
        item,
        purchase.id
      );
    }

    return purchase;
  });
}

module.exports={receivePurchase};

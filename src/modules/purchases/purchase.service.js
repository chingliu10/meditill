const {withTransaction}=require('../../config/db');
const repo=require('./purchase.repository');
const {nextDocumentNumber}=require('../../shared/document-number');
const {appError}=require('../../shared/app-error');

function normalizeItems(input){
  const raw=Array.isArray(input.items)?input.items:[];
  return raw.map(i=>({
    medicineId:Number(i.medicine_id),
    quantity:Number(i.quantity),
    unitCost:Number(i.unit_cost),
    sellingPrice:i.selling_price===''?null:Number(i.selling_price),
    batchNumber:String(i.batch_number||'').trim(),
    manufacturingDate:i.manufacturing_date||null,
    expiryDate:i.expiry_date||null
  })).filter(i=>i.medicineId&&i.quantity>0&&i.unitCost>=0);
}

async function receivePurchase(input,context){
  const items=normalizeItems(input);
  if(!items.length) throw appError('At least one valid purchase item is required');
  for(const item of items){
    if(item.expiryDate && new Date(item.expiryDate)<new Date(new Date().toDateString())) throw appError('Cannot receive already expired stock');
  }
  return withTransaction(async client=>{
    const purchaseNumber=await nextDocumentNumber(client,context.user.organization_id,context.branch.id,'PURCHASE','PUR');
    const subtotal=items.reduce((s,i)=>s+i.quantity*i.unitCost,0);
    const discount=Math.max(0,Number(input.discount||0));
    const tax=Math.max(0,Number(input.tax||0));
    const total=Math.max(0,subtotal-discount+tax);
    const purchase=await repo.insertPurchase(client,{
      organizationId:context.user.organization_id,branchId:context.branch.id,userId:context.user.id,
      supplierId:Number(input.supplier_id)||null,purchaseNumber,supplierInvoiceNumber:input.supplier_invoice_number,
      purchaseDate:input.purchase_date||null,subtotal,discount,tax,total,paymentStatus:'UNPAID',notes:input.notes
    });
    for(const item of items){
      const purchaseItem=await repo.insertItem(client,purchase.id,item);
      const batch=await repo.createBatch(client,{organizationId:context.user.organization_id,branchId:context.branch.id,userId:context.user.id},item,purchaseItem.id);
      await repo.stockMovement(client,{organizationId:context.user.organization_id,branchId:context.branch.id,userId:context.user.id},batch,item,purchase.id);
    }
    return purchase;
  });
}
module.exports={receivePurchase};

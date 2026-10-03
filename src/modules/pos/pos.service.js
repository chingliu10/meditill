const {withTransaction,pool}=require('../../config/db');
const repo=require('./pos.repository');
const {nextDocumentNumber}=require('../../shared/document-number');
const {appError}=require('../../shared/app-error');

function normalizePayments(payments){
  return (Array.isArray(payments)?payments:[]).map(p=>({method:String(p.method||'').toUpperCase(),amount:Number(p.amount),reference:p.reference})).filter(p=>p.amount>0);
}
async function completeSale(input,ctx){
  const cart=Array.isArray(input.items)?input.items:[];
  if(!cart.length) throw appError('Cart is empty');
  const session=await repo.openRegister(pool,ctx.user.id);
  if(!session) throw appError('Open a register before selling',409,'REGISTER_REQUIRED');

  return withTransaction(async client=>{
    const lines=[]; let subtotal=0;
    for(const row of cart){
      const med=await repo.medicine(client,ctx.user.organization_id,Number(row.medicine_id));
      if(!med) throw appError('Medicine not found',404);
      const quantity=Number(row.quantity);
      if(!(quantity>0)) throw appError('Invalid sale quantity');
      const unitPrice=row.unit_price===undefined?Number(med.default_selling_price):Number(row.unit_price);
      const lineTotal=quantity*unitPrice; subtotal+=lineTotal;
      const batches=await repo.lockBatches(client,med.id,ctx.branch.id);
      let remaining=quantity; const allocations=[];
      for(const b of batches){
        if(remaining<=0)break;
        const take=Math.min(remaining,Number(b.quantity_available));
        allocations.push({batchId:b.id,quantity:take,unitCost:Number(b.unit_cost)});
        remaining-=take;
      }
      if(remaining>0) throw appError(`Insufficient stock for ${med.name}`,409,'INSUFFICIENT_STOCK');
      lines.push({medicine:med,quantity,unitPrice,lineTotal,allocations});
    }
    const discount=Math.max(0,Number(input.discount||0));
    const tax=Math.max(0,Number(input.tax||0));
    const total=Math.max(0,subtotal-discount+tax);
    const payments=normalizePayments(input.payments);
    const amountPaid=payments.reduce((s,p)=>s+p.amount,0);
    if(amountPaid<total) throw appError('Payment is less than total');
    const change=amountPaid-total;
    const saleNumber=await nextDocumentNumber(client,ctx.user.organization_id,ctx.branch.id,'SALE','SALE');
    const sale=await repo.createSale(client,{organizationId:ctx.user.organization_id,branchId:ctx.branch.id,registerSessionId:session.id,customerId:input.customer_id,userId:ctx.user.id,saleNumber,subtotal,discount,tax,total,amountPaid,change});
    for(const line of lines){
      const item=await repo.createItem(client,sale.id,{medicineId:line.medicine.id,quantity:line.quantity,unitPrice:line.unitPrice,lineTotal:line.lineTotal});
      for(const a of line.allocations){
        await repo.allocateBatch(client,item.id,a.batchId,a.quantity,a.unitCost);
        await repo.movement(client,a.batchId,line.medicine.id,{organizationId:ctx.user.organization_id,branchId:ctx.branch.id,userId:ctx.user.id},a.quantity,a.unitCost,sale.id);
      }
    }
    for(const p of payments){
      await repo.payment(client,sale.id,session.id,ctx.user.id,p);
      if(p.method==='CASH') await repo.registerCash(client,session.id,Math.min(p.amount,total),sale.id,ctx.user.id);
    }
    return {...sale,change};
  });
}
module.exports={completeSale};

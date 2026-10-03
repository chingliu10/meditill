const {withTransaction}=require('../../config/db');
const repo=require('./pos.repository');
const {nextDocumentNumber}=require('../../shared/document-number');
const {appError}=require('../../shared/app-error');

const PAYMENT_METHODS=new Set(['CASH','MOBILE_MONEY','CARD','BANK','CREDIT']);

function normalizePayments(payments){
  const raw=Array.isArray(payments)?payments:[];
  return raw.map(payment=>({
    method:String(payment.method||'').toUpperCase(),
    amount:Number(payment.amount),
    reference:payment.reference
  })).filter(payment=>
    PAYMENT_METHODS.has(payment.method) &&
    Number.isFinite(payment.amount) &&
    payment.amount>0
  );
}

async function completeSale(input,ctx){
  const cart=Array.isArray(input.items)?input.items:[];
  if(!cart.length) throw appError('Cart is empty');

  return withTransaction(async client=>{
    const session=await repo.openRegister(client,ctx.user.id,ctx.branch.id);
    if(!session){
      throw appError(
        'Open a register for the current branch before selling',
        409,
        'REGISTER_REQUIRED'
      );
    }

    const lines=[];
    let subtotal=0;

    for(const row of cart){
      const medicineId=Number(row.medicine_id);
      const med=await repo.medicine(client,ctx.user.organization_id,medicineId);
      if(!med) throw appError('Medicine not found',404,'MEDICINE_NOT_FOUND');

      const quantity=Number(row.quantity);
      if(!Number.isFinite(quantity)||quantity<=0){
        throw appError('Invalid sale quantity');
      }

      const unitPrice=row.unit_price===undefined
        ? Number(med.default_selling_price)
        : Number(row.unit_price);

      if(!Number.isFinite(unitPrice)||unitPrice<0){
        throw appError('Invalid selling price');
      }

      const lineTotal=quantity*unitPrice;
      subtotal+=lineTotal;

      const batches=await repo.lockBatches(client,med.id,ctx.branch.id);
      let remaining=quantity;
      const allocations=[];

      for(const batch of batches){
        if(remaining<=0) break;

        const available=Number(batch.quantity_available);
        const take=Math.min(remaining,available);

        if(take>0){
          allocations.push({
            batchId:batch.id,
            quantity:take,
            unitCost:Number(batch.unit_cost)
          });
          remaining-=take;
        }
      }

      if(remaining>0){
        throw appError(
          `Insufficient stock for ${med.name}`,
          409,
          'INSUFFICIENT_STOCK'
        );
      }

      lines.push({
        medicine:med,
        quantity,
        unitPrice,
        lineTotal,
        allocations
      });
    }

    const discount=Math.max(0,Number(input.discount||0));
    const tax=Math.max(0,Number(input.tax||0));

    if(!Number.isFinite(discount)||!Number.isFinite(tax)){
      throw appError('Invalid discount or tax');
    }

    const total=Math.max(0,subtotal-discount+tax);
    const payments=normalizePayments(input.payments);

    if(!payments.length){
      throw appError('A valid payment is required');
    }

    const amountPaid=payments.reduce((sum,payment)=>sum+payment.amount,0);
    if(amountPaid<total){
      throw appError('Payment is less than total');
    }

    const change=amountPaid-total;
    const cashPaid=payments
      .filter(payment=>payment.method==='CASH')
      .reduce((sum,payment)=>sum+payment.amount,0);

    if(change>cashPaid){
      throw appError(
        'Change cannot exceed the cash portion of the payment',
        400,
        'INVALID_CHANGE'
      );
    }

    const saleNumber=await nextDocumentNumber(
      client,
      ctx.user.organization_id,
      ctx.branch.id,
      'SALE',
      'SALE'
    );

    const sale=await repo.createSale(client,{
      organizationId:ctx.user.organization_id,
      branchId:ctx.branch.id,
      registerSessionId:session.id,
      customerId:input.customer_id,
      userId:ctx.user.id,
      saleNumber,
      subtotal,
      discount,
      tax,
      total,
      amountPaid,
      change
    });

    for(const line of lines){
      const item=await repo.createItem(client,sale.id,{
        medicineId:line.medicine.id,
        quantity:line.quantity,
        unitPrice:line.unitPrice,
        lineTotal:line.lineTotal
      });

      for(const allocation of line.allocations){
        await repo.allocateBatch(
          client,
          item.id,
          allocation.batchId,
          allocation.quantity,
          allocation.unitCost
        );

        await repo.movement(
          client,
          allocation.batchId,
          line.medicine.id,
          {
            organizationId:ctx.user.organization_id,
            branchId:ctx.branch.id,
            userId:ctx.user.id
          },
          allocation.quantity,
          allocation.unitCost,
          sale.id
        );
      }
    }

    for(const payment of payments){
      await repo.payment(
        client,
        sale.id,
        session.id,
        ctx.user.id,
        payment
      );
    }

    const netCashIntoDrawer=cashPaid-change;
    await repo.registerCash(
      client,
      session.id,
      netCashIntoDrawer,
      sale.id,
      ctx.user.id
    );

    return sale;
  });
}

module.exports={completeSale};

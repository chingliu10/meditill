const {withTransaction}=require('../../config/db');
const repo=require('./expense.repository');
const {appError}=require('../../shared/app-error');
const METHODS=new Set(['CASH','MOBILE_MONEY','CARD','BANK']);
async function createExpense(input,ctx){
  const category=String(input.category||'').trim();
  const amount=Number(input.amount);
  const paymentMethod=String(input.payment_method||'').toUpperCase();
  if(!category) throw appError('Expense category is required');
  if(!Number.isFinite(amount)||amount<=0) throw appError('Expense amount must be greater than zero');
  if(!METHODS.has(paymentMethod)) throw appError('Invalid payment method');
  return withTransaction(async client=>{
    let session=null;
    if(paymentMethod==='CASH'){
      session=await repo.openRegister(client,ctx.user.id,ctx.branch.id);
      if(!session) throw appError('Open a register before recording a cash expense',409,'REGISTER_REQUIRED');
    }
    const expense=await repo.create(client,{organizationId:ctx.user.organization_id,branchId:ctx.branch.id,registerSessionId:session?.id,userId:ctx.user.id,category,description:String(input.description||'').trim(),amount,paymentMethod});
    if(session) await repo.registerMovement(client,session.id,expense.id,amount,ctx.user.id);
    return expense;
  });
}
module.exports={createExpense};

const {pool}=require('../../config/db');const repo=require('./purchase.repository');const service=require('./purchase.service');const {setFlash}=require('../../shared/flash');const {appError}=require('../../shared/app-error');
async function index(req,res,next){try{res.render('purchases/index',{title:'Purchases',purchases:await repo.list(pool,req.session.user.organization_id,req.branch.id)});}catch(e){next(e);}}
async function newForm(req,res,next){try{res.render('purchases/new',{title:'Receive Purchase',...(await repo.masters(pool,req.session.user.organization_id))});}catch(e){next(e);}}
async function create(req,res,next){
  try{
    const p=await service.receivePurchase(req.body,{user:req.session.user,branch:req.branch});
    setFlash(req,'success',`Purchase ${p.purchase_number} received and stock posted.`);
    res.redirect('/purchases/'+p.id);
  }catch(error){
    console.error('[PURCHASE] Receive failed',{
      organizationId:req.session.user?.organization_id,
      branchId:req.branch?.id,
      code:error.code,
      constraint:error.constraint,
      detail:error.detail,
      message:error.message
    });
    next(error);
  }
}
async function show(req,res,next){try{const d=await repo.detail(pool,req.session.user.organization_id,req.branch.id,Number(req.params.id));if(!d)throw appError('Purchase not found',404);const paid=d.payments.reduce((s,p)=>s+Number(p.amount),0),returned=d.returns.reduce((s,r)=>s+Number(r.total_value),0),netTotal=Math.max(0,Number(d.purchase.total)-returned);res.render('purchases/show',{title:d.purchase.purchase_number,...d,paid,returned,netTotal,balance:Math.max(0,netTotal-paid)});}catch(e){next(e);}}
async function payment(req,res,next){try{await service.addPayment(Number(req.params.id),req.body,{user:req.session.user,branch:req.branch});setFlash(req,'success','Supplier payment recorded.');res.redirect('/purchases/'+req.params.id);}catch(e){next(e);}}
async function returnPurchase(req,res,next){try{const r=await service.createReturn(Number(req.params.id),req.body,{user:req.session.user,branch:req.branch});setFlash(req,'success',`Purchase return ${r.return_number} posted.`);res.redirect('/purchases/'+req.params.id);}catch(e){next(e);}}
module.exports={index,newForm,create,show,payment,returnPurchase};
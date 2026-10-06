const {pool}=require('../../config/db');
const repo=require('./purchase.repository');
const service=require('./purchase.service');
const {setFlash}=require('../../shared/flash');
const {appError}=require('../../shared/app-error');
const {PERIODS,resolvePeriod,safePage,pagination}=require('../../shared/list-pagination');

function listUrl(period,q,page){
  const params=new URLSearchParams();
  params.set('period',period);
  if(q)params.set('q',q);
  if(page>1)params.set('page',String(page));
  return '/purchases?'+params.toString();
}

async function index(req,res,next){
  try{
    const q=String(req.query.q||'').trim();
    const requestedPage=safePage(req.query.page);
    const clock=await repo.businessClock(pool,req.session.user.organization_id);
    const range=resolvePeriod(clock.business_date,String(req.query.period||'7d'));

    let result=await repo.list(pool,req.session.user.organization_id,req.branch.id,{
      q,startDate:range.startDate,endDate:range.endDate,page:requestedPage,pageSize:25
    });

    const pager=pagination(result.total,requestedPage,25,page=>listUrl(range.period.key,q,page));
    if(pager.page!==requestedPage){
      result=await repo.list(pool,req.session.user.organization_id,req.branch.id,{
        q,startDate:range.startDate,endDate:range.endDate,page:pager.page,pageSize:25
      });
    }

    res.render('purchases/index',{
      title:'Purchases',
      purchases:result.rows,
      q,
      period:range.period.key,
      periods:PERIODS.map(item=>({...item,active:item.key===range.period.key,url:listUrl(item.key,q,1)})),
      pagination:pager
    });
  }catch(e){next(e);}
}

async function newForm(req,res,next){try{res.render('purchases/new',{title:'Receive Purchase',...(await repo.masters(pool,req.session.user.organization_id))});}catch(e){next(e);}}
async function create(req,res,next){
  try{
    const p=await service.receivePurchase(req.body,{user:req.session.user,branch:req.branch});
    setFlash(req,'success',`Purchase ${p.purchase_number} received and stock posted.`);
    res.redirect('/purchases/'+p.id);
  }catch(error){
    console.error('[PURCHASE] Receive failed',{organizationId:req.session.user?.organization_id,branchId:req.branch?.id,code:error.code,constraint:error.constraint,detail:error.detail,message:error.message});
    next(error);
  }
}
async function show(req,res,next){try{const d=await repo.detail(pool,req.session.user.organization_id,req.branch.id,Number(req.params.id));if(!d)throw appError('Purchase not found',404);const paid=d.payments.reduce((s,p)=>s+Number(p.amount),0),returned=d.returns.reduce((s,r)=>s+Number(r.total_value),0),netTotal=Math.max(0,Number(d.purchase.total)-returned);res.render('purchases/show',{title:d.purchase.purchase_number,...d,paid,returned,netTotal,balance:Math.max(0,netTotal-paid)});}catch(e){next(e);}}
async function payment(req,res,next){try{await service.addPayment(Number(req.params.id),req.body,{user:req.session.user,branch:req.branch});setFlash(req,'success','Supplier payment recorded.');res.redirect('/purchases/'+req.params.id);}catch(error){console.error('[PURCHASE] Payment failed',{organizationId:req.session.user?.organization_id,branchId:req.branch?.id,purchaseId:req.params.id,amount:req.body?.amount,paymentMethod:req.body?.payment_method,code:error.code,constraint:error.constraint,detail:error.detail,message:error.message});next(error);}}
async function returnPurchase(req,res,next){try{const r=await service.createReturn(Number(req.params.id),req.body,{user:req.session.user,branch:req.branch});setFlash(req,'success',`Purchase return ${r.return_number} posted.`);res.redirect('/purchases/'+req.params.id);}catch(e){next(e);}}
module.exports={index,newForm,create,show,payment,returnPurchase};

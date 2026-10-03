const {pool}=require('../../config/db');
const repo=require('./purchase.repository');
const service=require('./purchase.service');

async function index(req,res,next){
  try{
    const purchases=await repo.list(pool,req.session.user.organization_id,req.branch.id);
    res.render('purchases/index',{
      title:'Purchases',
      purchases,
      success:req.query.received ? `Purchase ${req.query.received} received and stock posted.` : null
    });
  }catch(error){
    next(error);
  }
}

async function newForm(req,res,next){
  try{
    const masters=await repo.masters(pool,req.session.user.organization_id);
    res.render('purchases/new',{title:'Receive Purchase',...masters});
  }catch(error){
    next(error);
  }
}

async function create(req,res,next){
  try{
    const purchase=await service.receivePurchase(req.body,{
      user:req.session.user,
      branch:req.branch
    });

    console.info('[PURCHASE] Received', {
      purchaseId:purchase.id,
      purchaseNumber:purchase.purchase_number,
      branchId:req.branch.id,
      userId:req.session.user.id,
      total:purchase.total
    });

    res.redirect('/purchases?received='+encodeURIComponent(purchase.purchase_number));
  }catch(error){
    console.warn('[PURCHASE] Receive failed', {
      branchId:req.branch.id,
      userId:req.session.user.id,
      code:error.code||'PURCHASE_ERROR',
      message:error.message
    });
    next(error);
  }
}

module.exports={index,newForm,create};

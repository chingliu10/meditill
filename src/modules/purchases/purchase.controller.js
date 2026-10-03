const {pool}=require('../../config/db');
const repo=require('./purchase.repository');
const service=require('./purchase.service');
const {setFlash}=require('../../shared/flash');

async function index(req,res,next){
  try{
    const purchases=await repo.list(
      pool,
      req.session.user.organization_id,
      req.branch.id
    );
    res.render('purchases/index',{title:'Purchases',purchases});
  }catch(error){
    next(error);
  }
}

async function newForm(req,res,next){
  try{
    const masters=await repo.masters(
      pool,
      req.session.user.organization_id
    );
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

    console.info('[PURCHASE] Received',{
      purchaseId:purchase.id,
      purchaseNumber:purchase.purchase_number,
      branchId:req.branch.id,
      userId:req.session.user.id,
      total:purchase.total
    });

    setFlash(
      req,
      'success',
      `Purchase ${purchase.purchase_number} received and stock posted successfully.`
    );

    res.redirect('/purchases');
  }catch(error){
    console.warn('[PURCHASE] Receive failed',{
      branchId:req.branch.id,
      userId:req.session.user.id,
      code:error.code||'PURCHASE_ERROR',
      message:error.message
    });
    next(error);
  }
}

module.exports={index,newForm,create};

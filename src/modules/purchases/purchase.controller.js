const {pool}=require('../../config/db');
const repo=require('./purchase.repository');
const service=require('./purchase.service');

async function index(req,res,next){try{
  const purchases=await repo.list(pool,req.session.user.organization_id,req.branch.id);
  res.render('purchases/index',{title:'Purchases',purchases});
}catch(e){next(e);}}

async function newForm(req,res,next){try{
  const masters=await repo.masters(pool,req.session.user.organization_id);
  res.render('purchases/new',{title:'Receive Purchase',...masters});
}catch(e){next(e);}}

async function create(req,res,next){try{
  await service.receivePurchase(req.body,{user:req.session.user,branch:req.branch});
  res.redirect('/purchases');
}catch(e){next(e);}}

module.exports={index,newForm,create};

const {pool}=require('../../config/db');
const repo=require('./medicine.repository');
const service=require('./medicine.service');

async function index(req,res,next){try{
  const medicines=await repo.list(pool,req.session.user.organization_id,req.query.q||'');
  res.render('medicines/index',{title:'Medicines',medicines,q:req.query.q||''});
}catch(e){next(e);}}

async function newForm(req,res,next){try{
  const masters=await repo.masters(pool,req.session.user.organization_id);
  res.render('medicines/new',{title:'Add Medicine',...masters});
}catch(e){next(e);}}

async function create(req,res,next){try{
  await service.createMedicine(req.body,{user:req.session.user,branch:req.branch});
  res.redirect('/medicines');
}catch(e){next(e);}}

async function barcode(req,res,next){try{
  const medicine=await repo.byBarcode(pool,req.session.user.organization_id,req.branch.id,req.params.barcode);
  if(!medicine)return res.status(404).json({error:'Medicine not found'});
  res.json(medicine);
}catch(e){next(e);}}

async function searchApi(req,res,next){try{
  const medicines=await repo.list(pool,req.session.user.organization_id,req.query.q||'');
  res.json(medicines);
}catch(e){next(e);}}

module.exports={index,newForm,create,barcode,searchApi};

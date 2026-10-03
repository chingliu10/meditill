const {pool}=require('../../config/db');
const repo=require('./supplier.repository');
const service=require('./supplier.service');
const {setFlash}=require('../../shared/flash');

async function index(req,res,next){
  try{
    const suppliers=await repo.list(pool,req.session.user.organization_id);
    res.render('suppliers/index',{title:'Suppliers',suppliers});
  }catch(error){
    next(error);
  }
}

async function create(req,res,next){
  try{
    const supplier=await service.createSupplier(
      req.body,
      req.session.user.organization_id
    );
    setFlash(req,'success',`${supplier.name} created successfully.`);
    res.redirect('/suppliers');
  }catch(error){
    next(error);
  }
}

async function searchApi(req,res,next){
  try{
    res.json(await repo.search(
      pool,
      req.session.user.organization_id,
      req.query.q||''
    ));
  }catch(error){
    next(error);
  }
}

module.exports={index,create,searchApi};

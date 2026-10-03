const {pool}=require('../../config/db');
const repo=require('./customer.repository');
const service=require('./customer.service');
const {setFlash}=require('../../shared/flash');

async function index(req,res,next){
  try{
    const customers=await repo.list(pool,req.session.user.organization_id,req.query.q||'');
    res.render('customers/index',{title:'Customers',customers,q:req.query.q||''});
  }catch(error){next(error);}
}
async function create(req,res,next){
  try{
    const customer=await service.createCustomer(req.body,req.session.user.organization_id);
    if(req.get('accept')?.includes('application/json')) return res.status(201).json(customer);
    setFlash(req,'success',`${customer.name} created successfully.`);
    res.redirect('/customers');
  }catch(error){next(error);}
}
async function search(req,res,next){
  try{
    res.json(await repo.list(pool,req.session.user.organization_id,req.query.q||''));
  }catch(error){next(error);}
}
module.exports={index,create,search};

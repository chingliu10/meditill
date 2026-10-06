const {pool}=require('../../config/db');
const repo=require('./customer.repository');
const service=require('./customer.service');
const {setFlash}=require('../../shared/flash');
const {safePage,pagination}=require('../../shared/list-pagination');

function makeUrl(q,showArchived,page){
  const params=new URLSearchParams();
  if(q)params.set('q',q);
  if(showArchived)params.set('archived','1');
  if(page>1)params.set('page',String(page));
  return '/customers'+(params.toString()?('?'+params.toString()):'');
}

async function index(req,res,next){
  try{
    const showArchived=req.query.archived==='1';
    const q=String(req.query.q||'').trim();
    const requestedPage=safePage(req.query.page);
    let result=await repo.list(pool,req.session.user.organization_id,q,showArchived,requestedPage,25);
    const pager=pagination(result.total,requestedPage,25,page=>makeUrl(q,showArchived,page));

    if(pager.page!==requestedPage){
      result=await repo.list(pool,req.session.user.organization_id,q,showArchived,pager.page,25);
    }

    res.render('customers/index',{title:'Customers',customers:result.rows,q,showArchived,pagination:pager});
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
  try{res.json(await repo.search(pool,req.session.user.organization_id,req.query.q||''));}
  catch(error){next(error);}
}

async function archive(req,res,next){
  try{
    const customer=await service.setCustomerActive(Number(req.params.id),false,req.session.user.organization_id);
    setFlash(req,'success',`${customer.name} archived. Sales history was preserved.`);
    res.redirect('/customers?archived=1');
  }catch(error){next(error);}
}

async function restore(req,res,next){
  try{
    const customer=await service.setCustomerActive(Number(req.params.id),true,req.session.user.organization_id);
    setFlash(req,'success',`${customer.name} restored.`);
    res.redirect('/customers?archived=1');
  }catch(error){next(error);}
}

module.exports={index,create,search,archive,restore};

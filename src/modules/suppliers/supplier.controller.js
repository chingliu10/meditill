const {pool}=require('../../config/db');
const repo=require('./supplier.repository');
const service=require('./supplier.service');
const {setFlash}=require('../../shared/flash');
const {safePage,pagination}=require('../../shared/list-pagination');

function makeUrl(q,showArchived,page){
  const params=new URLSearchParams();
  if(q)params.set('q',q);
  if(showArchived)params.set('archived','1');
  if(page>1)params.set('page',String(page));
  return '/suppliers'+(params.toString()?('?'+params.toString()):'');
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
    res.render('suppliers/index',{title:'Suppliers',suppliers:result.rows,q,showArchived,pagination:pager});
  }catch(error){next(error);}
}

async function create(req,res,next){
  try{
    const supplier=await service.createSupplier(req.body,req.session.user.organization_id);
    setFlash(req,'success',`${supplier.name} created successfully.`);
    res.redirect('/suppliers');
  }catch(error){next(error);}
}

async function searchApi(req,res,next){
  try{res.json(await repo.search(pool,req.session.user.organization_id,req.query.q||''));}
  catch(error){next(error);}
}

async function archive(req,res,next){
  try{
    const supplier=await service.setSupplierActive(Number(req.params.id),false,req.session.user.organization_id);
    setFlash(req,'success',`${supplier.name} archived. Purchase history was preserved.`);
    res.redirect('/suppliers?archived=1');
  }catch(error){next(error);}
}

async function restore(req,res,next){
  try{
    const supplier=await service.setSupplierActive(Number(req.params.id),true,req.session.user.organization_id);
    setFlash(req,'success',`${supplier.name} restored.`);
    res.redirect('/suppliers?archived=1');
  }catch(error){next(error);}
}

module.exports={index,create,searchApi,archive,restore};

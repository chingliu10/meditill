const {pool}=require('../../config/db');const repo=require('./medicine.repository');const service=require('./medicine.service');const {setFlash}=require('../../shared/flash');const {appError}=require('../../shared/app-error');const {safePage,pagination}=require('../../shared/list-pagination');
function medicineListUrl(q,page){
  const params=new URLSearchParams();
  if(q)params.set('q',q);
  if(page>1)params.set('page',String(page));
  return '/medicines'+(params.toString()?('?'+params.toString()):'');
}
async function index(req,res,next){
  try{
    const q=String(req.query.q||'').trim();
    const requestedPage=safePage(req.query.page);
    let result=await repo.list(pool,req.session.user.organization_id,q,req.branch.id,requestedPage,25);
    const pager=pagination(result.total,requestedPage,25,page=>medicineListUrl(q,page));
    if(pager.page!==requestedPage) result=await repo.list(pool,req.session.user.organization_id,q,req.branch.id,pager.page,25);
    res.render('medicines/index',{title:'Medicines',medicines:result.rows,q,pagination:pager});
  }catch(e){next(e);}
}
async function newForm(req,res,next){try{res.render('medicines/new',{title:'Add Medicine',...(await repo.masters(pool,req.session.user.organization_id))});}catch(e){next(e);}}
async function create(req,res,next){try{const m=await service.createMedicine(req.body,{user:req.session.user,branch:req.branch});setFlash(req,'success',`${m.name} created successfully.`);res.redirect('/medicines');}catch(e){next(e);}}
async function editForm(req,res,next){try{const d=await repo.get(pool,req.session.user.organization_id,Number(req.params.id));if(!d)throw appError('Medicine not found',404);res.render('medicines/edit',{title:'Edit '+d.medicine.name,...d,...(await repo.masters(pool,req.session.user.organization_id))});}catch(e){next(e);}}
async function update(req,res,next){try{const m=await service.updateMedicine(Number(req.params.id),req.body,{user:req.session.user,branch:req.branch});setFlash(req,'success',`${m.name} updated.`);res.redirect('/medicines/'+m.id+'/edit');}catch(e){next(e);}}
async function deactivate(req,res,next){try{await service.deactivateMedicine(Number(req.params.id),{user:req.session.user,branch:req.branch});setFlash(req,'success','Medicine deactivated.');res.redirect('/medicines');}catch(e){next(e);}}
async function addBarcode(req,res,next){try{await service.addBarcode(Number(req.params.id),req.body,{user:req.session.user});setFlash(req,'success','Barcode added.');res.redirect('/medicines/'+req.params.id+'/edit');}catch(e){next(e);}}
async function removeBarcode(req,res,next){try{const m=await repo.get(pool,req.session.user.organization_id,Number(req.params.id));if(!m)throw appError('Medicine not found',404);await repo.removeBarcode(pool,Number(req.params.id),Number(req.params.barcodeId));setFlash(req,'success','Barcode removed.');res.redirect('/medicines/'+req.params.id+'/edit');}catch(e){next(e);}}
async function addPackage(req,res,next){try{await service.addPackage(Number(req.params.id),req.body,{user:req.session.user});setFlash(req,'success','Package added.');res.redirect('/medicines/'+req.params.id+'/edit');}catch(e){next(e);}}
async function removePackage(req,res,next){try{const m=await repo.get(pool,req.session.user.organization_id,Number(req.params.id));if(!m)throw appError('Medicine not found',404);await repo.removePackage(pool,Number(req.params.id),Number(req.params.packageId));setFlash(req,'success','Package removed.');res.redirect('/medicines/'+req.params.id+'/edit');}catch(e){next(e);}}
async function barcode(req,res,next){try{const m=await repo.byBarcode(pool,req.session.user.organization_id,req.branch.id,req.params.barcode);if(!m)return res.status(404).json({error:'Medicine not found'});res.json(m);}catch(e){next(e);}}
async function searchApi(req,res,next){try{res.json(await repo.search(pool,req.session.user.organization_id,req.query.q||'',req.branch.id,25));}catch(e){next(e);}}
module.exports={index,newForm,create,editForm,update,deactivate,addBarcode,removeBarcode,addPackage,removePackage,barcode,searchApi};
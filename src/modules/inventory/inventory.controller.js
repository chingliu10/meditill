const {pool}=require('../../config/db');const repo=require('./inventory.repository');const service=require('./inventory.service');const {setFlash}=require('../../shared/flash');
async function index(req,res,next){try{const [stock,batches]=await Promise.all([repo.stock(pool,req.session.user.organization_id,req.branch.id),repo.batches(pool,req.branch.id,req.query.q||'')]);res.render('inventory/index',{title:'Inventory',stock,batches,q:req.query.q||''});}catch(e){next(e);}}
async function expiring(req,res,next){try{res.json(await repo.expiring(pool,req.branch.id,Number(req.query.days||90)));}catch(e){next(e);}}
async function adjust(req,res,next){try{const a=await service.adjust(req.body,{user:req.session.user,branch:req.branch});setFlash(req,'success',`Adjustment ${a.adjustment_number} posted.`);res.redirect('/inventory');}catch(e){next(e);}}
async function status(req,res,next){try{const b=await service.changeStatus({batch_id:req.params.id,status:req.body.status},{user:req.session.user,branch:req.branch});res.json(b);}catch(e){next(e);}}
module.exports={index,expiring,adjust,status};

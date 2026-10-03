const {pool}=require('../../config/db');const repo=require('./supplier.repository');const service=require('./supplier.service');
async function index(req,res,next){try{const suppliers=await repo.list(pool,req.session.user.organization_id);res.render('suppliers/index',{title:'Suppliers',suppliers});}catch(e){next(e);}}
async function create(req,res,next){try{await service.createSupplier(req.body,req.session.user.organization_id);res.redirect('/suppliers');}catch(e){next(e);}}
module.exports={index,create};

const {pool}=require('../../config/db');const repo=require('./inventory.repository');
async function index(req,res,next){try{const stock=await repo.stock(pool,req.session.user.organization_id,req.branch.id);res.render('inventory/index',{title:'Inventory',stock});}catch(e){next(e);}}
async function expiring(req,res,next){try{res.json(await repo.expiring(pool,req.branch.id,Number(req.query.days||90)));}catch(e){next(e);}}
module.exports={index,expiring};

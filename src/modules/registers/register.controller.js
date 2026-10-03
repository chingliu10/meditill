const {pool}=require('../../config/db');const repo=require('./register.repository');const service=require('./register.service');
async function index(req,res,next){try{const [registers,current]=await Promise.all([repo.registers(pool,req.branch.id),repo.current(pool,req.session.user.id)]);res.render('registers/index',{title:'Registers',registers,current});}catch(e){next(e);}}
async function open(req,res,next){try{const session=await service.open(req.body,{user:req.session.user,branch:req.branch});res.json(session);}catch(e){next(e);}}
async function close(req,res,next){try{const session=await service.close(req.body,{user:req.session.user,branch:req.branch});res.json(session);}catch(e){next(e);}}
module.exports={index,open,close};

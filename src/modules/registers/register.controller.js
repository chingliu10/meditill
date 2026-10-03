const {pool}=require('../../config/db');
const repo=require('./register.repository');
const service=require('./register.service');

async function index(req,res,next){
  try{
    const [registers,current]=await Promise.all([
      repo.registers(pool,req.branch.id),
      repo.current(pool,req.session.user.id,req.branch.id)
    ]);
    res.render('registers/index',{title:'Registers',registers,current});
  }catch(error){
    next(error);
  }
}

async function open(req,res,next){
  try{
    const session=await service.open(req.body,{user:req.session.user,branch:req.branch});
    console.info('[REGISTER] Opened', {
      sessionId:session.id,
      registerId:session.register_id,
      branchId:session.branch_id,
      userId:session.user_id,
      openingCash:session.opening_cash
    });
    res.json(session);
  }catch(error){
    next(error);
  }
}

async function close(req,res,next){
  try{
    const session=await service.close(req.body,{user:req.session.user,branch:req.branch});
    console.info('[REGISTER] Closed', {
      sessionId:session.id,
      branchId:session.branch_id,
      userId:session.user_id,
      expectedCash:session.expected_cash,
      actualCash:session.actual_cash,
      difference:session.difference
    });
    res.json(session);
  }catch(error){
    next(error);
  }
}

module.exports={index,open,close};

const {pool}=require('../../config/db');
const repo=require('./register.repository');
const service=require('./register.service');
const {setFlash}=require('../../shared/flash');
const {appError}=require('../../shared/app-error');

function safeReturnPath(value){
  const path=String(value||'');
  return path.startsWith('/')&&!path.startsWith('//')?path:'';
}

async function index(req,res,next){
  try{
    const [registers,current,lastClosed]=await Promise.all([
      repo.registers(pool,req.branch.id),
      repo.current(pool,req.session.user.id,req.branch.id),
      repo.latestClosed(pool,req.session.user.id,req.branch.id)
    ]);
    let expectedCash=null;
    if(current) expectedCash=await repo.expectedCash(pool,current.id);
    const activeRegisters=registers.filter(register=>register.active===true);
    const availableRegisters=activeRegisters.filter(register=>register.available===true);
    res.render('registers/index',{
      title:'Registers',
      registers,
      activeRegisters,
      availableRegisters,
      hasActiveRegisters:activeRegisters.length>0,
      hasAvailableRegisters:availableRegisters.length>0,
      current,
      lastClosed,
      expectedCash,
      returnPath:safeReturnPath(req.query.return)
    });
  }catch(error){next(error);}
}

async function create(req,res,next){
  try{
    const name=String(req.body.name||'').trim();
    if(!name) throw appError('Register name is required');
    const register=await repo.createRegister(pool,req.branch.id,name);
    setFlash(req,'success',`${register.name} created.`);
    res.redirect('/registers');
  }catch(error){next(error);}
}

async function open(req,res,next){
  try{
    const session=await service.open(req.body,{user:req.session.user,branch:req.branch});
    res.json(session);
  }catch(error){
    console.error('[REGISTER] Open failed',{userId:req.session.user?.id,branchId:req.branch?.id,code:error.code,constraint:error.constraint,detail:error.detail,message:error.message});
    next(error);
  }
}

async function close(req,res,next){
  try{
    const session=await service.close(req.body,{user:req.session.user,branch:req.branch});
    res.json(session);
  }catch(error){
    console.error('[REGISTER] Close failed',{userId:req.session.user?.id,branchId:req.branch?.id,actualCash:req.body?.actual_cash,code:error.code,constraint:error.constraint,detail:error.detail,message:error.message});
    next(error);
  }
}

module.exports={index,create,open,close};

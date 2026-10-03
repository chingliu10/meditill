const {withTransaction}=require('../../config/db');
const repo=require('./register.repository');
const {appError}=require('../../shared/app-error');

async function open(input,ctx){
  const registerId=Number(input.register_id);
  const openingCash=Number(input.opening_cash||0);

  if(!Number.isInteger(registerId) || registerId<=0){
    throw appError('Choose a valid register');
  }
  if(!Number.isFinite(openingCash) || openingCash<0){
    throw appError('Opening cash must be zero or greater');
  }

  return withTransaction(async client=>{
    const existing=await repo.current(client,ctx.user.id,ctx.branch.id);
    if(existing){
      throw appError(`You already have an open register session in ${existing.branch_name}`,409,'REGISTER_ALREADY_OPEN');
    }

    const register=await repo.findRegister(client,registerId,ctx.branch.id);
    if(!register) throw appError('Register does not belong to the current branch',400,'INVALID_REGISTER');

    const occupied=await repo.currentRegister(client,register.id);
    if(occupied){
      throw appError(`${register.name} is already open by ${occupied.user_name}`,409,'REGISTER_IN_USE');
    }

    try{
      return await repo.openSession(client,register.id,ctx.branch.id,ctx.user.id,openingCash);
    }catch(error){
      if(error.code==='23505'){
        throw appError('This register or user session was opened by another request. Refresh and try again.',409,'REGISTER_CONFLICT');
      }
      throw error;
    }
  });
}

async function close(input,ctx){
  return withTransaction(async client=>{
    const session=await repo.currentForUpdate(client,ctx.user.id,ctx.branch.id);
    if(!session) throw appError('No open register session for this branch',409,'NO_OPEN_REGISTER');

    const expected=await repo.expectedCash(client,session.id);
    const actual=Number(input.actual_cash);

    if(!Number.isFinite(actual)||actual<0){
      throw appError('Actual cash is required');
    }

    const closed=await repo.close(client,session.id,actual,expected);if(!closed)throw appError('Register session changed before it could be closed',409,'REGISTER_CLOSE_CONFLICT');return closed;
  });
}

module.exports={open,close};

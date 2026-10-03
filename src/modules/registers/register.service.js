const {withTransaction,pool}=require('../../config/db');
const repo=require('./register.repository');
const {appError}=require('../../shared/app-error');

async function open(input,ctx){
  const existing=await repo.current(pool,ctx.user.id);
  if(existing) throw appError('You already have an open register session');
  const opening=Math.max(0,Number(input.opening_cash||0));
  return withTransaction(client=>repo.openSession(client,Number(input.register_id),ctx.branch.id,ctx.user.id,opening));
}
async function close(input,ctx){
  return withTransaction(async client=>{
    const session=await repo.current(client,ctx.user.id);
    if(!session) throw appError('No open register session');
    const expected=await repo.expectedCash(client,session.id);
    const actual=Number(input.actual_cash);
    if(!Number.isFinite(actual)||actual<0) throw appError('Actual cash is required');
    return repo.close(client,session.id,actual,expected);
  });
}
module.exports={open,close};

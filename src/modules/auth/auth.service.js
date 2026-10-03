const bcrypt=require('bcryptjs');
const { pool }=require('../../config/db');
const repo=require('./auth.repository');
const { appError }=require('../../shared/app-error');

async function login(username,password) {
  const user=await repo.findLoginUser(pool,String(username||'').trim());
  if (!user || !(await bcrypt.compare(String(password||''),user.password_hash))) {
    throw appError('Invalid username or password',401,'INVALID_LOGIN');
  }
  const context=await repo.getUserContext(pool,user.id);
  const branches=await repo.getBranches(pool,user.id);
  if (!branches.length) throw appError('This user has no branch access',403,'NO_BRANCH');
  const currentBranch=branches.find(b=>Number(b.id)===Number(context.default_branch_id)) || branches[0];
  return {user:context,branches,currentBranch};
}
module.exports={login};

const bcrypt=require('bcryptjs');
const {withTransaction}=require('../../config/db');
const repo=require('./user.repository');
const {appError}=require('../../shared/app-error');

function selectedBranches(input,defaultBranchId){
  const raw=Array.isArray(input.branch_ids)?input.branch_ids:[input.branch_ids];
  return Array.from(new Set(
    [...raw,defaultBranchId]
      .map(Number)
      .filter(Boolean)
  ));
}

function validateCore(input,{passwordRequired=false}={}){
  const name=String(input.name||'').trim();
  const username=String(input.username||'').trim();
  const password=String(input.password||'');
  const roleId=Number(input.role_id);
  const defaultBranchId=Number(input.default_branch_id);

  if(!name||!username||!roleId||!defaultBranchId){
    throw appError('Name, username, role and default branch are required');
  }
  if(name.length>160)throw appError('Name must be 160 characters or fewer');
  if(username.length>80)throw appError('Username must be 80 characters or fewer');
  if(passwordRequired&&password.length<8){
    throw appError('Password must be at least 8 characters');
  }
  if(!passwordRequired&&password&&password.length<8){
    throw appError('New password must be at least 8 characters');
  }

  return {name,username,password,roleId,defaultBranchId};
}

async function validateMasters(client,organizationId,roleId,defaultBranchId,branchIds){
  const masters=await repo.masters(client,organizationId);
  if(!masters.roles.some(item=>Number(item.id)===roleId)){
    throw appError('Invalid role');
  }
  if(!masters.branches.some(item=>Number(item.id)===defaultBranchId)){
    throw appError('Invalid default branch');
  }
  for(const id of branchIds){
    if(!masters.branches.some(item=>Number(item.id)===id)){
      throw appError('One or more selected branches are invalid');
    }
  }
}

async function createUser(input,ctx){
  const {name,username,password,roleId,defaultBranchId}=validateCore(input,{passwordRequired:true});
  const branchIds=selectedBranches(input,defaultBranchId);

  return withTransaction(async client=>{
    await validateMasters(client,ctx.user.organization_id,roleId,defaultBranchId,branchIds);
    if(await repo.usernameTaken(client,ctx.user.organization_id,username)){
      throw appError('That username is already in use');
    }

    const hash=await bcrypt.hash(password,12);
    const user=await repo.create(client,{
      organizationId:ctx.user.organization_id,
      defaultBranchId,
      name,
      username,
      email:String(input.email||'').trim(),
      phone:String(input.phone||'').trim(),
      hash
    });

    await repo.role(client,user.id,roleId);
    await repo.replaceBranches(client,user.id,branchIds);
    return user;
  });
}

async function updateUser(id,input,ctx){
  const userId=Number(id);
  if(!userId)throw appError('Invalid user');

  const {name,username,password,roleId,defaultBranchId}=validateCore(input);
  const branchIds=selectedBranches(input,defaultBranchId);

  return withTransaction(async client=>{
    const existing=await repo.findForEdit(client,ctx.user.organization_id,userId);
    if(!existing)throw appError('User not found',404);

    await validateMasters(client,ctx.user.organization_id,roleId,defaultBranchId,branchIds);

    if(await repo.usernameTaken(client,ctx.user.organization_id,username,userId)){
      throw appError('That username is already in use');
    }

    const hash=password?await bcrypt.hash(password,12):null;
    const user=await repo.update(client,{
      organizationId:ctx.user.organization_id,
      id:userId,
      defaultBranchId,
      name,
      username,
      email:String(input.email||'').trim(),
      phone:String(input.phone||'').trim(),
      hash
    });

    await repo.replaceRole(client,userId,roleId);
    await repo.replaceBranches(client,userId,branchIds);
    return user;
  });
}

module.exports={createUser,updateUser};

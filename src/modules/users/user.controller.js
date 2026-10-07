const {pool}=require('../../config/db');
const repo=require('./user.repository');
const service=require('./user.service');
const authRepo=require('../auth/auth.repository');
const {setFlash}=require('../../shared/flash');
const {appError}=require('../../shared/app-error');

async function index(req,res,next){
  try{
    const [users,masters]=await Promise.all([
      repo.list(pool,req.session.user.organization_id),
      repo.masters(pool,req.session.user.organization_id)
    ]);
    res.render('users/index',{title:'Users',users,...masters});
  }catch(error){next(error);}
}

async function editForm(req,res,next){
  try{
    const id=Number(req.params.id);
    if(!id)throw appError('Invalid user');

    const [editUser,masters]=await Promise.all([
      repo.findForEdit(pool,req.session.user.organization_id,id),
      repo.masters(pool,req.session.user.organization_id)
    ]);
    if(!editUser)throw appError('User not found',404);

    const selectedBranches=new Set(editUser.branch_ids.map(Number));
    const roles=masters.roles.map(role=>({
      ...role,
      selected:Number(role.id)===Number(editUser.role_id)
    }));
    const branches=masters.branches.map(branch=>({
      ...branch,
      selected:Number(branch.id)===Number(editUser.default_branch_id),
      checked:selectedBranches.has(Number(branch.id))
    }));

    res.render('users/edit',{
      title:'Edit User',
      editUser,
      roles,
      branches
    });
  }catch(error){next(error);}
}

async function create(req,res,next){
  try{
    const user=await service.createUser(req.body,{user:req.session.user});
    setFlash(req,'success',`${user.name} can now sign in.`);
    res.redirect('/users');
  }catch(error){next(error);}
}

async function update(req,res,next){
  try{
    const id=Number(req.params.id);
    const user=await service.updateUser(id,req.body,{user:req.session.user});
    const editingSelf=Number(req.session.user.id)===id;

    if(editingSelf){
      const [context,branches]=await Promise.all([
        authRepo.getUserContext(pool,id),
        authRepo.getBranches(pool,id)
      ]);
      if(!context||!branches.length)throw appError('Updated user context could not be loaded',500);

      const previousBranchId=Number(req.session.currentBranch?.id);
      const currentBranch=
        branches.find(branch=>Number(branch.id)===Number(context.default_branch_id)) ||
        branches.find(branch=>Number(branch.id)===previousBranchId) ||
        branches[0];

      req.session.user=context;
      req.session.branches=branches;
      req.session.currentBranch=currentBranch;

      setFlash(req,'success','Your user account was updated.');
      const canManageUsers=
        context.is_owner===true ||
        (Array.isArray(context.roles)&&context.roles.includes('OWNER')) ||
        (Array.isArray(context.permissions)&&context.permissions.includes('users.manage'));
      return res.redirect(canManageUsers?'/users':'/');
    }

    setFlash(req,'success',`${user.name} was updated.`);
    res.redirect('/users');
  }catch(error){next(error);}
}

async function active(req,res,next){
  try{
    const user=await repo.setActive(
      pool,
      req.session.user.organization_id,
      Number(req.params.id),
      !!req.body.active
    );
    if(!user)return res.status(404).json({error:'User not found'});
    res.json(user);
  }catch(error){next(error);}
}

module.exports={index,editForm,create,update,active};

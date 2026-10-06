const {pool}=require('../../config/db');
const repo=require('./profile.repository');
const {setFlash}=require('../../shared/flash');
const {appError}=require('../../shared/app-error');

async function index(req,res,next){
  try{
    const profile=await repo.getById(
      pool,
      req.session.user.organization_id,
      req.session.user.id
    );
    if(!profile)throw appError('User profile not found',404);
    res.render('profile/index',{title:'My Profile',profile});
  }catch(error){next(error);}
}

async function update(req,res,next){
  try{
    const name=String(req.body.name||'').trim();
    if(!name)throw appError('Name is required');
    if(name.length>160)throw appError('Name must be 160 characters or fewer');

    const profile=await repo.updateName(
      pool,
      req.session.user.organization_id,
      req.session.user.id,
      name
    );
    if(!profile)throw appError('User profile not found',404);

    req.session.user={...req.session.user,name:profile.name};
    setFlash(req,'success','Your name was updated.');
    res.redirect('/profile');
  }catch(error){next(error);}
}

module.exports={index,update};

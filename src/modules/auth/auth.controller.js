const service=require('./auth.service');

function showLogin(req,res){
  if(req.session.user) return res.redirect('/');
  res.render('auth/login',{title:'Login'});
}

async function login(req,res,next){
  const username=String(req.body.username||'').trim();

  // Deliberately never log the password.
  console.info('[AUTH] Login attempt', {
    username,
    ip:req.ip,
    forwardedFor:req.get('x-forwarded-for')||null,
    secure:req.secure
  });

  try{
    const result=await service.login(username,req.body.password);

    req.session.user=result.user;
    req.session.branches=result.branches;
    req.session.currentBranch=result.currentBranch;

    // Explicitly persist the PostgreSQL-backed session before redirecting.
    req.session.save((error)=>{
      if(error){
        console.error('[AUTH] Session save failed', {
          username,
          error:error.message
        });
        return next(error);
      }

      console.info('[AUTH] Login successful', {
        username,
        userId:result.user.id,
        branchId:result.currentBranch.id
      });

      res.redirect('/');
    });
  }catch(error){
    console.warn('[AUTH] Login failed', {
      username,
      code:error.code||'AUTH_ERROR',
      status:error.statusCode||400,
      message:error.message
    });

    res.status(error.statusCode||400).render('auth/login',{
      title:'Login',
      error:error.message,
      username
    });
  }
}

function logout(req,res,next){
  req.session.destroy(error=>error?next(error):res.redirect('/login'));
}

module.exports={showLogin,login,logout};

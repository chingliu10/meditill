const service=require('./auth.service');

function showLogin(req,res){ if(req.session.user)return res.redirect('/'); res.render('auth/login',{title:'Login'}); }

async function login(req,res,next){
  try{
    const result=await service.login(req.body.username,req.body.password);
    req.session.user=result.user;
    req.session.branches=result.branches;
    req.session.currentBranch=result.currentBranch;
    res.redirect('/');
  }catch(e){res.status(e.statusCode||400).render('auth/login',{title:'Login',error:e.message,username:req.body.username});}
}

function logout(req,res,next){req.session.destroy(e=>e?next(e):res.redirect('/login'));}

module.exports={showLogin,login,logout};

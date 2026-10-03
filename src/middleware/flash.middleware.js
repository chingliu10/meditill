function exposeFlash(req,res,next){
  res.locals.flash=req.session && req.session.flash ? req.session.flash : null;
  if(req.session && req.session.flash) delete req.session.flash;
  next();
}

module.exports={exposeFlash};

function requireAuth(req,res,next) {
  if (!req.session.user) return res.redirect('/login');
  req.user = req.session.user;
  next();
}

function exposeUser(req,res,next) {
  res.locals.user = req.session.user || null;
  res.locals.currentBranch = req.session.currentBranch || null;
  next();
}

module.exports = { requireAuth, exposeUser };

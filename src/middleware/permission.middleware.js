function requirePermission(code) {
  return (req,res,next) => {
    const user = req.session.user;
    if (!user) return res.redirect('/login');
    if (user.permissions && user.permissions.includes(code)) return next();
    const error = new Error('You do not have permission to perform this action');
    error.statusCode = 403;
    next(error);
  };
}

module.exports = { requirePermission };

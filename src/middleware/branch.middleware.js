function requireBranch(req,res,next) {
  const branch = req.session.currentBranch;
  if (!branch) {
    const error = new Error('No active branch selected');
    error.statusCode = 400;
    return next(error);
  }
  req.branch = branch;
  next();
}

module.exports = { requireBranch };

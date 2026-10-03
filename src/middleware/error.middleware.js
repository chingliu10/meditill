function notFound(req,res) {
  res.status(404).render('errors/404',{title:'Not Found'});
}

function errorHandler(error,req,res,next) {
  console.error(error);
  const status = error.statusCode || 500;
  const message = status >= 500 ? 'Something went wrong' : error.message;
  if (req.path.startsWith('/api/')) {
    return res.status(status).json({error:message,code:error.code || 'ERROR',details:error.details || null});
  }
  res.status(status).render('errors/error',{title:'Error',message,status});
}

module.exports = { notFound, errorHandler };

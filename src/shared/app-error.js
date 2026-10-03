function appError(message, statusCode = 400, code = 'APP_ERROR', details = null) {
  const error = new Error(message);
  error.statusCode = statusCode;
  error.code = code;
  error.details = details;
  return error;
}

module.exports = { appError };

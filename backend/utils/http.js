function asyncHandler(handler) {
  return function wrappedHandler(req, res, next) {
    Promise.resolve(handler(req, res, next)).catch(next);
  };
}

function createHttpError(statusCode, message, details) {
  const error = new Error(message);
  error.statusCode = statusCode;

  if (Array.isArray(details) && details.length > 0) {
    error.details = details;
  }

  return error;
}

function sendSuccess(res, data, options = {}) {
  const payload = {
    success: true,
    data
  };

  if (options.message) {
    payload.message = options.message;
  }

  return res.status(options.statusCode || 200).json(payload);
}

module.exports = {
  asyncHandler,
  createHttpError,
  sendSuccess
};

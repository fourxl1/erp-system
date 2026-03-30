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
    message: options.message || "",
    data
  };

  return res.status(options.statusCode || 200).json(payload);
}

function sendError(res, statusCode, message, options = {}) {
  const payload = {
    success: false,
    message: message || "Request failed",
    data: options.data === undefined ? null : options.data
  };

  if (Array.isArray(options.errors) && options.errors.length > 0) {
    payload.errors = options.errors;
  }

  return res.status(statusCode || 500).json(payload);
}

module.exports = {
  asyncHandler,
  createHttpError,
  sendSuccess,
  sendError
};

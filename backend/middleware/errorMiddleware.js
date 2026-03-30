const { sendError } = require("../utils/http");

function normalizeDatabaseError(error) {
  if (!error || error.statusCode) {
    return error;
  }

  switch (error.code) {
    case "23505":
      error.statusCode = 409;
      error.message = "A record with the same unique value already exists";
      break;
    case "23503":
      error.statusCode = 409;
      error.message = "The requested change conflicts with related records";
      break;
    case "23514":
      error.statusCode = 400;
      error.message = "The submitted data violates a database rule";
      break;
    case "22P02":
      error.statusCode = 400;
      error.message = "The submitted value has an invalid format";
      break;
    default:
      break;
  }

  return error;
}

function notFound(req, res, next) {
  const error = new Error(`Route not found: ${req.method} ${req.originalUrl}`);
  error.statusCode = 404;
  next(error);
}

function errorHandler(error, req, res, next) {
  const normalizedError = normalizeDatabaseError(error) || new Error("Internal server error");

  if (res.headersSent) {
    return next(normalizedError);
  }

  if (normalizedError instanceof SyntaxError && normalizedError.status === 400 && "body" in normalizedError) {
    normalizedError.statusCode = 400;
    normalizedError.message = "Invalid JSON payload";
  }

  if (normalizedError?.name === "MulterError") {
    normalizedError.statusCode = 400;
  }

  console.error(normalizedError);

  return sendError(res, normalizedError.statusCode || 500, normalizedError.message, {
    errors: normalizedError.details
  });
}

module.exports = {
  notFound,
  errorHandler
};

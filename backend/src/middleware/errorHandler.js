/**
 * Centralized error handler middleware
 */
function errorHandler(err, req, res, next) {
  const statusCode = err.statusCode || err.status || 500;
  const errorMsg = err.message || "Internal server error";
  res.status(statusCode).json({
    success: false,
    error: errorMsg,
    code: err.code || "INTERNAL_ERROR",
    timestamp: new Date().toISOString()
  });
}

module.exports = {
  errorHandler
};

/**
 * Centralized error handler middleware
 */
function errorHandler(err, req, res, next) {
  // Gracefully handle malformed client JSON
  if (err instanceof SyntaxError && err.status === 400 && 'body' in err) {
    return res.status(400).json({
      success: false,
      error: "Invalid JSON format in request body",
      code: "MALFORMED_JSON",
      timestamp: new Date().toISOString()
    });
  }

  const statusCode = err.statusCode || err.status || 500;
  const errorMsg = err.message || "Internal server error";
  
  if (statusCode === 500 && process.env.NODE_ENV !== 'test') {
    console.error(`[UnhandledServerError] ${req.method} ${req.originalUrl}:`, err);
  }

  res.status(statusCode).json({
    success: false,
    error: errorMsg,
    code: err.code || (statusCode === 500 ? "INTERNAL_ERROR" : "REQUEST_FAILED"),
    timestamp: new Date().toISOString()
  });
}

module.exports = {
  errorHandler
};

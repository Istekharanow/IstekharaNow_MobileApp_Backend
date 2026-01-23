// Standard response format
function getResponse(message = '', result = {}, status = false, status_code = 200) {
  return {
    message,
    result,
    status,
    status_code
  };
}

// Extract error message from nested error objects
function getErrorMessage(errorDict) {
  if (typeof errorDict === 'string') {
    return errorDict;
  }

  if (Array.isArray(errorDict)) {
    if (errorDict.length > 0) {
      if (typeof errorDict[0] === 'object') {
        return getErrorMessage(errorDict[0]);
      }
      return errorDict[0];
    }
    return 'Validation error';
  }

  if (typeof errorDict === 'object') {
    const keys = Object.keys(errorDict);
    if (keys.length > 0) {
      const firstKey = keys[0];
      return getErrorMessage(errorDict[firstKey]);
    }
  }

  return 'An error occurred';
}

// Not found handler
const notFoundHandler = (req, res, next) => {
  res.status(404).json(getResponse('Page not found, invalid url', {}, false, 404));
};

// Global error handler
const errorHandler = (err, req, res, next) => {
  console.error('Error:', err);

  // Handle validation errors
  if (err.name === 'SequelizeValidationError' || err.name === 'SequelizeUniqueConstraintError') {
    const message = err.errors && err.errors.length > 0 
      ? err.errors[0].message 
      : 'Validation error';
    return res.status(400).json(getResponse(message, {}, false, 400));
  }

  // Handle custom validation errors
  if (err.statusCode) {
    return res.status(err.statusCode).json(
      getResponse(err.message || 'Error occurred', {}, false, err.statusCode)
    );
  }

  // Default server error
  const statusCode = err.status || 500;
  const message = statusCode === 500 
    ? 'Internal server error, please try again later' 
    : err.message || 'An error occurred';

  res.status(statusCode).json(getResponse(message, {}, false, statusCode));
};

// Custom error class
class ValidationError extends Error {
  constructor(message) {
    super(message);
    this.name = 'ValidationError';
    this.statusCode = 400;
  }
}

class NotFoundError extends Error {
  constructor(message = 'Resource not found') {
    super(message);
    this.name = 'NotFoundError';
    this.statusCode = 404;
  }
}

module.exports = {
  getResponse,
  getErrorMessage,
  notFoundHandler,
  errorHandler,
  ValidationError,
  NotFoundError
};

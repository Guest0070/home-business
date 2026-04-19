import { ApiError } from '../utils/apiError.js';

export function notFound(req, _res, next) {
  next(new ApiError(404, `Route not found: ${req.method} ${req.originalUrl}`));
}

export function errorHandler(error, _req, res, _next) {
  if (error.code === '23505') {
    return res.status(409).json({ message: 'Duplicate record', details: error.detail });
  }

  if (error.code === '23503') {
    return res.status(409).json({ message: 'Record is linked to other data', details: error.detail });
  }

  const statusCode = error.statusCode || 500;
  const body = {
    message: statusCode === 500 ? 'Internal server error' : error.message
  };

  if (error.details) body.details = error.details;
  if (process.env.NODE_ENV !== 'production' && statusCode === 500) body.stack = error.stack;

  res.status(statusCode).json(body);
}


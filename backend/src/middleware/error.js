import { logger } from '../lib/logger.js';

export function errorHandler(err, req, res, _next) {
  const status = err.status || 500;
  if (status >= 500) logger.error({ err, path: req.path }, 'request failed');
  res.status(status).json({ error: err.message || 'internal error' });
}

export class HttpError extends Error {
  constructor(status, message) { super(message); this.status = status; }
}

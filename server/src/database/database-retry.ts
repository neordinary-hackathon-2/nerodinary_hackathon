const TRANSIENT_MYSQL_ERROR_CODES = new Set([
  'ECONNRESET',
  'ECONNREFUSED',
  'ETIMEDOUT',
  'EPIPE',
  'PROTOCOL_CONNECTION_LOST',
  'PROTOCOL_ENQUEUE_AFTER_FATAL_ERROR',
  'PROTOCOL_ENQUEUE_AFTER_QUIT',
  'ER_LOCK_DEADLOCK',
  'ER_LOCK_WAIT_TIMEOUT',
]);

/** Retry only errors that may clear when the DB connection/query is attempted again. */
export function isTransientDatabaseError(error: unknown): boolean {
  let current: unknown = error;
  const visited = new Set<object>();

  while (current && typeof current === 'object' && !visited.has(current)) {
    visited.add(current);

    const code = Reflect.get(current, 'code');
    if (typeof code === 'string' && TRANSIENT_MYSQL_ERROR_CODES.has(code)) {
      return true;
    }

    current = Reflect.get(current, 'cause');
  }

  return false;
}

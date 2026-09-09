export function success(data, receivedAt) {
  return receivedAt === undefined
    ? { ok: true, data }
    : { ok: true, data, receivedAt };
}

export function failure(code, message, retryable, httpStatus) {
  const error = { code, message, retryable };
  if (httpStatus !== undefined) {
    error.httpStatus = httpStatus;
  }
  return { ok: false, error };
}

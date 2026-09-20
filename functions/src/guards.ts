import { HttpsError, type CallableRequest } from 'firebase-functions/v2/https';

/** Every callable needs an authenticated caller; players are anonymous-auth users. */
export function requireAuth(request: CallableRequest): string {
  const uid = request.auth?.uid;
  if (!uid) {
    throw new HttpsError('unauthenticated', 'Sign in before calling this function.');
  }
  return uid;
}

/** Only a signed-in host (not an anonymous player) may run host-side calls. */
export function requireHost(request: CallableRequest): string {
  const uid = requireAuth(request);
  if (request.auth?.token.firebase?.sign_in_provider === 'anonymous') {
    throw new HttpsError('permission-denied', 'Only a host can do that.');
  }
  return uid;
}

export function requireString(value: unknown, field: string, maxLength = 200): string {
  if (typeof value !== 'string' || !value.trim()) {
    throw new HttpsError('invalid-argument', `"${field}" is required.`);
  }
  if (value.length > maxLength) {
    throw new HttpsError('invalid-argument', `"${field}" is too long.`);
  }
  return value.trim();
}

import type { VercelRequest, VercelResponse } from '@vercel/node';
import { adminAuth } from './admin.js';

/**
 * The HTTP equivalent of a Firebase callable.
 *
 * Callables verified the caller's ID token automatically; here the client sends
 * it as a bearer token and each route verifies it. Routes are same-origin with
 * the app, so there is no CORS to configure.
 */

export class HttpError extends Error {
  constructor(
    readonly status: number,
    message: string,
    readonly reason?: string,
  ) {
    super(message);
  }
}

/** Mirrors the HttpsError codes the client already knows how to read. */
export const badRequest = (m: string, reason?: string) => new HttpError(400, m, reason);
export const unauthorized = (m = 'Sign in first.') => new HttpError(401, m);
export const forbidden = (m: string, reason?: string) => new HttpError(403, m, reason);
export const notFound = (m: string) => new HttpError(404, m);
export const conflict = (m: string, reason?: string) => new HttpError(409, m, reason);
export const tooMany = (m: string, reason?: string) => new HttpError(429, m, reason);
export const gone = (m: string, reason?: string) => new HttpError(410, m, reason);

export interface Caller {
  uid: string;
  /** 'anonymous' for players; 'password' or 'google.com' for a host. */
  provider: string;
}

export async function authenticate(request: VercelRequest): Promise<Caller> {
  const header = request.headers.authorization ?? '';
  const token = header.startsWith('Bearer ') ? header.slice(7).trim() : '';
  if (!token) throw unauthorized();

  try {
    const decoded = await adminAuth().verifyIdToken(token);
    return {
      uid: decoded.uid,
      provider: (decoded.firebase?.sign_in_provider as string) ?? 'unknown',
    };
  } catch {
    throw unauthorized('Your session expired. Reload and try again.');
  }
}

/** Host-only routes: an anonymous player must never reach them. */
export async function authenticateHost(request: VercelRequest): Promise<Caller> {
  const caller = await authenticate(request);
  if (caller.provider === 'anonymous') throw forbidden('Only a host can do that.');
  return caller;
}

export function requireString(value: unknown, field: string, maxLength = 200): string {
  if (typeof value !== 'string' || !value.trim()) throw badRequest(`"${field}" is required.`);
  if (value.length > maxLength) throw badRequest(`"${field}" is too long.`);
  return value.trim();
}

export function requireIndex(value: unknown, field: string): number {
  const n = Number(value);
  if (!Number.isInteger(n) || n < 0) throw badRequest(`"${field}" is invalid.`);
  return n;
}

type Handler<T> = (request: VercelRequest, response: VercelResponse) => Promise<T>;

/**
 * Wraps a route: POST only, JSON in and out, and HttpError mapped to a status.
 * Anything unexpected is logged and reported as a generic 500, so internal
 * detail never reaches a player's screen.
 */
export function route<T>(handler: Handler<T>) {
  return async (request: VercelRequest, response: VercelResponse) => {
    if (request.method !== 'POST') {
      response.setHeader('Allow', 'POST');
      response.status(405).json({ error: 'Use POST.' });
      return;
    }
    try {
      const result = await handler(request, response);
      if (!response.writableEnded) response.status(200).json(result ?? { ok: true });
    } catch (error) {
      if (error instanceof HttpError) {
        response.status(error.status).json({ error: error.message, reason: error.reason });
        return;
      }
      console.error('Unhandled route error:', error);
      response.status(500).json({ error: 'Something went wrong. Please try again.' });
    }
  };
}

/** The JSON body, tolerating a string body from some runtimes. */
export function body(request: VercelRequest): Record<string, unknown> {
  const raw = request.body;
  if (!raw) return {};
  if (typeof raw === 'string') {
    try {
      return JSON.parse(raw) as Record<string, unknown>;
    } catch {
      throw badRequest('Body must be JSON.');
    }
  }
  return raw as Record<string, unknown>;
}

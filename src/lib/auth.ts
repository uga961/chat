import crypto from 'crypto';
import { cookies } from 'next/headers';
import { checkRateLimit, recordFailedAttempt, resetRateLimit } from './db';
import {
  COOKIE_NAME,
  SESSION_DURATION_SECONDS,
  createSessionToken,
  verifySessionToken,
} from './session';

export { COOKIE_NAME, SESSION_DURATION_SECONDS, createSessionToken, verifySessionToken };

/**
 * Timing-safe key verification to prevent timing attacks.
 */
export function verifyAccessKey(providedKey: string): boolean {
  const expectedKey = process.env.APP_ACCESS_KEY;
  if (!expectedKey) {
    console.warn('[AUTH] APP_ACCESS_KEY is not configured in environment variables');
    return false;
  }

  const providedBuffer = Buffer.from(providedKey.trim());
  const expectedBuffer = Buffer.from(expectedKey.trim());

  if (providedBuffer.length !== expectedBuffer.length) {
    // Constant time dummy comparison
    crypto.timingSafeEqual(expectedBuffer, expectedBuffer);
    return false;
  }

  return crypto.timingSafeEqual(providedBuffer, expectedBuffer);
}

/**
 * Checks if the current server request is authenticated via cookie.
 */
export async function isAuthenticated(): Promise<boolean> {
  const cookieStore = await cookies();
  const token = cookieStore.get(COOKIE_NAME)?.value;
  if (!token) return false;
  return await verifySessionToken(token);
}

/**
 * Attempts authentication with rate limiting and logging.
 */
export function authenticateAttempt(
  key: string,
  ip: string
): { success: boolean; isBlocked?: boolean; remainingSeconds?: number } {
  // Check if IP is currently blocked
  const rateLimitStatus = checkRateLimit(ip);
  if (rateLimitStatus.isBlocked) {
    return {
      success: false,
      isBlocked: true,
      remainingSeconds: rateLimitStatus.remainingSeconds,
    };
  }

  const isValid = verifyAccessKey(key);

  if (isValid) {
    resetRateLimit(ip);
    return { success: true };
  } else {
    const failureStatus = recordFailedAttempt(ip);
    return {
      success: false,
      isBlocked: failureStatus.isBlocked,
      remainingSeconds: failureStatus.remainingSeconds,
    };
  }
}

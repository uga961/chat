import { SignJWT, jwtVerify } from 'jose';

export const COOKIE_NAME = 'chat_session';
export const SESSION_DURATION_SECONDS = 30 * 24 * 60 * 60; // 30 days

function getSecretKey(): Uint8Array {
  const secret =
    process.env.SESSION_SECRET ||
    'fallback-dev-secret-at-least-32-chars-long!';
  return new TextEncoder().encode(secret);
}

/**
 * Creates a signed JWT session token (Edge & Node compatible).
 */
export async function createSessionToken(): Promise<string> {
  const secret = getSecretKey();
  return await new SignJWT({ auth: true })
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setExpirationTime(`${SESSION_DURATION_SECONDS}s`)
    .sign(secret);
}

/**
 * Verifies a JWT session token (Edge & Node compatible).
 */
export async function verifySessionToken(token: string): Promise<boolean> {
  try {
    const secret = getSecretKey();
    const { payload } = await jwtVerify(token, secret);
    return Boolean(payload.auth);
  } catch {
    return false;
  }
}

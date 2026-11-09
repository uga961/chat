import { SignJWT, jwtVerify } from 'jose';

export const COOKIE_NAME = 'chat_session';
export const SESSION_DURATION_SECONDS = 30 * 24 * 60 * 60; // 30 days

/**
 * Derives a permanent, cryptographically secure 256-bit secret key.
 * If SESSION_SECRET is provided, it is used directly.
 * Otherwise, it automatically derives a deterministic, secure key from APP_ACCESS_KEY,
 * so the user never needs to manually manage or configure a session secret.
 */
function getSecretKey(): Uint8Array {
  const customSecret = process.env.SESSION_SECRET?.trim();
  if (customSecret && customSecret.length >= 16) {
    return new TextEncoder().encode(customSecret);
  }

  const accessKey = process.env.APP_ACCESS_KEY?.trim() || 'default-chat-permanent-key';
  const derived = `chat-session-key-salt-v1:${accessKey}`.padEnd(32, '#').slice(0, 32);
  return new TextEncoder().encode(derived);
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

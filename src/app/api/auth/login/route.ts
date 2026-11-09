import { NextRequest, NextResponse } from 'next/server';
import { authenticateAttempt, createSessionToken, COOKIE_NAME, SESSION_DURATION_SECONDS } from '@/lib/auth';

const REDIRECT_ON_FAILURE = 'https://ugandhar.in';

export async function POST(request: NextRequest) {
  // Extract client IP address
  const forwardedFor = request.headers.get('x-forwarded-for');
  const realIp = request.headers.get('x-real-ip');
  const clientIp = forwardedFor ? forwardedFor.split(',')[0].trim() : (realIp || '127.0.0.1');

  let accessKey = '';
  const contentType = request.headers.get('content-type') || '';

  if (contentType.includes('application/json')) {
    try {
      const body = await request.json();
      accessKey = typeof body.accessKey === 'string' ? body.accessKey : '';
    } catch {
      return NextResponse.json({ error: 'Invalid JSON request' }, { status: 400 });
    }
  } else if (contentType.includes('application/x-www-form-urlencoded')) {
    const formData = await request.formData();
    accessKey = (formData.get('accessKey') as string) || '';
  }

  const result = await authenticateAttempt(accessKey, clientIp);

  if (result.isBlocked) {
    return NextResponse.json(
      {
        error: `Too many failed attempts. Try again in ${result.remainingSeconds} seconds.`,
        redirectUrl: REDIRECT_ON_FAILURE,
      },
      { status: 429 }
    );
  }

  if (!result.success) {
    // If incorrect, redirect to https://ugandhar.in
    if (contentType.includes('application/x-www-form-urlencoded')) {
      return NextResponse.redirect(new URL(REDIRECT_ON_FAILURE), 302);
    }
    return NextResponse.json(
      {
        error: 'Invalid access key.',
        redirectUrl: REDIRECT_ON_FAILURE,
      },
      { status: 401 }
    );
  }

  // Key is valid - create session token
  const token = await createSessionToken();
  const response = NextResponse.json({ success: true, redirectUrl: '/' });

  response.cookies.set({
    name: COOKIE_NAME,
    value: token,
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/',
    maxAge: SESSION_DURATION_SECONDS,
  });

  return response;
}

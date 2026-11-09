import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { verifySessionToken, COOKIE_NAME } from '@/lib/session';

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Paths exempt from authentication
  if (
    pathname.startsWith('/login') ||
    pathname.startsWith('/api/auth') ||
    pathname.startsWith('/api/health') ||
    pathname.startsWith('/_next') ||
    pathname === '/favicon.ico'
  ) {
    // If user is already authenticated and visits /login, redirect to chat home
    if (pathname === '/login') {
      const token = request.cookies.get(COOKIE_NAME)?.value;
      if (token && (await verifySessionToken(token))) {
        return NextResponse.redirect(new URL('/', request.url));
      }
    }
    return NextResponse.next();
  }

  // Check authentication for protected paths
  const token = request.cookies.get(COOKIE_NAME)?.value;
  const isAuthenticated = token ? await verifySessionToken(token) : false;

  if (!isAuthenticated) {
    if (pathname.startsWith('/api/')) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    const loginUrl = new URL('/login', request.url);
    return NextResponse.redirect(loginUrl);
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    /*
     * Match all request paths except:
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico, sitemap.xml, robots.txt
     */
    '/((?!_next/static|_next/image|favicon.ico|robots.txt).*)',
  ],
};

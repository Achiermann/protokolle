import { NextResponse } from 'next/server';
import { createServerClient } from '@supabase/ssr';
import { BOOKING_PATH, isBookingPath, safeNext, withNext } from '@/lib/returnTo';

const publicRoutes = ['/login'];

export async function proxy(request) {
  const { pathname } = request.nextUrl;
  const isPublicRoute = publicRoutes.includes(pathname);

  let supabaseResponse = NextResponse.next({ request });

  const supabase = createServerClient(
    process.env.SUPABASE_URL,
    process.env.SUPABASE_ANON_KEY,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value, options }) => {
            request.cookies.set(name, value);
          });
          supabaseResponse = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) => {
            supabaseResponse.cookies.set(name, value, options);
          });
        },
      },
    }
  );

  const { data: { user } } = await supabase.auth.getUser();

  // Requests from the Booking PWA remember to come back to /booking.
  const next = isBookingPath(pathname)
    ? BOOKING_PATH
    : safeNext(request.nextUrl.searchParams.get('next'));

  if (!user && !isPublicRoute) {
    return NextResponse.redirect(new URL(withNext('/login', next), request.url));
  }

  if (user && isPublicRoute) {
    return NextResponse.redirect(new URL(next || '/', request.url));
  }

  if (
    user &&
    (pathname === '/' || isBookingPath(pathname)) &&
    !request.cookies.get('workspace_id')?.value
  ) {
    return NextResponse.redirect(new URL(withNext('/workspace', next), request.url));
  }

  return supabaseResponse;
}

export const config = {
  // PWA files (manifest, service worker, offline page) must be reachable
  // without a session, or install/offline would redirect to /login.
  matcher: [
    '/((?!api|_next/static|_next/image|favicon.ico|sw.js|offline.html|.*\\.png$|.*\\.webmanifest$).*)',
  ],
};

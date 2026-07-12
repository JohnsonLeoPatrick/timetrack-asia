import { NextResponse, type NextRequest } from 'next/server';
import { createServerClient } from '@supabase/ssr';
import { createLocalSupabaseClient } from './lib/supabase/local-db';

const PROTECTED_PATHS = ['/profile'];
const ADMIN_PATHS = ['/admin'];
const ORGANIZER_PATHS = ['/organizer'];
const DEVELOPER_PATHS = ['/developer'];

export async function proxy(request: NextRequest) {
  let response = NextResponse.next({
    request: {
      headers: request.headers,
    },
  });

  const useLocal = process.env.NEXT_PUBLIC_USE_LOCAL_BACKEND === 'true' || process.env.USE_LOCAL_BACKEND === 'true';
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  let user = null;

  if (useLocal || !url || !anonKey) {
    const supabase = createLocalSupabaseClient();
    const { data } = await supabase.auth.getUser();
    user = data?.user;
  } else {
    const supabase = createServerClient(url, anonKey, {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
          response = NextResponse.next({
            request,
          });
          cookiesToSet.forEach(({ name, value, options }) =>
            response.cookies.set(name, value, options)
          );
        },
      },
    });
    const { data } = await supabase.auth.getUser();
    user = data?.user;
  }

  const pathname = request.nextUrl.pathname;

  const isProtected = PROTECTED_PATHS.some(p => pathname.startsWith(p));
  const isAdmin = ADMIN_PATHS.some(p => pathname.startsWith(p));
  const isOrganizer = ORGANIZER_PATHS.some(p => pathname.startsWith(p));
  const isDeveloper = DEVELOPER_PATHS.some(p => pathname.startsWith(p));
  const isAuthPage = pathname.includes('/login') || pathname.includes('/signup') || pathname.includes('/forgot-password');

  // Redirect to login if accessing protected routes without user
  if ((isProtected || isAdmin || isOrganizer || isDeveloper) && !user && !isAuthPage) {
    const loginUrl = new URL('/login', request.url);
    return NextResponse.redirect(loginUrl);
  }

  // Role-based access control for admin/organizer/developer routes
  if (user) {
    const role = user.user_metadata?.role;

    if (isAdmin && role !== 'ADMIN' && role !== 'SUPER_ADMIN') {
      return NextResponse.redirect(new URL('/', request.url));
    }

    if (isOrganizer && role !== 'ORGANIZER' && role !== 'ADMIN' && role !== 'SUPER_ADMIN') {
      return NextResponse.redirect(new URL('/', request.url));
    }

    if (isDeveloper && role !== 'SUPER_ADMIN') {
      return NextResponse.redirect(new URL('/', request.url));
    }

    // Redirect logged-in users away from auth pages
    if (isAuthPage && !pathname.includes('/login')) {
      if (pathname.includes('/signup') || pathname.includes('/forgot-password')) {
        return NextResponse.redirect(new URL('/', request.url));
      }
    }
  }

  return response;
}

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|api/public|api/webhooks|.*\\.(?:svg|png|jpg|jpeg|gif|webp|webm|mp4)$).*)',
  ],
};

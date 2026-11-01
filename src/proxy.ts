import { NextResponse, type NextRequest } from 'next/server';
import { createServerClient } from '@supabase/ssr';
import { createLocalSupabaseClient } from './lib/supabase/local-db';

const PROTECTED_PATHS = ['/profile', '/payments'];
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
  const anonKey = (process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY);

  let user = null;
  let supabase;

  if (useLocal) {
    if (process.env.NODE_ENV === 'production') throw new Error('Local backend is disabled in production');
    supabase = createLocalSupabaseClient();
  } else {
    if (!url || !anonKey) throw new Error('Supabase public configuration is missing');
    supabase = createServerClient(url, anonKey, {
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
  }

  const { data: authData } = await supabase.auth.getUser();
  user = authData?.user;

  // Role is resolved from public.users, not from user-editable auth metadata.
  let role: string | undefined;
  if (user) {
    const { data: profile } = await supabase
      .from('users')
      .select('role, status, deleted_at')
      .eq('id', user.id)
      .single();
    if (profile?.status === 'ACTIVE' && !profile?.deleted_at) role = profile.role;
    else user = null;
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

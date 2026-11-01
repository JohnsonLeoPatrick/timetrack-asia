import { createSupabaseServerClient } from '@/lib/supabase/server';
import { NextResponse } from 'next/server';

export async function GET(request: Request) {
  const url = new URL(request.url);
  const tokenHash = url.searchParams.get('token_hash');
  if (tokenHash && url.searchParams.get('type') === 'recovery') {
    const supabase = await createSupabaseServerClient();
    const { error } = await supabase.auth.verifyOtp({ token_hash: tokenHash, type: 'recovery' });
    if (!error) return NextResponse.redirect(new URL('/reset-password?verified=1', url.origin));
  }
  return NextResponse.redirect(new URL('/forgot-password?error=invalid-recovery-link', url.origin));
}

import { createSupabaseAdminClient } from '@/lib/supabase/server';

export async function enqueueEmail(to: string, subject: string, html: string, options?: {
  scheduledAt?: string;
  attachments?: Record<string, unknown>[];
}) {
  const supabase = await createSupabaseAdminClient();

  const { error } = await supabase.from('email_queue').insert({
    to_address: to,
    subject,
    html_body: html,
    attachments: options?.attachments || [],
    status: 'QUEUED',
    scheduled_at: options?.scheduledAt || null,
  });

  if (error) throw new Error(`Failed to enqueue email: ${error.message}`);
}

export async function processEmailQueue() {
  const supabase = await createSupabaseAdminClient();

  // Only QUEUED emails are picked up. `markEmailFailed` re-queues until the
  // row's own `max_retries` is reached, at which point it flips the status to
  // FAILED so it is never selected again. (There is no per-row column
  // comparison operator in PostgREST, so the retry cap is enforced in
  // markEmailFailed rather than in this filter.)
  const { data: emails, error } = await supabase
    .from('email_queue')
    .select('*')
    .eq('status', 'QUEUED')
    .or(`scheduled_at.is.null,scheduled_at.lte.${new Date().toISOString()}`)
    .order('created_at', { ascending: true })
    .limit(10);

  if (error) throw error;
  return emails || [];
}

export async function markEmailSent(id: string) {
  const supabase = await createSupabaseAdminClient();
  await supabase
    .from('email_queue')
    .update({ status: 'SENT', sent_at: new Date().toISOString() })
    .eq('id', id);
}

export async function markEmailFailed(id: string, errorMessage: string) {
  const supabase = await createSupabaseAdminClient();
  const { data: email } = await supabase
    .from('email_queue')
    .select('retry_count, max_retries')
    .eq('id', id)
    .single();

  const newRetryCount = (email?.retry_count || 0) + 1;
  const status = newRetryCount >= (email?.max_retries || 3) ? 'FAILED' : 'QUEUED';

  await supabase
    .from('email_queue')
    .update({
      status,
      retry_count: newRetryCount,
      error_message: errorMessage,
    })
    .eq('id', id);
}

export async function getEmailQueueStats() {
  const supabase = await createSupabaseAdminClient();

  const [queued, sent, failed] = await Promise.all([
    supabase.from('email_queue').select('*', { count: 'exact', head: true }).eq('status', 'QUEUED'),
    supabase.from('email_queue').select('*', { count: 'exact', head: true }).eq('status', 'SENT'),
    supabase.from('email_queue').select('*', { count: 'exact', head: true }).eq('status', 'FAILED'),
  ]);

  return {
    queued: queued.count || 0,
    sent: sent.count || 0,
    failed: failed.count || 0,
  };
}

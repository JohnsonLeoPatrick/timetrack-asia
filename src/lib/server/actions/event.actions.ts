'use server';

import { createSupabaseServerClient, createSupabasePublicClient } from '@/lib/supabase/server';
import { requireRole } from '@/lib/server/auth/require-role';
import { revalidatePath, cacheLife } from 'next/cache';
import slugify from 'slugify';
import { z } from 'zod';
import { shirtSchema } from '@/lib/runner-checkout';
import { staffEvent } from '@/lib/server/participants';

export async function updateCategoryShirtsAction(eventId: string, categoryId: string, input: unknown) {
  const { client } = await staffEvent(eventId);
  const parsed = z.object({ event_tee_sizes: shirtSchema, finisher_tee_sizes: shirtSchema }).parse(input);
  const { data, error } = await client.from('event_categories').update(parsed).eq('id', z.uuid().parse(categoryId)).eq('event_id', eventId).is('deleted_at', null).select('id').maybeSingle();
  if (error || !data) throw new Error('Category not found or shirt options could not be saved');
  revalidatePath(`/events/${eventId}`);
  revalidatePath(`/organizer/dashboard/events/${eventId}`);
}

const eventSchema = z.object({
  title: z.string().min(3).max(255),
  description: z.string().optional(),
  event_date: z.string(),
  registration_open: z.string(),
  registration_close: z.string(),
  venue_name: z.string().optional(),
  address: z.string().optional(),
  city: z.string().optional(),
  postcode: z.string().optional(),
  country: z.string().optional(),
  max_participants: z.number().optional(),
  bib_format: z.string().optional(),
  terms_and_conditions: z.string().optional(),
  coupons_allowed: z.boolean().optional(),
});

export async function getPublicEventsCached() {
  'use cache';
  cacheLife('minutes');
  try {
    const supabase = createSupabasePublicClient();
    const { data, error } = await supabase
      .from('events')
      .select('*, event_categories(*)')
      .is('deleted_at', null)
      .in('status', ['LIVE', 'APPROVED'])
      .order('event_date', { ascending: true });
    if (error) {
      console.error('Error fetching public events:', error);
      return [];
    }
    return data || [];
  } catch (err) {
    console.error('Failed to get public events:', err);
    return [];
  }
}

export async function getCompletedEventsCached() {
  'use cache';
  cacheLife('minutes');
  try {
    const supabase = createSupabasePublicClient();
    const { data, error } = await supabase
      .from('events')
      .select('*, event_categories(*)')
      .is('deleted_at', null)
      .in('status', ['COMPLETED', 'ENDED'])
      .order('event_date', { ascending: true });
    if (error) {
      console.error('Error fetching completed events:', error);
      return [];
    }
    return data || [];
  } catch (err) {
    console.error('Failed to get completed events:', err);
    return [];
  }
}

export async function getEventCached(id: string) {
  'use cache';
  cacheLife('minutes');
  try {
    const supabase = createSupabasePublicClient();
    const { data, error } = await supabase
      .from('events')
      .select('*, event_categories(*)')
      .eq('id', id)
      .is('deleted_at', null)
      .single();
    if (error) {
      console.error(`Error fetching event ${id}:`, error);
      return null;
    }
    return data;
  } catch (err) {
    console.error(`Failed to get event ${id}:`, err);
    return null;
  }
}

export async function createEventAction(formData: FormData) {
  const supabase = await createSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('Unauthorized');

  const title = formData.get('title') as string;
  const categoriesJson = formData.get('categories') as string;
  const categories = categoriesJson ? JSON.parse(categoriesJson) : [];

  const parsed = eventSchema.parse({
    title,
    description: formData.get('description'),
    event_date: formData.get('event_date'),
    registration_open: formData.get('registration_open'),
    registration_close: formData.get('registration_close'),
    venue_name: formData.get('venue_name'),
    address: formData.get('address'),
    city: formData.get('city'),
    postcode: formData.get('postcode'),
    country: formData.get('country'),
    max_participants: formData.get('max_participants') ? Number(formData.get('max_participants')) : undefined,
    bib_format: formData.get('bib_format') || 'RUN-####',
    terms_and_conditions: formData.get('terms_and_conditions'),
    coupons_allowed: formData.get('coupons_allowed') === 'true',
  });

  const slug = slugify(title, { lower: true, strict: true }) + '-' + Date.now().toString(36);

  const { data: event, error } = await supabase
    .from('events')
    .insert({
      ...parsed,
      slug,
      organizer_id: user.id,
      status: 'DRAFT',
    })
    .select()
    .single();

  if (error) throw new Error(error.message);

  if (categories.length > 0) {
    const { error: catError } = await supabase
      .from('event_categories')
      .insert(categories.map((cat: Record<string, unknown>) => ({ ...cat, event_id: event.id })));

    if (catError) throw new Error(catError.message);
  }

  revalidatePath('/organizer/dashboard', 'page');
  return { success: true, eventId: event.id };
}

export async function updateEventStatusAction(eventId: string, status: string) {
  const supabase = await createSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('Unauthorized');

  const { error } = await supabase
    .from('events')
    .update({ status })
    .eq('id', eventId)
    .eq('organizer_id', user.id);

  if (error) throw new Error(error.message);
  revalidatePath('/organizer/dashboard', 'page');
  revalidatePath('/', 'layout');
}

export async function updateEventCouponsAction(eventId: string, allowed: boolean) {
  const { user } = await requireRole(['ORGANIZER', 'ADMIN', 'SUPER_ADMIN']);
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase.from('events').update({ coupons_allowed: allowed })
    .eq('id', z.uuid().parse(eventId)).eq('organizer_id', user.id).is('deleted_at', null).select('id').maybeSingle();
  if (error || !data) throw new Error('Event not found or could not be updated');
  revalidatePath(`/events/${eventId}`, 'page');
  revalidatePath('/organizer/dashboard', 'page');
}

export async function enableCompleteRegistrationAction(eventId: string) {
  const { user } = await requireRole(['ORGANIZER', 'ADMIN', 'SUPER_ADMIN']);
  const supabase = await createSupabaseServerClient();
  const { data: form } = await supabase.from('form_templates').select('id')
    .eq('name', 'Standard Registration').eq('is_system', true).is('deleted_at', null).maybeSingle();
  if (!form) throw new Error('Standard registration form is unavailable');
  const { data, error } = await supabase.from('events').update({ form_template_id: form.id })
    .eq('id', z.uuid().parse(eventId)).eq('organizer_id', user.id).is('deleted_at', null).select('id').maybeSingle();
  if (error || !data) throw new Error('Event not found or could not be updated');
  revalidatePath(`/events/${eventId}`, 'page');
}

export async function deleteEventAction(eventId: string) {
  const supabase = await createSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('Unauthorized');

  const { error } = await supabase
    .from('events')
    .update({ deleted_at: new Date().toISOString() })
    .eq('id', eventId)
    .eq('organizer_id', user.id);

  if (error) throw new Error(error.message);
  revalidatePath('/organizer/dashboard', 'page');
  revalidatePath('/', 'layout');
}

export async function adminUpdateEventStatusAction(eventId: string, status: string) {
  await requireRole(['ADMIN', 'SUPER_ADMIN']);
  const supabase = await createSupabaseServerClient();

  const { error } = await supabase
    .from('events')
    .update({ status })
    .eq('id', eventId);

  if (error) throw new Error(error.message);
  revalidatePath('/admin/dashboard', 'page');
  revalidatePath('/', 'layout');
}

export async function duplicateEventAction(eventId: string) {
  const supabase = await createSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('Unauthorized');

  // Fetch existing event
  const { data: event, error: fetchError } = await supabase
    .from('events')
    .select('*')
    .eq('id', eventId)
    .eq('organizer_id', user.id)
    .single();

  if (fetchError || !event) throw new Error(fetchError?.message || 'Event not found');

  // Fetch existing categories
  const { data: categories, error: catFetchError } = await supabase
    .from('event_categories')
    .select('*')
    .eq('event_id', eventId);

  if (catFetchError) throw new Error(catFetchError.message);

  const title = `${event.title} (Copy)`;
  const slug = slugify(title, { lower: true, strict: true }) + '-' + Date.now().toString(36);

  // Remove fields that should not be copied directly or are auto-generated
  const { id, created_at, updated_at, deleted_at, ...eventCopy } = event;

  const { data: newEvent, error: insertError } = await supabase
    .from('events')
    .insert({
      ...eventCopy,
      title,
      slug,
      status: 'DRAFT',
      results_finalized: false,
    })
    .select()
    .single();

  if (insertError) throw new Error(insertError.message);

  if (categories && categories.length > 0) {
    const newCategories = categories.map((cat) => {
      const { id: catId, created_at: catCreated, updated_at: catUpdated, deleted_at: catDeleted, ...catCopy } = cat;
      return { ...catCopy, event_id: newEvent.id };
    });

    const { error: catInsertError } = await supabase
      .from('event_categories')
      .insert(newCategories);

    if (catInsertError) throw new Error(catInsertError.message);
  }

  revalidatePath('/organizer/dashboard', 'page');
  return { success: true, eventId: newEvent.id };
}

export async function batchGenerateCertificatesAction(eventId: string) {
  const supabase = await createSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('Unauthorized');

  // Verify ownership
  const { data: event, error: eventError } = await supabase
    .from('events')
    .select('organizer_id')
    .eq('id', eventId)
    .single();

  if (eventError || !event || event.organizer_id !== user.id) {
    throw new Error('Forbidden: You do not have permission to generate certificates for this event.');
  }

  // Fetch results with the participant the result belongs to. `results` has no
  // name column of its own; the athlete name lives on the linked participant.
  const { data: results, error: resultsError } = await supabase
    .from('results')
    .select('*, participants(full_name, registrations(athlete_id))')
    .eq('event_id', eventId);

  if (resultsError) throw new Error(resultsError.message);
  if (!results || results.length === 0) return { success: true, count: 0 };

  // Prepare certificates to insert. `user_id` must be the athlete's user id
  // (FK to users) — participant_id is a participants row, not a user.
  const certificates = results.map((result) => ({
    event_id: eventId,
    user_id: result.participants?.registrations?.athlete_id || null,
    participant_name: result.participants?.full_name || 'Unknown Participant',
  }));

  const { error: insertError } = await supabase
    .from('certificates')
    .insert(certificates);

  if (insertError) throw new Error(insertError.message);

  revalidatePath('/organizer/dashboard', 'page');
  return { success: true, count: certificates.length };
}

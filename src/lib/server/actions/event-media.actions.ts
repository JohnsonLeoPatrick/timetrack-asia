'use server';

import { randomUUID } from 'node:crypto';
import sharp from 'sharp';
import { z } from 'zod';
import { revalidatePath } from 'next/cache';
import { requireRole } from '@/lib/server/auth/require-role';
import { createSupabaseServerClient, createSupabaseAdminClient } from '@/lib/supabase/server';

export async function uploadEventCover(form: FormData) {
  const { user, role } = await requireRole(['ORGANIZER', 'ADMIN', 'SUPER_ADMIN']);
  const eventId = z.uuid().parse(form.get('eventId'));
  const client = await createSupabaseServerClient();
  const { data: event, error } = await client.from('events').select('id, organizer_id').eq('id', eventId).is('deleted_at', null).single();
  if (error || !event || (event.organizer_id !== user.id && !['ADMIN', 'SUPER_ADMIN'].includes(role))) throw new Error('Event not found');
  const file = form.get('image');
  if (!(file instanceof File) || !file.size || file.size > 4 * 1024 * 1024) throw new Error('Choose an image smaller than 4 MB');
  if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.type)) throw new Error('Use a JPEG, PNG, or WebP image');
  // Decode and re-encode raster bytes. MIME labels alone cannot make an upload safe.
  const source = sharp(Buffer.from(await file.arrayBuffer()), { limitInputPixels: 40000000 });
  const metadata = await source.metadata();
  if (!['jpeg', 'png', 'webp'].includes(metadata.format || '') || (metadata.pages || 1) > 1) throw new Error('Choose a static JPEG, PNG, or WebP image');
  const bytes = await source
    .rotate().resize(1920, 1080, { fit: 'inside', withoutEnlargement: true }).webp({ quality: 85 }).toBuffer();
  const admin = await createSupabaseAdminClient();
  const path = `${eventId}/${randomUUID()}.webp`;
  const { error: uploadError } = await admin.storage.from('event-covers').upload(path, bytes, { contentType: 'image/webp', upsert: false, cacheControl: '31536000' });
  if (uploadError) throw new Error('Image upload failed. Please try again.');
  const { data } = admin.storage.from('event-covers').getPublicUrl(path);
  const { data: saved, error: saveError } = await client.from('events').update({ cover_image: data.publicUrl }).eq('id', eventId).select('id').single();
  if (saveError || !saved) {
    await admin.storage.from('event-covers').remove([path]);
    throw new Error('Could not save the event cover');
  }
  revalidatePath('/', 'layout');
  return data.publicUrl;
}

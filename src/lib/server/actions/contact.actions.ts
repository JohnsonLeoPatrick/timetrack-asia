'use server';

import { z } from 'zod';
import { enqueueEmail } from '@/lib/server/email/queue';
import { sanitizeHtml } from '@/lib/server/security/validation';

const contactSchema = z.object({
  name: z.string().min(1).max(200),
  email: z.string().email(),
  message: z.string().min(1).max(5000),
});

export async function sendContactMessageAction(formData: FormData) {
  const parsed = contactSchema.safeParse({
    name: formData.get('name'),
    email: formData.get('email'),
    message: formData.get('message'),
  });

  if (!parsed.success) {
    throw new Error('Please fill in all fields with valid values');
  }

  const { name, email, message } = parsed.data;

  const html = `
    <div style="font-family:Inter,sans-serif;max-width:600px;margin:0 auto">
      <h3 style="margin:0 0 16px">New contact form submission (timetrack.asia)</h3>
      <p><strong>Name:</strong> ${sanitizeHtml(name)}</p>
      <p><strong>Email:</strong> ${sanitizeHtml(email)}</p>
      <pre style="white-space:pre-wrap;background:#f5f5f5;padding:16px;border-radius:8px">${sanitizeHtml(message)}</pre>
    </div>
  `;

  await enqueueEmail('info@timetrack.asia', `Contact form: ${sanitizeHtml(name)}`, html);

  return { success: true };
}
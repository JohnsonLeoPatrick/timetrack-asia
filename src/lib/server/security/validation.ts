import { z } from 'zod';

export const emailSchema = z.string().email('Invalid email address');
export const uuidSchema = z.string().uuid('Invalid UUID');
export const phoneSchema = z.string().regex(/^\+?[\d\s\-()]{8,15}$/, 'Invalid phone number');
export const passwordSchema = z.string().min(8, 'Password must be at least 8 characters');

export const slugSchema = z.string()
  .min(1)
  .max(255)
  .regex(/^[a-z0-9-]+$/, 'Slug must contain only lowercase letters, numbers, and hyphens');

export function sanitizeHtml(input: string): string {
  return input
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#x27;');
}

export function validatePagination(params: {
  page?: number;
  limit?: number;
  maxLimit?: number;
}): { page: number; limit: number; offset: number } {
  const page = Math.max(1, params.page || 1);
  const limit = Math.min(params.maxLimit || 100, Math.max(1, params.limit || 20));
  const offset = (page - 1) * limit;
  return { page, limit, offset };
}

export function validateDateRange(from?: string, to?: string): { from: string; to: string } {
  const now = new Date();
  const defaultFrom = new Date(now.getFullYear(), 0, 1).toISOString();
  const defaultTo = now.toISOString();

  return {
    from: from || defaultFrom,
    to: to || defaultTo,
  };
}

export function parseFormNumber(value: FormDataEntryValue | null): number | undefined {
  if (!value) return undefined;
  const num = Number(value);
  return isNaN(num) ? undefined : num;
}

export function parseFormBoolean(value: FormDataEntryValue | null): boolean | undefined {
  if (value === null || value === '') return undefined;
  const normalized = String(value).trim().toLowerCase();
  if (['true', '1', 'on', 'yes'].includes(normalized)) return true;
  if (['false', '0', 'off', 'no'].includes(normalized)) return false;
  return undefined;
}

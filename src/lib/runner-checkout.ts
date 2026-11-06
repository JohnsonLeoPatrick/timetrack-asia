import { z } from 'zod';

export const SHIRT_SIZES = ['XS', 'S', 'M', 'L', 'XL', '2XL', '3XL', 'XXS', 'XXL'] as const;
export const DEFAULT_SHIRT_SIZES = ['XS', 'S', 'M', 'L', 'XL', '2XL', '3XL'];
export const reusableFields = ['full_name', 'bib_name', 'email', 'phone', 'gender', 'ic_passport', 'dob', 'address', 'postcode', 'country', 'emergency_name', 'emergency_phone', 'emergency_relationship'] as const;
export const billingFields = ['first_name', 'phone', 'email', 'country', 'city', 'postcode'] as const;
export const shirtSchema = z.array(z.enum(SHIRT_SIZES)).max(9).refine(values => new Set(values).size === values.length, 'Remove duplicate sizes');
export const billingSchema = z.object({
  first_name: z.string().trim().min(1).max(100), phone: z.string().trim().min(8).max(50),
  email: z.email().max(255), country: z.string().trim().min(1).max(100),
  city: z.string().trim().min(1).max(100), postcode: z.string().trim().min(1).max(20),
  terms_accepted: z.literal(true, { error: 'Please agree to the Event Terms & Conditions, Privacy Policy and Participant Declaration.' }),
  policy_accepted: z.literal(true), terms_version: z.string().min(1).max(100),
  checkout_key: z.uuid(), save_billing: z.boolean().default(false), save_runner: z.boolean().default(false),
});
export const participantSchema = z.object({
  category_id: z.string().min(1), participant_type: z.enum(['myself', 'other']),
  full_name: z.string().trim().min(1).max(255), bib_name: z.string().trim().min(1).max(100),
  email: z.email().max(255), phone: z.string().trim().min(8).max(50), gender: z.enum(['MALE', 'FEMALE']),
  ic_passport: z.string().trim().min(4).max(100), dob: z.iso.date(), age: z.number().int().min(0).max(120),
  address: z.string().max(1000).optional(), postcode: z.string().max(20).optional(),
  country: z.string().trim().min(1).max(100), category_age: z.string().trim().min(1).max(50),
  tee_size: z.enum(SHIRT_SIZES).or(z.literal('')).optional(),
  finisher_tee_size: z.enum(SHIRT_SIZES).or(z.literal('')).optional(),
  medical_status: z.boolean(), medical_details: z.string().trim().max(2000).optional(),
  medical_acknowledged: z.literal(true),
  emergency_name: z.string().trim().min(1).max(255), emergency_phone: z.string().trim().min(8).max(50),
  emergency_relationship: z.string().trim().min(1).max(100),
}).superRefine((person, context) => {
  const birth = new Date(`${person.dob}T00:00:00Z`);
  if (Number.isNaN(birth.getTime()) || birth.toISOString().slice(0, 10) !== person.dob || birth > new Date())
    context.addIssue({ code: 'custom', path: ['dob'], message: 'Enter a valid past date of birth' });
  if (person.medical_status && !person.medical_details?.trim())
    context.addIssue({ code: 'custom', path: ['medical_details'], message: 'Describe the medical condition' });
});

export function reusableRunner(person: Record<string, unknown>) {
  return Object.fromEntries(reusableFields.map(field => [field, String(person[field] ?? '')]));
}

export function ageFromDOB(dob: string) {
  const birth = new Date(`${dob}T00:00:00Z`); const today = new Date();
  return today.getUTCFullYear() - birth.getUTCFullYear() -
    (today.getUTCMonth() < birth.getUTCMonth() || (today.getUTCMonth() === birth.getUTCMonth() && today.getUTCDate() < birth.getUTCDate()) ? 1 : 0);
}

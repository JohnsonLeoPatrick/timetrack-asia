export type Role = 'SUPER_ADMIN' | 'ADMIN' | 'ORGANIZER' | 'STAFF' | 'DEVELOPER' | 'ATHLETE';

export const ROLE_HIERARCHY: Record<Role, number> = {
  SUPER_ADMIN: 0,
  ADMIN: 1,
  ORGANIZER: 2,
  STAFF: 3,
  DEVELOPER: 4,
  ATHLETE: 5,
};

export type EventStatus = 'DRAFT' | 'PENDING' | 'APPROVED' | 'REJECTED' | 'LIVE' | 'ONGOING' | 'ENDED' | 'COMPLETED' | 'CANCELED' | 'ARCHIVED';
export type RegistrationStatus = 'PENDING' | 'PAID' | 'CONFIRMED' | 'CANCELLED' | 'REFUNDED' | 'REFUND_REQUESTED' | 'REFUND_REJECTED';
export type PaymentStatus = 'PENDING' | 'SUCCESS' | 'FAILED' | 'REFUNDED' | 'PENDING_REVIEW';
export type ResultStatus = 'FINISHED' | 'DNF' | 'DNS' | 'DQ';
export type CouponType = 'FIXED' | 'PERCENTAGE' | 'EARLY_BIRD';
export type Gender = 'MALE' | 'FEMALE';
export type NotificationChannel = 'EMAIL' | 'WHATSAPP' | 'SMS' | 'IN_APP';

export interface AuthUser {
  username?: string;
  id: string;
  email: string;
  role: Role;
  firstName?: string;
  lastName?: string;
  phone?: string;
  status: 'ACTIVE' | 'SUSPENDED' | 'BANNED';
  avatarUrl?: string;
}

export interface User {
  id: string;
  role: Role;
  first_name: string | null;
  last_name: string | null;
  email: string;
  phone: string | null;
  status: string;
  avatar_url: string | null;
  created_at: string;
  updated_at: string;
  deleted_at: string | null;
}

export interface Event {
  id: string;
  organizer_id: string;
  status: EventStatus;
  title: string;
  slug: string;
  description: string | null;
  event_date: string;
  registration_open: string;
  registration_close: string;
  venue_name: string | null;
  address: string | null;
  city: string | null;
  postcode: string | null;
  country: string | null;
  cover_image: string | null;
  banner_image: string | null;
  max_participants: number | null;
  bib_format: string | null;
  terms_and_conditions: string | null;
  results_finalized: boolean;
  form_template_id: string | null;
  coupons_allowed: boolean | null;
  created_at: string;
  updated_at: string;
  deleted_at: string | null;
  event_categories?: EventCategory[];
}

export interface EventCategory {
  id: string;
  event_id: string;
  name: string;
  description: string | null;
  base_price: number;
  max_slots: number | null;
  min_age: number | null;
  max_age: number | null;
  created_at: string;
  updated_at: string;
  deleted_at: string | null;
}

export interface Registration {
  id: string;
  event_id: string;
  athlete_id: string;
  registration_number: string;
  persons_count: number;
  status: RegistrationStatus;
  total_amount: number;
  discount_amount: number;
  net_amount: number;
  coupon_id: string | null;
  form_data: Record<string, unknown> | null;
  expires_at: string | null;
  created_at: string;
  updated_at: string;
  deleted_at: string | null;
  billing_details?: BillingDetails;
  participants?: Participant[];
}

export interface BillingDetails {
  id: string;
  registration_id: string;
  first_name: string;
  phone: string;
  email: string;
  country: string | null;
  city: string | null;
  postcode: string | null;
  created_at: string;
  updated_at: string;
  deleted_at: string | null;
}

export interface Participant {
  id: string;
  registration_id: string;
  category_id: string;
  full_name: string;
  bib_name: string | null;
  email: string | null;
  phone: string | null;
  gender: Gender | null;
  ic_passport: string | null;
  dob: string | null;
  age: number | null;
  address: string | null;
  postcode: string | null;
  country: string | null;
  category_age: string | null;
  bib_number: string | null;
  qr_token: string | null;
  medical_status: boolean | null;
  medical_details: string | null;
  emergency_name: string | null;
  emergency_phone: string | null;
  check_in_time: string | null;
  checked_in_by: string | null;
  created_at: string;
  updated_at: string;
  deleted_at: string | null;
}

export interface Payment {
  id: string;
  registration_id: string;
  payment_gateway: string;
  gateway_reference: string | null;
  amount: number;
  currency: string;
  status: PaymentStatus;
  receipt_url: string | null;
  metadata: Record<string, unknown> | null;
  created_at: string;
  updated_at: string;
  deleted_at: string | null;
}

export interface Invoice {
  id: string;
  registration_id: string;
  invoice_number: string;
  total_amount: number;
  pdf_url: string | null;
  created_at: string;
  updated_at: string;
  deleted_at: string | null;
}

export interface Result {
  id: string;
  event_id: string;
  participant_id: string;
  bib_number: string;
  status: ResultStatus;
  finish_time: string | null;
  gun_time: string | null;
  chip_time: string | null;
  splits: Record<string, string> | null;
  overall_rank: number | null;
  gender_rank: number | null;
  category_rank: number | null;
  age_group_rank: number | null;
  certificate_url: string | null;
  created_at: string;
  updated_at: string;
  deleted_at: string | null;
}

export interface Coupon {
  id: string;
  code: string;
  type: CouponType;
  value: number;
  max_uses: number | null;
  current_uses: number;
  max_uses_per_user: number;
  min_order_amount: number;
  is_active: boolean;
  starts_at: string | null;
  expires_at: string | null;
  organizer_id: string | null;
  event_id: string | null;
  created_at: string;
  updated_at: string;
  deleted_at: string | null;
}

export interface CouponRedemption {
  id: string;
  coupon_id: string;
  registration_id: string;
  user_id: string;
  discount_amount: number;
  created_at: string;
}

export interface FormTemplate {
  id: string;
  name: string;
  description: string | null;
  organizer_id: string | null;
  is_system: boolean;
  fields: FormField[];
  created_at: string;
  updated_at: string;
  deleted_at: string | null;
}

export interface FormField {
  id: string;
  type: 'TEXT' | 'NUMBER' | 'EMAIL' | 'PHONE' | 'DROPDOWN' | 'CHECKBOX' | 'RADIO' | 'DATE';
  label: string;
  required: boolean;
  placeholder?: string;
  options?: { label: string; value: string }[];
  validation?: {
    min?: number;
    max?: number;
    pattern?: string;
  };
}

export interface EmailQueue {
  id: string;
  to_address: string;
  subject: string;
  html_body: string;
  attachments: Record<string, unknown>[];
  status: 'QUEUED' | 'SENDING' | 'SENT' | 'FAILED';
  retry_count: number;
  max_retries: number;
  error_message: string | null;
  scheduled_at: string | null;
  sent_at: string | null;
  created_at: string;
}

export interface AuditLog {
  id: string;
  user_id: string | null;
  action: string;
  module: string;
  metadata: Record<string, unknown> | null;
  created_at: string;
}

export interface NotificationTemplate {
  id: string;
  type: string;
  subject: string | null;
  content_html: string;
  content_text: string | null;
  created_at: string;
  updated_at: string;
}

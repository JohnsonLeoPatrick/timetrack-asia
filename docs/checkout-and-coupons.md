# Checkout and coupon rollout

## What changed

- New events use the seeded Standard Registration template. Existing events keep their current rules until an organizer enables complete attendee details.
- Each ticket collects identity, contact, date of birth, age group, tee size, medical status, and emergency contact details. Billing address and two agreements are required in the new checkout.
- Tee size and age group are stored on the participant row. Consent flags and attendee count are stored on the registration. No duplicate IC number is stored in the registration audit data.
- Bib number stays nullable. Checkout never generates or assigns a bib.
- Coupons are event scoped. Organizers set total uses, uses per customer, minimum spend, and expiry. New codes require coupons enabled for the event.
- Payment method selection occurs on CHIP's secure hosted checkout. The in-app review shows possible method groups; exact methods depend on the merchant account.
- The dashboard mobile navigation is mounted only when open and hidden at desktop width.

## Deploy order

1. Apply `supabase/migrations/20261103120000_complete_attendee_checkout.sql` to the intended database.
2. Deploy the application build.
3. For existing events that need the detailed form, open the organizer event overview and select **Require complete attendee details**.
4. Enable coupons on each event before creating event coupons.

The migration adds one nullable participant column, seeds a system form if absent, and replaces the priced registration function. It does not rewrite existing participant rows or bib numbers.

## Verification

- `node --test tests/*.test.cjs`: 55 tests passed.
- `npx tsc --noEmit`: passed.
- `npm run lint`: passed with existing nonblocking warnings.
- `npm run build`: passed.
- Mobile browser check at 390 px: attendee form, billing, review, consent gate, and no horizontal overflow.

## Limits

- Existing events with no form template still accept their earlier registration payload at the database boundary. The current web checkout asks for complete details on every event.
- Age group choices are generic. Event specific age group definitions and tee inventory are not configured yet.
- Actual available banks and wallets are controlled by CHIP and the merchant account.
- The new migration has not been applied to the connected production database in this work session.

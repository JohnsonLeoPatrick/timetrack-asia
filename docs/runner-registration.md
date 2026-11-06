# Runner registration improvements

## Behavior

The existing event selection, category pricing, responsive checkout components, shared billing, capacity checks, coupons, and CHIP payment flow are retained. Category selection now asks whether the ticket is for **Myself** or **Other Participants**. The existing three checkout screens group the requested logical stages: category/type/participant details, one billing form, then review/declarations/payment.

Myself fills reusable personal and emergency contact information. Saved billing fills once for the entire order. Other participants start with blank personal and emergency information. Each attendee has an independent form and stable browser identifier. Medical declarations, shirt choices, category selections, and consent are never reused from a profile. A checkout can contain one Myself ticket and up to 100 attendees in total.

Saving personal and billing details requires separate explicit checkboxes. Saving occurs with the validated registration transaction. Editing without selecting save changes only the current registration. The profile uses the account ID as its primary key, preventing duplicate profiles. Profile settings can remove saved reusable details and drafts.

Each category has independent event-shirt and finisher-shirt size arrays. An empty array excludes that shirt and hides its input. Both the UI and database reject unavailable sizes. Existing categories retain event shirts by default; finisher shirts start excluded. Organizers configure each category in the event overview. Stored sizes appear in review, staff participant management, and the private entry page.

Emergency name, phone, relationship, a Yes/No medical declaration, and explicit acknowledgement are mandatory. Yes requires condition details; No clears stale details. The registering account can correct safety details on the private entry page until registration closes. Staff can reveal safety information on demand after server-side event authorization. Public results cannot disclose medical or identity/contact information.

The mandatory agreement starts unchecked and links to uncached event terms, the participant declaration, and privacy policy. The database records server time, event terms version/text, and privacy/declaration versions. Changing event terms automatically changes their version. Stale acceptance is rejected. Browser refresh resets agreements and medical acknowledgement.

Private database drafts retain in-progress attendee/billing details for up to 24 hours of recovery. Medical details enter a draft only after acknowledgement. The browser stores only an opaque checkout key in session storage. Retrying the same key returns the existing registration, including after an ambiguous response or failed payment. No second registration, attendee set, or coupon redemption is created. After payment initiation fails, the existing profile payment controls resume the pending registration.

Paid entries continue to require verified CHIP settlement. Existing pending registrations reserve places before payment; failed payment does not become a confirmed entry. Free entries confirm immediately. The existing private entry and payment-return pages provide confirmation.

## Database rollout

Apply `supabase/migrations/20261104150212_runner_checkout_profiles.sql` **before deploying this application version**. The migration has been exercised against PGlite using the complete migration chain. It has not been applied to a hosted database in this session.

The migration adds:

- `runner_profiles`: account-owned reusable personal/emergency and billing JSON, protected by RLS.
- `runner_checkout_drafts`: account/event-owned recovery data, protected by RLS.
- Category shirt size arrays, event terms versions, participant finisher size/relationship/acknowledgement/type, and registration checkout keys.
- A unique checkout-key index, immutable consent/key protection, automatic terms versioning, stricter registration validation, atomic optional profile saving, and an owner-authorized safety update RPC.

Existing participant and billing records are not rewritten. Every new checkout now requires complete attendee declarations, even for events without a form template. Older external callers must provide the new payload. No package dependencies were added.

Expired drafts are excluded from recovery and removed when their owner next opens checkout. Successful registration and the profile removal control also delete drafts. For physical expiry independent of returning users, schedule this statement through the deployment's privileged database maintenance job:

```sql
DELETE FROM public.runner_checkout_drafts WHERE expires_at <= now();
```

Set the production retention schedule for completed event data according to the operator's obligations. The application records explicit medical consent and restricts access; this change does not certify the operator's entire PDPA compliance program. Implementation references: [Supabase RLS documentation](https://supabase.com/docs/guides/database/postgres/row-level-security), [Malaysian Personal Data Protection Department FAQ](https://www.pdp.gov.my/en/faq/).

## Changed files

- Checkout and terms: `src/app/(main)/events/[id]/register/page.tsx`, `src/app/(main)/events/[id]/terms/page.tsx`, `src/lib/runner-checkout.ts`, `src/lib/server/actions/registration.actions.ts`, `src/lib/server/actions/runner-profile.actions.ts`.
- Account and confirmation: `src/app/(main)/profile/page.tsx`, `src/app/(main)/profile/registrations/[id]/page.tsx`, `src/components/events/runner-profile-settings.tsx`, `src/components/events/participant-safety.tsx`, `src/lib/server/tickets.ts`, `src/app/(main)/privacy-policy/page.tsx`.
- Staff: `src/app/organizer/dashboard/events/[id]/page.tsx`, `src/components/events/category-shirts.tsx`, `src/components/events/participant-management.tsx`, `src/components/events/participant-medical-review.tsx`, `src/lib/server/actions/event.actions.ts`, `src/lib/server/actions/participant.actions.ts`, `src/lib/server/participants.ts`, `src/lib/participants.ts`.
- Schema/types and local development: the migration above, `src/lib/supabase/database.types.ts`, `src/lib/types.ts`, `src/lib/supabase/local-db.ts`.
- Tests: `tests/billing-integrity.test.cjs`, `tests/participants.test.cjs`, `tests/local-db.test.cjs`, `tests/checkout-fixtures.cjs`, `tests/runner-checkout.test.cjs`.

## Verification

`node --test tests/*.test.cjs`: 67 tests passed. Database and server-action checks cover:

1. First registration with complete declarations.
2. Explicit reusable profile/billing save, followed by editing with and without save.
3. Another participant's details staying separate from the account profile.
4. Multiple attendees sharing one billing record and the server-calculated total.
5. Different event and finisher shirt sizes per attendee, unavailable sizes, and categories without shirts.
6. Rejection and transaction rollback for missing emergency details.
7. Medical Yes/No, required condition text, acknowledgement, and removal of stale conditions.
8. Missing agreement, stale terms, server acceptance timestamp, version, and text snapshots.
9. Draft consent stripping, acknowledged medical recovery data, account isolation, immutable keys, and exact-participant safety updates.
10. Duplicate-submit/payment-failure retries, signed provider callbacks, verified settlement, free confirmation, private entry lookup, and invoice/ticket validation.

`npx tsc --noEmit`, `npm run build`, and `git diff --check` passed. `npm run lint` completed with no errors and 47 existing warnings.

These are automated database/server tests, not a complete browser journey or a real bank/card transaction. Native Chrome detected active user input and the browser automation host was unavailable, so desktop/tablet/mobile visual checks remain unverified. The existing responsive styles are reused. Hosted migration, real CHIP sandbox checkout, and device checks remain deployment acceptance steps.

# Participant management and bib assignment

Application changes are ready for review. The bib migration has been applied to the intended TimeTrack database after authorization. Vercel deployment has not been performed.

## Feature checklist

- [x] Search participants by name, IC/passport, order number, and bib number within the open event.
- [x] Show every participant separately, including members of group registrations.
- [x] Assign, edit, and clear bib numbers using the existing dialog components.
- [x] Save and Cancel controls, pending states, inline errors, and success/error notifications.
- [x] Reuse nullable `participants.bib_number`; display `Not assigned` for missing bibs.
- [x] Persist assignments through an authenticated database transaction.
- [x] Validate input in the server action and database: 1–100 ASCII letters, digits, or hyphens; blank clears the assignment.
- [x] Reject case-insensitive duplicate bibs within an event, across all categories and registrations. Leading zeroes are significant.
- [x] Allow the same bib in different events.
- [x] Serialize event assignments and reject stale edits using `expected_bib_number`.
- [x] Check participant, registration, category, and event associations before saving.
- [x] Keep registration independent of bib assignment. No automatic participant bib generation existed in the inspected registration or creation paths.
- [x] Add an explicit optional generator that fills only unassigned participants and skips reserved numbers.
- [x] Preserve existing assignments during generation and ordinary participant updates.
- [x] Export an event participant CSV with stable participant/event IDs, order number, name, IC last four, and current/expected bib values.
- [x] Import bib assignments for existing participants, preserving leading zeroes and handling quoted CSV fields.
- [x] Validate the entire import and commit all changes together, including valid bib swaps. Reject duplicate rows, conflicting bibs, wrong-event IDs, and stale values.
- [x] Provide assigned/missing bib filters and counts.
- [x] Print one or multiple selected participants using freshly loaded database values and the existing print button/card styling.
- [x] Block printing missing bibs and legacy duplicate assignments; never substitute or generate numbers during printing.
- [x] Restrict read, export, import, generation, and printing to active organizers owning the event, or active administrators.
- [x] Keep direct authenticated participant writes blocked by the existing billing protections.
- [x] Mask IC values in the table; omit full IC values from CSV and print output. Full IC search data is available only to authorized event staff.
- [x] Scope existing result-import bib matching to the selected event, preventing cross-event matches now that bibs can repeat across events.
- [x] Preserve existing participant records, bib values, and registration workflows through migration.
- [x] Signed-in browser acceptance using the local application against the intended TimeTrack database, with isolated QA identities and private events.
- [x] Single and bulk A4 PDF generation; saved bib values, missing-bib blocking, layout, page count, and absence of IC values verified.
- [x] Remote migration applied; all 15 original participant records and assignments preserved exactly.
- [ ] Optional physical-printer calibration with the event's actual printer and paper stock; no physical print job was submitted.
- [ ] Application deployment to Vercel; not performed.

## Workflow

1. Open an event and choose **registrations**.
2. Search by name, IC/passport, order number, or bib; optionally filter assigned or missing bibs.
3. Assign a participant's bib individually, or export the complete event CSV.
4. Consolidate the exported participants with external portal records outside TimeTrack.
5. Edit only `bib_number` in the CSV. Keep `event_id`, `participant_id`, and `expected_bib_number` unchanged. Use text columns in spreadsheet software so leading zeroes survive.
6. Import the edited CSV. A blank `bib_number` clears the previous assignment. Any invalid row rolls back the entire file.
7. Refresh and verify assignments. Optional generation is a separate, explicit action for unassigned participants only.
8. Select participants with assigned bibs and choose **Print selected**. The printing page loads current database values again.

## Files changed for this work

| File | Purpose |
| --- | --- |
| `src/lib/participants.ts` | Bib validation, participant types, search/filtering, IC masking, print validation |
| `src/lib/participant-csv.ts` | CSV export and strict bib-assignment CSV parsing |
| `src/lib/server/participants.ts` | Staff/event authorization and paginated event participant retrieval |
| `src/lib/server/actions/participant.actions.ts` | Read, assignment, generation, export, and import actions; production-safe validation feedback |
| `src/components/events/participant-management.tsx` | Participant table, dialogs, search, filters, CSV controls, and print selection |
| `src/app/organizer/dashboard/events/[id]/page.tsx` | Mount participant management in the existing registrations tab |
| `src/app/organizer/dashboard/events/[id]/bibs/print/page.tsx` | Authorized printing from saved assignments |
| `src/lib/server/actions/result.actions.ts` | Isolate participant matching by event and reject ambiguous bibs |
| `supabase/migrations/20261101124338_manual_bib_assignment.sql` | Checked assignment/generation RPCs, event locks, duplicate validation, and event-move protection |
| `tests/participants.test.cjs` | Database, action, CSV, privacy, search, and rendered printing tests |
| `docs/participant-bibs.md` | Checklist, review findings, limitations, and rollout instructions |

Other modified/untracked files existed before this work. The authorized follow-up lint cleanup also changed existing application files as described below.

## Verification

- [x] `node --test --test-concurrency=1 tests/*.test.cjs`: 51 tests passed, including 16 participant/bib tests, two local-adapter regression tests, and all 33 existing tests.
- [x] Database tests apply the actual migrations to isolated PostgreSQL through PGlite. They exercise null registration bibs, existing-record preservation, assignment/edit/clear, duplicate rejection, permissions, stale edits, atomic swaps/rollback, generation, and result protection.
- [x] CSV action tests pass edited exports through the server action and database RPC and verify persisted values.
- [x] Print tests render one/multiple participants, compare exact stored bib values, reject missing or wrong-event selections, and verify that IC data is absent.
- [x] Type checking: `node node_modules/typescript/bin/tsc --noEmit`.
- [x] Production build: `npm run build`.
- [x] ESLint passes for all six new TypeScript/TSX files and the new test file.
- [x] `npm run lint` passes with zero errors. Existing nonblocking warnings remain. Archived applications, vendored skills, cache files, and scratch migration utilities are excluded from application linting; active source, tests, and project scripts remain checked.
- [x] Concurrent requests against the intended PostgreSQL database verified duplicate rejection, stale-edit protection, and event isolation.
- [x] Signed-in Playwright tests verified name/IC/order search, assign/edit/clear, persistence after reload, duplicate feedback, optional generation, CSV export/import, assigned/missing filters, and one/multiple PDF printing.
- [x] Browser role checks verified owning organizer access, denial for a different organizer and athlete, and administrator access.

## Follow-up lint cleanup

- `eslint.config.mjs` now scopes linting to active project code. CommonJS test/script imports and conditional Node imports in the development adapter have targeted import-rule settings; application type rules remain enabled.
- Existing event, registration, results, authentication, profile, payment, policy, and dashboard pages now use explicit domain types or inferred callback types and narrowed errors. JSX quotes are escaped.
- `src/hooks/use-auth.ts`, `use-results.ts`, `use-registrations.ts`, and `use-analytics.ts` use typed callbacks and appropriate mutable/constant bindings.
- `src/lib/server/actions/analytics.actions.ts`, `event.actions.ts`, `registration.actions.ts`, and `result.actions.ts` use typed values and inferred query results.
- `src/lib/server/export/csv.ts` and `excel.ts` use structural export types.
- `src/lib/supabase/local-db.ts` now has typed JSON rows, sessions, query results, and a Supabase client boundary. `tests/local-db.test.cjs` covers authentication, filtering, pricing, registration without a bib, and coupon increments.
- Profile input initialization derives from loaded data; payment polling uses state instead of reading a ref during render. Auth/recovery error updates avoid synchronous effect cascades.

## Rules and limitations

- The existing schema defines no staff-membership table. Authorization uses its existing `ORGANIZER`, `ADMIN`, and `SUPER_ADMIN` roles; administrators retain their existing global access.
- The migration changes no existing participant or bib data. Legacy duplicates remain visible and block printing until staff resolve them. New conflicting assignments are rejected.
- Reserved bibs on deleted or cancelled records are not silently reused.
- Bib changes are blocked after a participant has recorded results, preventing a mismatch with historical results.
- CSV import updates bibs on existing event participants; it does not create registrations or participants from external portals.
- CSV files are limited to 2 MB and 10,000 participant rows. One assignment/generation transaction supports at most 10,000 participants.
- Printing supports up to 200 participants per batch.
- Participant loading uses the real Supabase schema/RPCs. The development JSON mock is not a production database and does not implement these new RPCs.
- The Supabase plugin exposes a different project, so the authorized migration and live acceptance used the intended TimeTrack project's existing management/API credentials. Its 15 original participant records were verified by count and full-row hashes before and after migration/testing.
- Vercel access was verified and the `time-track` Next.js project was identified. No Vercel project settings or deployments were changed.

## Deployment instructions

1. Review this change alongside the pre-existing worktree changes. Confirm that migrations `001` through `014` are present on the intended TimeTrack database.
2. Back up the intended database and inspect existing duplicate bibs by event. Do not delete or renumber them automatically:

   ```sql
   SELECT r.event_id, upper(btrim(p.bib_number)) AS normalized_bib, count(*)
   FROM participants p
   JOIN registrations r ON r.id = p.registration_id
   WHERE nullif(btrim(p.bib_number), '') IS NOT NULL
   GROUP BY r.event_id, upper(btrim(p.bib_number))
   HAVING count(*) > 1;
   ```

3. `20261101124338_manual_bib_assignment.sql` is already applied to the intended TimeTrack database. Do not reapply it, reapply older migrations, or reset participant data. A backup of original participant IDs/bib values and verification evidence is stored in the ignored `.cache` directory.
4. After separate deployment authorization, deploy the reviewed application to the intended Vercel `time-track` project. This feature needs no new environment variables.
5. Local browser acceptance against the real database is complete. After application deployment, perform a short deployed-site smoke test. If physical bib stock is used, verify printer margins against that stock before a production print run.

Recommended commit message: `feat: add event-scoped participant bib assignment and printing`

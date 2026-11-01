-- Time Track v2: RLS fixes
-- 1. The public results page reads nested participant names (full_name, gender)
--    for finalized events, but participants had no policy for anonymous users,
--    so the leaderboard showed "Unknown". Mirror the "Anyone can read finalized
--    results" policy on participants.
-- 2. "Organizers can delete own events" (002) was actually FOR UPDATE, a typo
--    that duplicated the update policy. The app soft-deletes via UPDATE, so this
--    only matters for real DELETEs, which used to be impossible.

-- Fix 1: participants of finalized events are publicly readable
CREATE POLICY "Anyone can read participants of finalized events" ON participants
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM registrations r
      JOIN events e ON r.event_id = e.id
      WHERE r.id = participants.registration_id AND e.results_finalized = TRUE
    )
  );

-- Fix 2: correct the events delete policy (was FOR UPDATE by mistake)
DROP POLICY IF EXISTS "Organizers can delete own events" ON events;
CREATE POLICY "Organizers can delete own events" ON events
  FOR DELETE USING (organizer_id = auth.uid() OR public.current_user_role() IN ('SUPER_ADMIN', 'ADMIN'));
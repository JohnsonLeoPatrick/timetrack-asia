BEGIN;

-- Keep nullable participants.bib_number and every existing assignment intact.
-- Event-row locking serializes assignments across categories and registrations.
CREATE FUNCTION public.check_participant_bib()
RETURNS trigger LANGUAGE plpgsql SET search_path = public, pg_temp AS $$
DECLARE v_event_id uuid;
BEGIN
  IF current_user IN ('anon', 'authenticated') THEN RAISE EXCEPTION 'Billing records are managed by the server'; END IF;
  IF TG_OP = 'UPDATE' AND NEW.bib_number IS NOT DISTINCT FROM OLD.bib_number
    AND NEW.registration_id = OLD.registration_id AND NEW.category_id = OLD.category_id THEN
    RETURN NEW;
  END IF;
  NEW.bib_number := nullif(btrim(NEW.bib_number), '');
  IF NEW.bib_number IS NULL THEN RETURN NEW; END IF;
  IF length(NEW.bib_number) > 100 OR NEW.bib_number !~ '^[A-Za-z0-9][A-Za-z0-9-]*$' THEN
    RAISE EXCEPTION 'Use 1-100 letters, numbers, or hyphens for a bib number';
  END IF;
  SELECT r.event_id INTO v_event_id FROM public.registrations r
    JOIN public.event_categories c ON c.id = NEW.category_id AND c.event_id = r.event_id
    WHERE r.id = NEW.registration_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'Participant category does not belong to this event'; END IF;
  PERFORM 1 FROM public.events e WHERE e.id = v_event_id FOR UPDATE;
  -- Reserve numbers even on deleted/cancelled entries; never silently recycle a bib.
  IF EXISTS (SELECT 1 FROM public.participants p JOIN public.registrations r ON r.id = p.registration_id
    WHERE r.event_id = v_event_id AND p.id <> NEW.id
      AND upper(btrim(p.bib_number)) = upper(NEW.bib_number)) THEN
    RAISE EXCEPTION 'Bib number is already assigned in this event' USING ERRCODE = '23505';
  END IF;
  RETURN NEW;
END;
$$;
CREATE TRIGGER check_participant_bib BEFORE INSERT OR UPDATE OF bib_number, registration_id, category_id
ON public.participants FOR EACH ROW EXECUTE FUNCTION public.check_participant_bib();
CREATE INDEX idx_participants_bib_normalized ON public.participants (upper(btrim(bib_number))) WHERE bib_number IS NOT NULL;

-- Existing billing protections still deny direct participant writes. This narrowly
-- scoped RPC is the only authenticated path for staff to change bib assignments.
CREATE FUNCTION public.assign_participant_bibs(p_event_id uuid, p_assignments jsonb)
RETURNS integer LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
DECLARE organizer uuid; caller_role text; entry jsonb; person public.participants%ROWTYPE;
  desired text; changed integer := 0;
BEGIN
  SELECT role INTO caller_role FROM public.users WHERE id = auth.uid() AND status = 'ACTIVE' AND deleted_at IS NULL;
  IF auth.uid() IS NULL OR caller_role IS NULL OR caller_role NOT IN ('ORGANIZER', 'ADMIN', 'SUPER_ADMIN') THEN
    RAISE EXCEPTION 'Forbidden';
  END IF;
  SELECT organizer_id INTO organizer FROM public.events WHERE id = p_event_id AND deleted_at IS NULL FOR UPDATE;
  IF NOT FOUND OR (caller_role = 'ORGANIZER' AND organizer <> auth.uid()) THEN
    RAISE EXCEPTION 'Event not found or access denied';
  END IF;
  IF p_assignments IS NULL OR jsonb_typeof(p_assignments) <> 'array' THEN RAISE EXCEPTION 'Invalid assignments'; END IF;
  IF jsonb_array_length(p_assignments) NOT BETWEEN 1 AND 10000 THEN RAISE EXCEPTION 'Provide 1-10000 assignments'; END IF;
  IF (SELECT count(DISTINCT x->>'participant_id') FROM jsonb_array_elements(p_assignments) x) <> jsonb_array_length(p_assignments) THEN
    RAISE EXCEPTION 'A participant may appear only once';
  END IF;
  FOR entry IN SELECT value FROM jsonb_array_elements(p_assignments) ORDER BY value->>'participant_id' LOOP
    IF NOT (entry ? 'bib_number' AND entry ? 'expected_bib_number')
      OR jsonb_typeof(entry->'bib_number') NOT IN ('string', 'null')
      OR jsonb_typeof(entry->'expected_bib_number') NOT IN ('string', 'null') THEN
      RAISE EXCEPTION 'Invalid assignment values';
    END IF;
    desired := nullif(btrim(entry->>'bib_number'), '');
    IF desired IS NOT NULL AND (length(desired) > 100 OR desired !~ '^[A-Za-z0-9][A-Za-z0-9-]*$') THEN
      RAISE EXCEPTION 'Use 1-100 letters, numbers, or hyphens for a bib number';
    END IF;
    SELECT p.* INTO person FROM public.participants p
      JOIN public.registrations r ON r.id = p.registration_id
      JOIN public.event_categories c ON c.id = p.category_id AND c.event_id = r.event_id
      WHERE p.id = (entry->>'participant_id')::uuid AND r.event_id = p_event_id
        AND p.deleted_at IS NULL AND r.deleted_at IS NULL FOR UPDATE OF p;
    IF NOT FOUND THEN RAISE EXCEPTION 'Participant not found in this event'; END IF;
    IF person.bib_number IS DISTINCT FROM (entry->>'expected_bib_number') THEN
      RAISE EXCEPTION 'Bib number changed. Refresh participants and try again';
    END IF;
    IF person.bib_number IS DISTINCT FROM desired AND EXISTS (
      SELECT 1 FROM public.results WHERE participant_id = person.id AND deleted_at IS NULL) THEN
      RAISE EXCEPTION 'Bib number cannot change after results have been recorded';
    END IF;
    IF person.bib_number IS DISTINCT FROM desired THEN changed := changed + 1; END IF;
  END LOOP;
  -- Release only changed assignments inside this transaction, allowing atomic swaps.
  UPDATE public.participants p SET bib_number = NULL FROM jsonb_array_elements(p_assignments) x
    WHERE p.id = (x->>'participant_id')::uuid AND p.bib_number IS DISTINCT FROM nullif(btrim(x->>'bib_number'), '');
  UPDATE public.participants p SET bib_number = nullif(btrim(x->>'bib_number'), '') FROM jsonb_array_elements(p_assignments) x
    WHERE p.id = (x->>'participant_id')::uuid AND p.bib_number IS DISTINCT FROM nullif(btrim(x->>'bib_number'), '');
  RETURN changed;
END;
$$;
REVOKE ALL ON FUNCTION public.assign_participant_bibs(uuid, jsonb) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.assign_participant_bibs(uuid, jsonb) TO authenticated;

CREATE FUNCTION public.generate_unassigned_bibs(p_event_id uuid, p_start integer DEFAULT 1)
RETURNS integer LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
DECLARE organizer uuid; caller_role text; person record; number bigint := p_start; assignments jsonb := '[]';
BEGIN
  SELECT role INTO caller_role FROM public.users WHERE id = auth.uid() AND status = 'ACTIVE' AND deleted_at IS NULL;
  IF auth.uid() IS NULL OR caller_role IS NULL OR caller_role NOT IN ('ORGANIZER', 'ADMIN', 'SUPER_ADMIN') THEN RAISE EXCEPTION 'Forbidden'; END IF;
  SELECT organizer_id INTO organizer FROM public.events WHERE id = p_event_id AND deleted_at IS NULL FOR UPDATE;
  IF NOT FOUND OR (caller_role = 'ORGANIZER' AND organizer <> auth.uid()) THEN RAISE EXCEPTION 'Event not found or access denied'; END IF;
  IF p_start IS NULL OR p_start NOT BETWEEN 1 AND 999999999 THEN RAISE EXCEPTION 'Invalid starting number'; END IF;
  FOR person IN SELECT p.id FROM public.participants p JOIN public.registrations r ON r.id = p.registration_id
    WHERE r.event_id = p_event_id AND r.deleted_at IS NULL AND p.deleted_at IS NULL
      AND p.bib_number IS NULL ORDER BY p.id FOR UPDATE OF p LOOP
    WHILE EXISTS (SELECT 1 FROM public.participants p JOIN public.registrations r ON r.id = p.registration_id
      WHERE r.event_id = p_event_id AND upper(btrim(p.bib_number)) = number::text) LOOP number := number + 1; END LOOP;
    IF number > 999999999 THEN RAISE EXCEPTION 'Number range exhausted'; END IF;
    assignments := assignments || jsonb_build_array(jsonb_build_object('participant_id', person.id, 'bib_number', number::text, 'expected_bib_number', NULL));
    number := number + 1;
  END LOOP;
  IF jsonb_array_length(assignments) = 0 THEN RETURN 0; END IF;
  RETURN public.assign_participant_bibs(p_event_id, assignments);
END;
$$;
REVOKE ALL ON FUNCTION public.generate_unassigned_bibs(uuid, integer) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.generate_unassigned_bibs(uuid, integer) TO authenticated;

-- Reparenting an order with assigned bibs would bypass event-scoped reservations.
CREATE FUNCTION public.protect_bib_event()
RETURNS trigger LANGUAGE plpgsql SET search_path = public, pg_temp AS $$
BEGIN
  IF NEW.event_id IS DISTINCT FROM OLD.event_id AND EXISTS (
    SELECT 1 FROM public.participants WHERE registration_id = OLD.id AND bib_number IS NOT NULL
  ) THEN RAISE EXCEPTION 'Clear assigned bib numbers before moving a registration to another event'; END IF;
  RETURN NEW;
END;
$$;
CREATE TRIGGER protect_bib_event BEFORE UPDATE OF event_id ON public.registrations
FOR EACH ROW EXECUTE FUNCTION public.protect_bib_event();
REVOKE ALL ON FUNCTION public.check_participant_bib(), public.protect_bib_event() FROM PUBLIC, anon, authenticated;
NOTIFY pgrst, 'reload schema';
COMMIT;

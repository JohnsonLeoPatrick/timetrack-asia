-- Protect server-managed identity fields even when a caller owns the row.
CREATE OR REPLACE FUNCTION public.protect_user_authorization()
RETURNS trigger LANGUAGE plpgsql SET search_path = public, pg_temp AS $$
BEGIN
  IF auth.role() IN ('anon', 'authenticated') AND
     (NEW.role IS DISTINCT FROM OLD.role OR NEW.status IS DISTINCT FROM OLD.status
      OR NEW.deleted_at IS DISTINCT FROM OLD.deleted_at OR NEW.id IS DISTINCT FROM OLD.id) THEN
    RAISE EXCEPTION 'Authorization fields are managed by the server';
  END IF;
  RETURN NEW;
END;
$$;
CREATE TRIGGER protect_user_authorization BEFORE UPDATE ON public.users
FOR EACH ROW EXECUTE FUNCTION public.protect_user_authorization();

CREATE OR REPLACE FUNCTION public.current_user_role()
RETURNS varchar(50) LANGUAGE sql SECURITY DEFINER STABLE
SET search_path = public, pg_temp AS $$
  SELECT COALESCE((SELECT role FROM public.users
    WHERE id = auth.uid() AND status = 'ACTIVE' AND deleted_at IS NULL), 'ATHLETE');
$$;

-- A finalized leaderboard must never expose medical, identity, or contact data.
DROP POLICY IF EXISTS "Anyone can read participants of finalized events" ON public.participants;
CREATE VIEW public.public_results AS
SELECT r.id, r.event_id, r.bib_number, r.status, r.finish_time, r.gun_time,
  r.chip_time, r.overall_rank, r.gender_rank, r.category_rank,
  jsonb_build_object('full_name', p.full_name, 'bib_name', p.bib_name,
    'gender', p.gender, 'event_categories', jsonb_build_object('name', c.name)) AS participants
FROM public.results r
JOIN public.events e ON e.id = r.event_id
JOIN public.participants p ON p.id = r.participant_id
LEFT JOIN public.event_categories c ON c.id = p.category_id
WHERE e.results_finalized = true AND e.deleted_at IS NULL AND r.deleted_at IS NULL;
COMMENT ON VIEW public.public_results IS
  'Intentional public projection of finalized results; omits participant private fields.';
GRANT SELECT ON public.public_results TO anon, authenticated;

-- Gateway configuration can contain credentials; only privileged server code reads it.
DROP POLICY IF EXISTS "Anyone can read enabled gateways" ON public.payment_gateways;

DROP POLICY IF EXISTS "Allow organizers and developers to manage certificates" ON public.certificates;
CREATE POLICY "Owners can manage event certificates" ON public.certificates FOR ALL TO authenticated
USING (EXISTS (SELECT 1 FROM public.events e WHERE e.id = certificates.event_id
  AND (e.organizer_id = auth.uid() OR public.current_user_role() IN ('ADMIN', 'SUPER_ADMIN'))))
WITH CHECK (EXISTS (SELECT 1 FROM public.events e WHERE e.id = certificates.event_id
  AND (e.organizer_id = auth.uid() OR public.current_user_role() IN ('ADMIN', 'SUPER_ADMIN'))));

-- Pin definer resolution; legacy coupon mutation is server-only.
DO $$ DECLARE f record; BEGIN
  FOR f IN SELECT p.oid::regprocedure AS signature, p.proname
    FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public' AND p.prosecdef
  LOOP
    EXECUTE format('ALTER FUNCTION %s SET search_path = public, pg_temp', f.signature);
    EXECUTE format('REVOKE ALL ON FUNCTION %s FROM PUBLIC, anon', f.signature);
    IF f.proname = 'redeem_coupon' THEN
      EXECUTE format('REVOKE ALL ON FUNCTION %s FROM authenticated', f.signature);
      EXECUTE format('GRANT EXECUTE ON FUNCTION %s TO service_role', f.signature);
    ELSE
      EXECUTE format('GRANT EXECUTE ON FUNCTION %s TO authenticated, service_role', f.signature);
    END IF;
  END LOOP;
END $$;
-- Public policies use this helper, whose only output is the caller's own role.
GRANT EXECUTE ON FUNCTION public.current_user_role() TO anon;

CREATE FUNCTION public.claim_organizer_code(p_code_id uuid, p_user_id uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
BEGIN
  IF auth.role() IS DISTINCT FROM 'service_role' THEN RAISE EXCEPTION 'Forbidden'; END IF;
  UPDATE public.organizer_codes SET is_active = false WHERE id = p_code_id AND is_active = true;
  IF NOT FOUND THEN RAISE EXCEPTION 'Organizer code is no longer available'; END IF;
  UPDATE public.users SET role = 'ORGANIZER' WHERE id = p_user_id AND role = 'ATHLETE';
  IF NOT FOUND THEN RAISE EXCEPTION 'Account is not eligible'; END IF;
END;
$$;
REVOKE ALL ON FUNCTION public.claim_organizer_code(uuid, uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.claim_organizer_code(uuid, uuid) TO service_role;

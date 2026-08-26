-- WU-15: server-only RPCs must be able to validate auth.users.
--
-- The Data API invokes these functions as service_role, but Supabase keeps the
-- auth schema tables inaccessible to that role.  The functions already revoke
-- execute from public/anon/authenticated and grant it only to service_role;
-- Owner-executed mode lets the migration owner (postgres) perform the guarded
-- internal reads and writes without exposing auth.users or granting table
-- access to the caller.
--
-- Every function keeps an empty search_path and fully-qualified relations in
-- its body.  This is intentionally a permission-only fix; no data or policy
-- is changed.

alter function public.enforce_reaction_abuse_guard(
  uuid,
  uuid,
  text,
  text,
  timestamptz
) security definer;

alter function public.issue_location_visit_proof(
  uuid,
  uuid,
  text,
  double precision,
  double precision,
  double precision,
  timestamptz
) security definer;

alter function public.save_reaction_selection(
  uuid,
  uuid,
  text
) security definer;

alter function public.save_reaction_with_visit_proof(
  uuid,
  uuid,
  text,
  text,
  timestamptz
) security definer;

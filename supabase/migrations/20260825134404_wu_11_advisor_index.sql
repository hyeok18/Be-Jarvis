-- WU-11 follow-up: cover the restaurant foreign key reported by the
-- Supabase performance advisor without altering the already-applied migration.
create index abuse_guard_observations_restaurant_id_idx
  on private.abuse_guard_observations (restaurant_id);

-- WU-05 checkpoint 1: counted-only summary projection.
-- Functions stay in the unexposed private schema. The trigger makes every raw
-- reaction mutation and its public projection one short atomic transaction.

create or replace function private.refresh_restaurant_reaction_summary(
  p_restaurant_id uuid
)
returns public.restaurant_reaction_summaries
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_summary public.restaurant_reaction_summaries%rowtype;
begin
  if p_restaurant_id is null then
    raise exception using
      errcode = '22004',
      message = 'restaurant_id is required';
  end if;

  -- Serialize projection refreshes per restaurant without locking unrelated
  -- restaurants. Transaction-scoped locks release automatically on rollback.
  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended('reaction-summary:' || p_restaurant_id::text, 0)
  );

  perform 1
  from public.restaurants
  where id = p_restaurant_id
  for key share;

  if not found then
    raise exception using
      errcode = '23503',
      message = 'restaurant does not exist';
  end if;

  insert into public.restaurant_reaction_summaries as current_summary (
    restaurant_id,
    like_count,
    okay_count,
    dislike_count,
    counted_total,
    version,
    updated_at
  )
  select
    p_restaurant_id,
    count(*) filter (where kind = 'like')::integer,
    count(*) filter (where kind = 'okay')::integer,
    count(*) filter (where kind = 'dislike')::integer,
    count(*)::integer,
    1,
    pg_catalog.clock_timestamp()
  from public.restaurant_reactions
  where restaurant_id = p_restaurant_id
    and is_active
    and moderation_status = 'counted'
  on conflict (restaurant_id) do update
  set
    like_count = excluded.like_count,
    okay_count = excluded.okay_count,
    dislike_count = excluded.dislike_count,
    counted_total = excluded.counted_total,
    version = current_summary.version + 1,
    updated_at = excluded.updated_at
  returning * into v_summary;

  return v_summary;
end;
$$;

revoke all on function private.refresh_restaurant_reaction_summary(uuid)
from public, anon, authenticated;
grant execute on function private.refresh_restaurant_reaction_summary(uuid)
to service_role;

create or replace function private.refresh_reaction_summary_from_row()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if tg_op = 'INSERT' then
    perform private.refresh_restaurant_reaction_summary(new.restaurant_id);
    return new;
  end if;

  if tg_op = 'DELETE' then
    perform private.refresh_restaurant_reaction_summary(old.restaurant_id);
    return old;
  end if;

  if old.restaurant_id = new.restaurant_id then
    perform private.refresh_restaurant_reaction_summary(new.restaurant_id);
  elsif old.restaurant_id < new.restaurant_id then
    perform private.refresh_restaurant_reaction_summary(old.restaurant_id);
    perform private.refresh_restaurant_reaction_summary(new.restaurant_id);
  else
    perform private.refresh_restaurant_reaction_summary(new.restaurant_id);
    perform private.refresh_restaurant_reaction_summary(old.restaurant_id);
  end if;

  return new;
end;
$$;

revoke all on function private.refresh_reaction_summary_from_row()
from public, anon, authenticated, service_role;

create trigger restaurant_reactions_refresh_summary_after_insert
after insert on public.restaurant_reactions
for each row execute function private.refresh_reaction_summary_from_row();

create trigger restaurant_reactions_refresh_summary_after_delete
after delete on public.restaurant_reactions
for each row execute function private.refresh_reaction_summary_from_row();

create trigger restaurant_reactions_refresh_summary_after_update
after update of restaurant_id, kind, moderation_status, is_active
on public.restaurant_reactions
for each row
when (
  old.restaurant_id is distinct from new.restaurant_id
  or old.kind is distinct from new.kind
  or old.moderation_status is distinct from new.moderation_status
  or old.is_active is distinct from new.is_active
)
execute function private.refresh_reaction_summary_from_row();

-- Existing data receives one initial refresh. On a clean local reset this loop
-- is empty and seed inserts are handled by the trigger above.
do $$
declare
  v_restaurant_id uuid;
begin
  for v_restaurant_id in
    select id from public.restaurants order by id
  loop
    perform private.refresh_restaurant_reaction_summary(v_restaurant_id);
  end loop;
end;
$$;

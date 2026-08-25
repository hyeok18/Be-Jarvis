-- WU-09 backend checkpoint: service-only reaction selection command.
-- The browser cannot execute this RPC or mutate reaction rows directly. A later
-- Next.js route will authenticate the user and pass the verified user id.

create or replace function private.append_reaction_selection_event()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
begin
  if tg_op = 'INSERT' then
    insert into public.reaction_events (
      reaction_id,
      actor_user_id,
      event_name,
      before_kind,
      after_kind,
      reason_codes,
      created_at
    )
    values (
      new.id,
      new.user_id,
      'created',
      null,
      new.kind,
      '{}'::text[],
      new.created_at
    );
  elsif new.kind is distinct from old.kind then
    insert into public.reaction_events (
      reaction_id,
      actor_user_id,
      event_name,
      before_kind,
      after_kind,
      reason_codes,
      created_at
    )
    values (
      new.id,
      new.user_id,
      'changed',
      old.kind,
      new.kind,
      '{}'::text[],
      new.updated_at
    );
  end if;

  return new;
end;
$$;

revoke all on function private.append_reaction_selection_event()
from public, anon, authenticated, service_role;

create trigger restaurant_reactions_append_selection_event
after insert or update of kind on public.restaurant_reactions
for each row
execute function private.append_reaction_selection_event();

create or replace function public.save_reaction_selection(
  p_user_id uuid,
  p_restaurant_id uuid,
  p_kind text
)
returns table (
  reaction_id uuid,
  reaction_kind text,
  moderation_status text,
  was_created boolean,
  was_changed boolean,
  saved_at timestamptz
)
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_existing public.restaurant_reactions%rowtype;
  v_saved public.restaurant_reactions%rowtype;
  v_was_created boolean := false;
  v_was_changed boolean := false;
begin
  if p_user_id is null or p_restaurant_id is null then
    raise exception using
      errcode = '22004',
      message = 'user_id and restaurant_id are required';
  end if;

  if p_kind is null or p_kind not in ('like', 'okay', 'dislike') then
    raise exception using
      errcode = '22023',
      message = 'reaction kind must be like, okay, or dislike';
  end if;

  perform 1
  from auth.users
  where id = p_user_id;

  if not found then
    raise exception using
      errcode = '23503',
      message = 'authenticated user does not exist';
  end if;

  perform 1
  from public.restaurants
  where id = p_restaurant_id
    and is_active;

  if not found then
    raise exception using
      errcode = '23503',
      message = 'active restaurant does not exist';
  end if;

  -- Serialize only the same user and restaurant pair. This keeps the transaction
  -- short while preventing concurrent first requests from racing the unique key.
  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended(
      'reaction-selection:' || p_user_id::text || ':' || p_restaurant_id::text,
      0
    )
  );

  select * into v_existing
  from public.restaurant_reactions
  where user_id = p_user_id
    and restaurant_id = p_restaurant_id
  for update;

  if not found then
    insert into public.restaurant_reactions (
      user_id,
      restaurant_id,
      visit_proof_id,
      kind,
      moderation_status,
      risk_codes,
      is_active
    )
    values (
      p_user_id,
      p_restaurant_id,
      null,
      p_kind,
      'private_only',
      '{}'::text[],
      true
    )
    returning * into v_saved;

    v_was_created := true;
    v_was_changed := true;
  else
    v_was_changed := v_existing.kind is distinct from p_kind
      or not v_existing.is_active;

    update public.restaurant_reactions
    set
      kind = p_kind,
      visit_proof_id = case
        when v_existing.is_active then v_existing.visit_proof_id
        else null
      end,
      moderation_status = case
        when v_existing.is_active then v_existing.moderation_status
        else 'private_only'
      end,
      risk_codes = case
        when v_existing.is_active then v_existing.risk_codes
        else '{}'::text[]
      end,
      is_active = true
    where id = v_existing.id
    returning * into v_saved;
  end if;

  return query
  select
    v_saved.id,
    v_saved.kind,
    v_saved.moderation_status,
    v_was_created,
    v_was_changed,
    v_saved.updated_at;
end;
$$;

revoke all on function public.save_reaction_selection(uuid, uuid, text)
from public, anon, authenticated;
grant execute on function public.save_reaction_selection(uuid, uuid, text)
to service_role;

comment on function public.save_reaction_selection(uuid, uuid, text) is
  'Server-only reaction selection command. The caller must verify the Supabase Auth user before passing p_user_id.';

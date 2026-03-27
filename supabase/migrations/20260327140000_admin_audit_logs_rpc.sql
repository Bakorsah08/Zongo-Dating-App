-- Admin-facing filtered read API for audit logs.
-- Supports actor/target/date/action-prefix filtering with pagination.

create or replace function public.admin_list_audit_logs(
  p_action_prefix text default null,
  p_actor_user_id uuid default null,
  p_target_user_id uuid default null,
  p_from timestamptz default null,
  p_to timestamptz default null,
  p_limit integer default 100,
  p_offset integer default 0
)
returns table (
  id bigint,
  action text,
  actor_user_id uuid,
  actor_label text,
  target_user_id uuid,
  amount numeric(14, 2),
  reason text,
  metadata jsonb,
  created_at timestamptz,
  total_count bigint
)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_limit integer := greatest(1, least(coalesce(p_limit, 100), 500));
  v_offset integer := greatest(0, coalesce(p_offset, 0));
begin
  if v_uid is null then
    raise exception 'not_authenticated' using errcode = '42501';
  end if;

  if not public.is_admin(v_uid) then
    raise exception 'forbidden' using errcode = '42501';
  end if;

  return query
  with filtered as (
    select
      al.id,
      al.action,
      al.actor_user_id,
      al.actor_label,
      al.target_user_id,
      al.amount,
      al.reason,
      al.metadata,
      al.created_at
    from public.audit_logs al
    where
      (p_action_prefix is null or p_action_prefix = '' or al.action ilike p_action_prefix || '%')
      and (p_actor_user_id is null or al.actor_user_id = p_actor_user_id)
      and (p_target_user_id is null or al.target_user_id = p_target_user_id)
      and (p_from is null or al.created_at >= p_from)
      and (p_to is null or al.created_at <= p_to)
  ),
  counted as (
    select
      f.*,
      count(*) over () as total_count
    from filtered f
  )
  select
    c.id,
    c.action,
    c.actor_user_id,
    c.actor_label,
    c.target_user_id,
    c.amount,
    c.reason,
    c.metadata,
    c.created_at,
    c.total_count
  from counted c
  order by c.created_at desc, c.id desc
  limit v_limit
  offset v_offset;
end;
$$;

revoke all on function public.admin_list_audit_logs(text, uuid, uuid, timestamptz, timestamptz, integer, integer) from public;
grant execute on function public.admin_list_audit_logs(text, uuid, uuid, timestamptz, timestamptz, integer, integer) to authenticated;

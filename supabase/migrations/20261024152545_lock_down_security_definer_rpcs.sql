-- Lock down SECURITY DEFINER functions exposed through the public API.
--
-- 1) Supabase grants EXECUTE on new functions to `anon` explicitly, so earlier
--    `revoke ... from public` statements did not remove it. As a result,
--    unauthenticated callers (using the public anon key) could execute
--    wallet_apply_delta (credit any wallet) and audit_log_event (forge audit rows).
-- 2) wallet_bootstrap_if_zero trusted a client-supplied starter amount and could be
--    re-run every time a balance hit zero. It now uses the server-side starter
--    setting and only seeds a wallet that has never had a ledger transaction.
--
-- Rollback: re-grant EXECUTE to the previous roles and restore the previous
-- wallet_bootstrap_if_zero body from 20250325150000_wallet_rpc_rls.sql.

-- Server-only functions (called from Edge Functions with the service role).
revoke execute on function public.wallet_apply_delta(uuid, integer, text, text, jsonb) from anon, authenticated;
revoke execute on function public.audit_log_event(text, uuid, text, uuid, numeric, text, jsonb, timestamptz) from anon, authenticated;
grant execute on function public.wallet_apply_delta(uuid, integer, text, text, jsonb) to service_role;
grant execute on function public.audit_log_event(text, uuid, text, uuid, numeric, text, jsonb, timestamptz) to service_role;

-- Signed-in-only functions (they check auth.uid() / is_admin() internally).
revoke execute on function public.wallet_bootstrap_if_zero(integer) from anon;
revoke execute on function public.request_cashout(numeric) from anon;
revoke execute on function public.admin_list_audit_logs(text, uuid, uuid, timestamptz, timestamptz, integer, integer) from anon;

-- Trigger functions: never meant to be called over the API. Triggers keep firing
-- after this, because EXECUTE is only checked when a trigger is created.
revoke execute on function public.handle_new_user() from anon, authenticated;
revoke execute on function public.handle_new_profile_row() from anon, authenticated;
revoke execute on function public.touch_conversation_last_message() from anon, authenticated;
revoke execute on function public.enforce_social_churn_rate_limit() from anon, authenticated;
revoke execute on function public.enforce_message_rate_limit() from anon, authenticated;
revoke execute on function public.enforce_notification_rate_limit() from anon, authenticated;
revoke execute on function public.enforce_gift_event_rate_limit() from anon, authenticated;
revoke execute on function public.rls_auto_enable() from anon, authenticated;

-- Starter tokens: server-decided amount, granted at most once per wallet.
-- p_starter is kept for client compatibility but ignored.
create or replace function public.wallet_bootstrap_if_zero(p_starter integer)
returns jsonb
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  uid uuid := auth.uid();
  starter integer := 250;
  raw text;
  tb integer;
  earn numeric;
  tout numeric;
begin
  if uid is null then
    return jsonb_build_object('ok', false, 'error', 'not_authenticated');
  end if;

  select ps.monetization ->> 'starterTokens' into raw
  from public.platform_settings ps
  order by ps.id
  limit 1;
  if raw ~ '^\d{1,6}$' then
    starter := raw::integer;
  end if;

  if starter > 0 then
    update public.user_account ua
    set token_balance = starter
    where ua.user_id = uid
      and ua.token_balance = 0
      and coalesce(ua.earnings, 0) = 0
      and coalesce(ua.transferred_out, 0) = 0
      and not exists (select 1 from public.wallet_ledger wl where wl.user_id = uid);
  end if;

  select ua.token_balance, ua.earnings, ua.transferred_out
    into tb, earn, tout
  from public.user_account ua
  where ua.user_id = uid;

  if not found then
    return jsonb_build_object('ok', false, 'error', 'no_wallet');
  end if;

  return jsonb_build_object(
    'ok', true,
    'token_balance', tb,
    'earnings', earn,
    'transferred_out', tout
  );
end;
$function$;

revoke all on function public.wallet_bootstrap_if_zero(integer) from public, anon;
grant execute on function public.wallet_bootstrap_if_zero(integer) to authenticated;

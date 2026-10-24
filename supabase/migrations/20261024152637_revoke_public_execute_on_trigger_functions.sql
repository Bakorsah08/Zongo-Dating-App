-- Trigger functions keep a default EXECUTE grant to PUBLIC, which anon/authenticated
-- inherit. They are never meant to be called over the API. Triggers keep firing,
-- because EXECUTE is only checked when a trigger is created.
--
-- Rollback: grant execute on each function below to public.

revoke execute on function public.handle_new_user() from public;
revoke execute on function public.handle_new_profile_row() from public;
revoke execute on function public.touch_conversation_last_message() from public;
revoke execute on function public.enforce_social_churn_rate_limit() from public;
revoke execute on function public.enforce_message_rate_limit() from public;
revoke execute on function public.enforce_notification_rate_limit() from public;
revoke execute on function public.enforce_gift_event_rate_limit() from public;
revoke execute on function public.rls_auto_enable() from public;

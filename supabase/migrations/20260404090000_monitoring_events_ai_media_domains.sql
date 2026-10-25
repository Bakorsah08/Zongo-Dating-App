-- Allow 'ai' and 'media' failure domains (Gemini live sessions, camera / video playback).
-- Rollback: delete rows with domain in ('ai', 'media'), then drop monitoring_events_domain_check and re-add it with ('auth', 'rpc', 'realtime', 'storage').

alter table public.monitoring_events
  drop constraint if exists monitoring_events_domain_check;

alter table public.monitoring_events
  add constraint monitoring_events_domain_check
    check (domain in ('auth', 'rpc', 'realtime', 'storage', 'ai', 'media'));

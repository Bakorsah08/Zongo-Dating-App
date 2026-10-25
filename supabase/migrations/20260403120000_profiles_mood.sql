-- User mood / vibe for Explore tiles (client + server).
-- Rollback: alter table public.profiles drop column if exists mood.
alter table public.profiles
  add column if not exists mood text not null default 'neutral'
    check (
      mood in (
        'neutral',
        'happy',
        'flirty',
        'chill',
        'romantic',
        'party',
        'focus'
      )
    );

comment on column public.profiles.mood is 'Preset shown on Explore; user-editable in app.';

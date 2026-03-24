-- RLS negative checks: cross-user access to private tables and forged writes.
--
-- auth.uid() is driven by JWT claim `sub`. This simulates the PostgREST authenticated
-- role by setting `request.jwt.claim.sub` and `SET ROLE authenticated` (requires postgres / dashboard SQL).
--
-- 1) Replace ua/ub with real auth.users IDs. Both must have profile rows.
-- 2) Optional: a conversation between A and B enables the forged-sender message check.

DO $$
DECLARE
  ua uuid := '00000000-0000-0000-0000-000000000001'::uuid; -- EDIT: user A
  ub uuid := '00000000-0000-0000-0000-000000000002'::uuid; -- EDIT: user B
  n int;
  rc int;

  conv_id_AB uuid;
  conv_other uuid;

  err_msg text;
BEGIN
  IF ua = '00000000-0000-0000-0000-000000000001'::uuid
     OR ub = '00000000-0000-0000-0000-000000000002'::uuid THEN
    RAISE EXCEPTION 'Edit ua/ub with two real user UUIDs before running.';
  END IF;

  ---------------------------------------------------------------------------
  -- User A
  ---------------------------------------------------------------------------
  PERFORM set_config('request.jwt.claim.sub', ua::text, true);
  EXECUTE 'SET ROLE authenticated';

  SELECT count(*)::int INTO n FROM public.user_account WHERE user_id = ub;
  IF n <> 0 THEN RAISE EXCEPTION 'FAIL user_account: A sees B wallet (count=%).', n; END IF;

  SELECT count(*)::int INTO n FROM public.user_preferences WHERE user_id = ub;
  IF n <> 0 THEN RAISE EXCEPTION 'FAIL user_preferences: A sees B prefs (count=%).', n; END IF;

  SELECT count(*)::int INTO n FROM public.user_ad_submissions WHERE user_id = ub;
  IF n <> 0 THEN RAISE EXCEPTION 'FAIL user_ad_submissions: A sees B submissions (count=%).', n; END IF;

  -- Gift ledger: A must not observe B↔third-party events (rows where B is involved but A is neither sender nor recipient).
  SELECT count(*)::int INTO n
  FROM public.gift_events ge
  WHERE (ge.sender_id = ub OR ge.recipient_id = ub)
    AND ge.sender_id IS DISTINCT FROM ua
    AND ge.recipient_id IS DISTINCT FROM ua;
  IF n <> 0 THEN
    RAISE EXCEPTION 'FAIL gift_events: A sees gift rows where B participates but A does not (count=%).', n;
  END IF;

  -- profiles: SELECT all is intentional for discover; UPDATE other users must affect 0 rows.
  SELECT count(*)::int INTO n FROM public.profiles WHERE id = ub;
  IF n < 1 THEN
    RAISE NOTICE 'WARN profiles: no row for B — create profile or ignore.';
  END IF;

  UPDATE public.profiles SET display_name = display_name || '' WHERE id = ub;
  GET DIAGNOSTICS rc = ROW_COUNT;
  IF rc <> 0 THEN RAISE EXCEPTION 'FAIL profiles: A updated B profile (row_count=%).', rc; END IF;

  SELECT c.id INTO conv_id_AB
  FROM public.conversations c
  WHERE (c.participant_a = least(ua, ub) AND c.participant_b = greatest(ua, ub))
  LIMIT 1;

  IF conv_id_AB IS NULL THEN
    RAISE NOTICE 'SKIP forged message: create a conversation between A and B to test sender_id check.';
  ELSE
    BEGIN
      INSERT INTO public.messages (conversation_id, sender_id, body)
      VALUES (conv_id_AB, ub, 'rls test forged sender');
      RAISE EXCEPTION 'FAIL messages: A inserted message with sender_id=B.';
    EXCEPTION
      WHEN insufficient_privilege THEN NULL;
      WHEN SQLSTATE '42501' THEN NULL;
      WHEN OTHERS THEN
        GET STACKED DIAGNOSTICS err_msg = MESSAGE_TEXT;
        IF err_msg ILIKE '%row-level security%'
           OR err_msg ILIKE '%violates row-level security%' THEN
          NULL;
        ELSE
          RAISE;
        END IF;
    END;
  END IF;

  -- Conversation + messages where A is not a participant (needs seeded third-party thread).
  SELECT c.id INTO conv_other
  FROM public.conversations c
  WHERE c.participant_a IS DISTINCT FROM ua AND c.participant_b IS DISTINCT FROM ua
  LIMIT 1;

  IF conv_other IS NULL THEN
    RAISE NOTICE 'SKIP non-participant conv: seed a conversation between two other users.';
  ELSE
    SELECT count(*)::int INTO n FROM public.conversations WHERE id = conv_other;
    IF n <> 0 THEN RAISE EXCEPTION 'FAIL conversations: A can select conv % without being participant.', conv_other; END IF;

    SELECT count(*)::int INTO n FROM public.messages WHERE conversation_id = conv_other;
    IF n <> 0 THEN RAISE EXCEPTION 'FAIL messages: A can read outsider thread for conv %.', conv_other; END IF;
  END IF;

  -- INSERT as peer user_id (must fail)
  BEGIN
    INSERT INTO public.user_ad_submissions (user_id, duration_days) VALUES (ub, 7);
    RAISE EXCEPTION 'FAIL user_ad_submissions: A inserted submission for B.';
  EXCEPTION
    WHEN insufficient_privilege THEN NULL;
    WHEN SQLSTATE '42501' THEN NULL;
    WHEN OTHERS THEN
      GET STACKED DIAGNOSTICS err_msg = MESSAGE_TEXT;
      IF err_msg ILIKE '%row-level security%'
         OR err_msg ILIKE '%violates row-level security%' THEN
        NULL;
      ELSE
        RAISE;
      END IF;
  END;

  BEGIN
    INSERT INTO public.user_preferences (user_id) VALUES (ub);
    RAISE EXCEPTION 'FAIL user_preferences: A inserted prefs for B.';
  EXCEPTION
    WHEN insufficient_privilege THEN NULL;
    WHEN SQLSTATE '42501' THEN NULL;
    WHEN OTHERS THEN
      GET STACKED DIAGNOSTICS err_msg = MESSAGE_TEXT;
      IF err_msg ILIKE '%row-level security%'
         OR err_msg ILIKE '%violates row-level security%' THEN
        NULL;
      ELSE
        RAISE;
      END IF;
  END;

  BEGIN
    INSERT INTO public.gift_events (sender_id, recipient_id, gift_id, token_value)
    VALUES (ub, ua, 'test_gift', 0);
    RAISE EXCEPTION 'FAIL gift_events: A inserted gift attributed to B as sender.';
  EXCEPTION
    WHEN insufficient_privilege THEN NULL;
    WHEN SQLSTATE '42501' THEN NULL;
    WHEN OTHERS THEN
      GET STACKED DIAGNOSTICS err_msg = MESSAGE_TEXT;
      IF err_msg ILIKE '%row-level security%'
         OR err_msg ILIKE '%violates row-level security%' THEN
        NULL;
      ELSE
        RAISE;
      END IF;
  END;

  RESET ROLE;

  ---------------------------------------------------------------------------
  -- User B (symmetry on private reads)
  ---------------------------------------------------------------------------
  PERFORM set_config('request.jwt.claim.sub', ub::text, true);
  EXECUTE 'SET ROLE authenticated';

  SELECT count(*)::int INTO n FROM public.user_account WHERE user_id = ua;
  IF n <> 0 THEN RAISE EXCEPTION 'FAIL user_account: B sees A wallet (count=%).', n; END IF;

  SELECT count(*)::int INTO n FROM public.user_preferences WHERE user_id = ua;
  IF n <> 0 THEN RAISE EXCEPTION 'FAIL user_preferences: B sees A prefs (count=%).', n; END IF;

  SELECT count(*)::int INTO n FROM public.user_ad_submissions WHERE user_id = ua;
  IF n <> 0 THEN RAISE EXCEPTION 'FAIL user_ad_submissions: B sees A submissions (count=%).', n; END IF;

  SELECT count(*)::int INTO n
  FROM public.gift_events ge
  WHERE (ge.sender_id = ua OR ge.recipient_id = ua)
    AND ge.sender_id IS DISTINCT FROM ub
    AND ge.recipient_id IS DISTINCT FROM ub;
  IF n <> 0 THEN
    RAISE EXCEPTION 'FAIL gift_events: B sees gift rows for A with third party only (count=%).', n;
  END IF;

  RESET ROLE;

  RAISE NOTICE 'rls_cross_user_negative.sql finished OK (read NOTICEs for skipped optional seeds).';
END $$;

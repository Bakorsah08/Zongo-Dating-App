import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import type { Session } from '@supabase/supabase-js';
import {
  View,
  User,
  AppState,
  UserGender,
  type AppNotification,
  type ExploreCarouselAd,
  type TokenPackage,
  type UserAdSubmission,
} from './types';
import { getUsers, getBadges, getMonetizationSettings } from './data';
import { adminStore } from './admin/store';
import { getAppSession, setAppSession, setAppSessionGender, clearAppSession } from './appSession';
import { isSupabaseConfigured, getSupabase } from './lib/supabaseClient';
import { toUserSafeMessage } from './lib/userSafeError';
import {
  fetchMyProfile,
  ensureProfileRow,
  updateMyProfile,
  updateProfileGender,
} from './services/supabaseProfile';
import {
  bootstrapWallet,
  spendTokens,
  cashOutWallet,
  fetchUserWallet,
} from './services/supabaseWallet';
import { fetchDiscoverUsers, fetchProfilesByIds } from './services/supabaseDiscover';
import {
  addFollow,
  removeFollow,
  addBlock,
  removeBlock,
  listFollowingIds,
  listBlockedIds,
} from './services/supabaseGraph';
import {
  ensureMatchPair,
  getOrCreateConversation,
  listInboxForUser,
  type InboxSummary,
} from './services/supabaseMessaging';
import {
  fetchNotificationsForUser,
  markAllNotificationsReadDb,
  insertSuperLikeNotificationDb,
  appNotificationFromRow,
} from './services/supabaseNotificationsApi';
import { fetchLiveCarouselAdsFromDb } from './services/supabaseCarousel';
import { fetchUserPreferencesFromDb, upsertUserPreferencesDb } from './services/supabaseUserPreferences';
import { insertUserAdSubmissionDb, fetchUserAdSubmissionsFromDb } from './services/supabaseUserAds';
import { recordGiftEvent } from './services/supabaseGifts';
import { uploadChatMedia as uploadChatMediaToStorage } from './services/supabaseStorage';
import { trackFailure, trackRealtimeStatus } from './services/monitoring';
import { fetchActiveTokenPackagesFromDb } from './services/supabaseTokenPackages';
import {
  getWebPaymentMethods,
  pollWalletBalanceIncrease,
  startTokenPurchase,
  type WebPaymentMethod,
} from './services/payments';
import {
  configureRevenueCatIfNeeded,
  revenueCatLogIn,
  revenueCatLogOut,
} from './services/revenuecat/client';
import { isNativeApp } from './lib/platform';
import type { AppNotificationRow } from './models/supabase';
import DiscoverView from './components/DiscoverView';
import LandingPage from './components/LandingPage';
import GenderSelectPage from './components/GenderSelectPage';
import AgeGatePage from './components/AgeGatePage';
import ReportUserSheet from './components/ReportUserSheet';
import {
  deleteMyAccount,
  fetchHasVerifiedAge,
  isDeviceMarkedUnderage,
  markDeviceUnderage,
  submitBirthdate,
  submitUserReport,
  type ReportContext,
  type ReportReason,
} from './services/supabaseSafety';
import ChatListView, { type ChatInboxRow } from './components/ChatListView';
import ChatRoomView from './components/ChatRoomView';
import VideoCallView from './components/VideoCallView';
import LiveStreamView from './components/LiveStreamView';
import TokenShopView from './components/TokenShopView';
import Navbar from './components/Navbar';
import ProfileView from './components/ProfileView';
import NotificationBell from './components/NotificationBell';
import UserDetailView from './components/UserDetailView';
import HomeMenuView from './components/HomeMenuView';
import CashOutView from './components/CashOutView';
import {
  addSuperLikeNotification,
  getNotificationsForUser,
  markAllNotificationsRead,
  SUPER_LIKE_NOTIFICATION_EVENT,
  APP_NOTIFICATION_UPDATED_EVENT,
} from './notificationsStore';
import {
  addBlockedUserId,
  getNotificationPreferences,
  getPrivacyPreferences,
  mergeUserPreferences,
  replaceUserPreferencesCache,
  registerPreferencesCloudWriter,
  USER_PREFERENCES_DEFAULTS,
} from './userPreferencesStore';

const DEFAULT_ME: User = {
  id: 'me',
  name: 'James',
  age: 26,
  bio: 'Lover of tech and design. Looking for someone to explore the world with.',
  avatar: 'https://picsum.photos/seed/me/200',
  interests: ['Coding', 'Design', 'Travel'],
  location: 'New York',
  distance: 0,
  isOnline: true,
  album: ['https://picsum.photos/seed/me1/400/400', 'https://picsum.photos/seed/me2/400/400'],
  earnings: 0,
  transferredOut: 0,
  badgeTier: 'none',
  mood: 'neutral',
};

const App: React.FC = () => {
  const supabaseEnabled = isSupabaseConfigured();
  /** Dev-only: sign in without Supabase when env keys are absent (never in production builds). */
  const devLocalMockAuth = import.meta.env.DEV && !supabaseEnabled;
  const failClosedSupabaseMisconfig = import.meta.env.PROD && !supabaseEnabled;
  const [appSession, setAppSessionState] = useState<ReturnType<typeof getAppSession>>(getAppSession);
  const [sbSession, setSbSession] = useState<Session | null>(null);
  const [sbAuthResolved, setSbAuthResolved] = useState(!supabaseEnabled);
  const [sbProfileResolved, setSbProfileResolved] = useState(!supabaseEnabled);
  const profileLoadGenRef = useRef(0);
  const [serverGender, setServerGender] = useState<UserGender | null>(null);
  /** 18+ age gate: false until the signed-in user has a verified birthdate. */
  const [ageVerified, setAgeVerified] = useState(false);
  /** Shown after sign-out when an under-18 birthdate was entered. */
  const [underageNotice, setUnderageNotice] = useState(false);
  const [isScrolling, setIsScrolling] = useState(false);
  const [scrollEndTimer, setScrollEndTimer] = useState<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    setAppSessionState(getAppSession());
  }, []);

  useEffect(() => {
    if (!supabaseEnabled) return;
    const sb = getSupabase();
    const resolveAuth = () => setSbAuthResolved(true);
    const authTimeout = window.setTimeout(resolveAuth, 10_000);
    void sb.auth
      .getSession()
      .then(({ data: { session } }) => {
        setSbSession(session);
        resolveAuth();
      })
      .catch(() => resolveAuth());
    const {
      data: { subscription },
    } = sb.auth.onAuthStateChange((_event, session) => {
      setSbSession(session);
      resolveAuth();
      if (!session) {
        setServerGender(null);
        setAgeVerified(false);
        setSbProfileResolved(true);
      }
      // Do not set sbProfileResolved(false) here: TOKEN_REFRESHED re-fires this callback
      // with the same user id, and the profile effect does not re-run — leaving the app
      // stuck on "Signing you in…" forever. Profile loading toggles that flag instead.
    });
    return () => {
      window.clearTimeout(authTimeout);
      subscription.unsubscribe();
    };
  }, [supabaseEnabled]);

  useEffect(() => {
    if (!supabaseEnabled) return;
    if (!sbSession?.user) {
      setSbProfileResolved(true);
      return;
    }
    const gen = ++profileLoadGenRef.current;
    const uid = sbSession.user.id;
    const email = sbSession.user.email ?? undefined;
    const fallbackName = email?.split('@')[0] || 'Member';
    setSbProfileResolved(false);

    const applyFallbackUser = () => {
      setState((prev) => ({
        ...prev,
        currentUser: {
          ...prev.currentUser,
          id: uid,
          name: fallbackName,
        },
      }));
      setServerGender(null);
    };

    const profileTimeout = window.setTimeout(() => {
      if (profileLoadGenRef.current !== gen) return;
      applyFallbackUser();
      setSbProfileResolved(true);
    }, 12_000);

    (async () => {
      try {
        const ageCheck = fetchHasVerifiedAge(uid);
        let merged = await fetchMyProfile(uid, DEFAULT_ME);
        if (!merged) {
          await ensureProfileRow(uid, email);
          merged = await fetchMyProfile(uid, DEFAULT_ME);
        }
        if (profileLoadGenRef.current !== gen) return;
        if (merged) {
          setState((prev) => {
            const nextUser = { ...DEFAULT_ME, ...merged };
            const inStore = getUsers().some((u) => u.id === nextUser.id);
            if (!inStore) adminStore.addUser(nextUser);
            else adminStore.updateUser(nextUser.id, merged);
            return {
              ...prev,
              currentUser: { ...prev.currentUser, ...nextUser },
            };
          });
          setServerGender(merged.gender ?? null);
        } else {
          applyFallbackUser();
        }
        const verified = await ageCheck;
        if (profileLoadGenRef.current === gen) setAgeVerified(verified);
      } catch {
        if (profileLoadGenRef.current === gen) applyFallbackUser();
      } finally {
        window.clearTimeout(profileTimeout);
        if (profileLoadGenRef.current === gen) setSbProfileResolved(true);
      }
    })();

    return () => {
      window.clearTimeout(profileTimeout);
    };
  }, [supabaseEnabled, sbSession?.user?.id]);

  const handleMockEmailAuth = (email: string, _password: string) => {
    if (!devLocalMockAuth) return;
    setAppSession({ email });
    setAppSessionState(getAppSession());
  };

  const handleMockAnonymousAuth = () => {
    if (!devLocalMockAuth) return;
    setAppSession({ email: 'guest@local.dev' });
    setAppSessionState(getAppSession());
  };

  const handleGenderSelect = async (gender: UserGender) => {
    if (supabaseEnabled && sbSession?.user?.id) {
      await updateProfileGender(sbSession.user.id, gender);
      setServerGender(gender);
    } else if (devLocalMockAuth) {
      setAppSessionGender(gender);
      setAppSessionState(getAppSession());
    }
  };

  const handleBirthdateSubmit = async (birthdate: string): Promise<string | void> => {
    const uid = sbSession?.user?.id;
    if (!uid) return 'You are signed out. Please sign in again.';
    const res = await submitBirthdate(uid, birthdate);
    if (res.ok === false) {
      if (res.error === 'must_be_18') {
        handleUnderage();
        return;
      }
      if (res.error === 'invalid_birthdate') return 'Enter a valid date of birth.';
      return 'Could not save your date of birth. Check your connection and try again.';
    }
    setAgeVerified(true);
    const profile = await fetchMyProfile(uid, DEFAULT_ME);
    if (profile) {
      setState((prev) => ({ ...prev, currentUser: { ...prev.currentUser, age: profile.age } }));
    }
  };

  const handleUnderage = () => {
    markDeviceUnderage();
    setUnderageNotice(true);
    void handleAppLogout();
  };

  const handleAppLogout = async () => {
    void revenueCatLogOut();
    clearAppSession();
    setAppSessionState(null);
    if (supabaseEnabled) {
      await getSupabase().auth.signOut();
      setServerGender(null);
      const users = getUsers();
      const meUser = users.find((u) => u.id === 'me');
      const currentUser = meUser ? { ...DEFAULT_ME, ...meUser } : DEFAULT_ME;
      if (!meUser) adminStore.addUser(currentUser);
      setIsHomeMenuOpen(false);
      setActiveCloudConversationId(null);
      setState((prev) => ({
        ...prev,
        currentUser,
        matches: users.filter((u) => u.id !== 'me').slice(0, 2),
        followingIds: [],
        currentView: View.EXPLORE,
        selectedChatPartner: undefined,
        selectedLiveHost: undefined,
        selectedUserForDetail: undefined,
        profileReturnView: undefined,
        liveStreamParticipants: undefined,
        liveHostBroadcastMedia: undefined,
      }));
      setCloudDiscoverUsers([]);
      setInboxSummaries([]);
      setCloudNotifs([]);
      setFollowingUsersCloud([]);
      setCloudDiscoverError(null);
      setCloudCarouselAds([]);
      setCloudUserAdSubmissions([]);
      setChatThreadError(null);
    }
  };

  const [state, setState] = useState<AppState>(() => {
    const users = getUsers();
    const meUser = users.find((u) => u.id === 'me');
    const currentUser = meUser ? { ...DEFAULT_ME, ...meUser } : DEFAULT_ME;
    if (!meUser) adminStore.addUser(currentUser);
    return {
      currentUser,
      tokens: getMonetizationSettings().starterTokens,
      matches: users.filter((u) => u.id !== 'me').slice(0, 2),
      followingIds: [],
      currentView: View.EXPLORE,
    };
  });
  const [isHomeMenuOpen, setIsHomeMenuOpen] = useState(false);
  const [notifTick, setNotifTick] = useState(0);
  const [userAdSubmissionsTick, setUserAdSubmissionsTick] = useState(0);
  const [notifPanelOpen, setNotifPanelOpen] = useState(false);
  const [superLikeToast, setSuperLikeToast] = useState<string | null>(null);
  const [blockedUserIds, setBlockedUserIds] = useState<string[]>(() => getPrivacyPreferences().blockedUserIds);
  const [exploreFilterSignal, setExploreFilterSignal] = useState(0);
  const [prefsTick, setPrefsTick] = useState(0);
  const [cloudDiscoverUsers, setCloudDiscoverUsers] = useState<User[]>([]);
  const [cloudDiscoverLoading, setCloudDiscoverLoading] = useState(false);
  const [cloudDiscoverError, setCloudDiscoverError] = useState<string | null>(null);
  const [chatThreadError, setChatThreadError] = useState<string | null>(null);
  const [inboxSummaries, setInboxSummaries] = useState<InboxSummary[]>([]);
  const [activeCloudConversationId, setActiveCloudConversationId] = useState<string | null>(null);
  const [cloudNotifs, setCloudNotifs] = useState<AppNotification[]>([]);
  const [followingUsersCloud, setFollowingUsersCloud] = useState<User[]>([]);
  const [cloudCarouselAds, setCloudCarouselAds] = useState<ExploreCarouselAd[]>([]);
  const [cloudUserAdSubmissions, setCloudUserAdSubmissions] = useState<UserAdSubmission[]>([]);
  const [cloudTokenPackages, setCloudTokenPackages] = useState<TokenPackage[]>([]);
  const [purchasePending, setPurchasePending] = useState(false);
  const [purchaseNotice, setPurchaseNotice] = useState<string | null>(null);
  const currentUserRef = useRef(state.currentUser);
  currentUserRef.current = state.currentUser;
  const prefsUidRef = useRef<string | undefined>(undefined);
  prefsUidRef.current = sbSession?.user?.id;
  const prevViewRef = useRef<View>(state.currentView);
  const prevShowLandingRef = useRef<boolean | null>(null);

  /** After sign-in (leaving landing), always open the home / Explore feed. */
  useEffect(() => {
    const showLanding = supabaseEnabled ? !sbSession : devLocalMockAuth ? !appSession : true;
    const prev = prevShowLandingRef.current;
    if (prev === true && showLanding === false) {
      setIsHomeMenuOpen(false);
      setActiveCloudConversationId(null);
      setState((prevState) => ({
        ...prevState,
        currentView: View.EXPLORE,
        selectedChatPartner: undefined,
        selectedLiveHost: undefined,
        selectedUserForDetail: undefined,
        profileReturnView: undefined,
        liveStreamParticipants: undefined,
        liveHostBroadcastMedia: undefined,
      }));
    }
    prevShowLandingRef.current = showLanding;
  }, [supabaseEnabled, sbSession, devLocalMockAuth, appSession]);

  const loadCloudData = useCallback(async () => {
    if (!supabaseEnabled || !sbSession?.user?.id || !sbProfileResolved) return;
    const uid = sbSession.user.id;
    setCloudDiscoverLoading(true);
    setCloudDiscoverError(null);
    try {
      const starter = getMonetizationSettings().starterTokens;
      const [
        wallet,
        following,
        blocked,
        discoverList,
        inbox,
        notifs,
        carouselAds,
        prefsRemote,
        adSubs,
        tokenPkgs,
      ] = await Promise.all([
        bootstrapWallet(uid, starter),
        listFollowingIds(uid),
        listBlockedIds(uid),
        fetchDiscoverUsers(uid),
        listInboxForUser(uid),
        fetchNotificationsForUser(uid),
        fetchLiveCarouselAdsFromDb(),
        fetchUserPreferencesFromDb(uid),
        fetchUserAdSubmissionsFromDb(uid),
        fetchActiveTokenPackagesFromDb().catch(() => []),
      ]);
      if (wallet) {
        setState((prev) => ({
          ...prev,
          tokens: wallet.token_balance,
          currentUser: {
            ...prev.currentUser,
            earnings: wallet.earnings,
            transferredOut: wallet.transferred_out,
          },
        }));
      }
      setState((prev) => ({
        ...prev,
        followingIds: following,
        matches: inbox.map((x) => x.partner),
      }));
      setBlockedUserIds(blocked);
      setCloudDiscoverUsers(discoverList);
      setInboxSummaries(inbox);
      setCloudNotifs(notifs);
      setCloudCarouselAds(carouselAds);
      setCloudUserAdSubmissions(adSubs);
      setCloudTokenPackages(tokenPkgs);
      let mergedPrefs = mergeUserPreferences(USER_PREFERENCES_DEFAULTS, prefsRemote ?? {});
      mergedPrefs = mergeUserPreferences(mergedPrefs, {
        privacy: { ...mergedPrefs.privacy, blockedUserIds: blocked },
      });
      replaceUserPreferencesCache(mergedPrefs);
      setPrefsTick((t) => t + 1);
    } catch (e) {
      setCloudDiscoverError(
        toUserSafeMessage(e, 'We could not load your data. Please try again.')
      );
    } finally {
      setCloudDiscoverLoading(false);
    }
  }, [supabaseEnabled, sbSession?.user?.id, sbProfileResolved]);

  useEffect(() => {
    void loadCloudData();
  }, [loadCloudData]);

  useEffect(() => {
    if (!supabaseEnabled || !sbSession?.user?.id) {
      registerPreferencesCloudWriter(null);
      return () => registerPreferencesCloudWriter(null);
    }
    registerPreferencesCloudWriter((p) => {
      const uid = prefsUidRef.current;
      if (!uid) return;
      void upsertUserPreferencesDb(uid, p);
    });
    return () => registerPreferencesCloudWriter(null);
  }, [supabaseEnabled, sbSession?.user?.id]);

  useEffect(() => {
    if (!supabaseEnabled || !sbSession?.user?.id) return;
    const uid = sbSession.user.id;
    const sb = getSupabase();
    const ch = sb
      .channel(`app-notifs-${uid}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'app_notifications',
          filter: `recipient_id=eq.${uid}`,
        },
        (payload) => {
          const row = payload.new as AppNotificationRow;
          const n = appNotificationFromRow(row);
          setCloudNotifs((prev) => {
            if (prev.some((x) => x.id === n.id)) return prev;
            return [n, ...prev];
          });
          if (
            n.type === 'super_like' &&
            n.fromUserId &&
            n.fromUserId !== uid &&
            getNotificationPreferences().superLikeEnabled
          ) {
            setSuperLikeToast('You received a Super Like!');
            window.setTimeout(() => setSuperLikeToast(null), 4500);
          }
          setNotifTick((t) => t + 1);
        }
      )
      .subscribe((status, err) => {
        trackRealtimeStatus('app_notifications_subscription', status, err);
      });
    return () => {
      void sb.removeChannel(ch);
    };
  }, [supabaseEnabled, sbSession?.user?.id]);

  useEffect(() => {
    if (!supabaseEnabled || state.followingIds.length === 0) {
      setFollowingUsersCloud([]);
      return;
    }
    void fetchProfilesByIds(state.followingIds).then(setFollowingUsersCloud);
  }, [supabaseEnabled, state.followingIds]);

  useEffect(() => {
    if (prevViewRef.current === View.CHAT_ROOM && state.currentView !== View.CHAT_ROOM) {
      setActiveCloudConversationId(null);
    }
    prevViewRef.current = state.currentView;
  }, [state.currentView]);

  useEffect(() => {
    if (!notifPanelOpen || !supabaseEnabled || !sbSession?.user?.id) return;
    void fetchNotificationsForUser(sbSession.user.id).then(setCloudNotifs);
  }, [notifPanelOpen, supabaseEnabled, sbSession?.user?.id]);

  useEffect(() => {
    const c = adminStore.consumePendingTokenCredits(state.currentUser.id);
    if (c > 0) {
      setState((prev) => {
        const next = prev.tokens + c;
        if (supabaseEnabled && sbSession?.user?.id === state.currentUser.id) {
          // Deprecated local refund queue should not mutate server wallet directly.
        }
        return { ...prev, tokens: next };
      });
    }
  }, [state.currentUser.id, supabaseEnabled, sbSession?.user?.id]);

  useEffect(() => {
    if (adminStore.processExpiredUserAds()) {
      setNotifTick((t) => t + 1);
    }
  }, []);

  useEffect(() => {
    const id = window.setInterval(() => {
      if (adminStore.processExpiredUserAds()) {
        setNotifTick((t) => t + 1);
      }
    }, 25000);
    return () => clearInterval(id);
  }, []);

  useEffect(() => {
    const onSuperLikeEvent = (ev: Event) => {
      const recipientId = (ev as CustomEvent<{ recipientId: string }>).detail?.recipientId;
      if (recipientId && recipientId === currentUserRef.current.id) {
        if (getNotificationPreferences().superLikeEnabled) {
          setSuperLikeToast('You received a Super Like!');
          window.setTimeout(() => setSuperLikeToast(null), 4500);
        }
        setNotifTick((t) => t + 1);
      }
    };
    const onAppNotif = (ev: Event) => {
      const recipientId = (ev as CustomEvent<{ recipientId: string }>).detail?.recipientId;
      if (recipientId && recipientId === currentUserRef.current.id) {
        setNotifTick((t) => t + 1);
      }
    };
    window.addEventListener(SUPER_LIKE_NOTIFICATION_EVENT, onSuperLikeEvent);
    window.addEventListener(APP_NOTIFICATION_UPDATED_EVENT, onAppNotif);
    return () => {
      window.removeEventListener(SUPER_LIKE_NOTIFICATION_EVENT, onSuperLikeEvent);
      window.removeEventListener(APP_NOTIFICATION_UPDATED_EVENT, onAppNotif);
    };
  }, []);

  useEffect(() => {
    const onStorage = (e: StorageEvent) => {
      if (e.key === 'zongo_app_notifications') {
        setNotifTick((t) => t + 1);
      }
    };
    window.addEventListener('storage', onStorage);
    return () => window.removeEventListener('storage', onStorage);
  }, []);

  const profileViewPrev = useRef<View | null>(null);
  useEffect(() => {
    if (state.currentView === View.PROFILE && profileViewPrev.current !== View.PROFILE) {
      adminStore.hydrateFromLocalStorage();
      setUserAdSubmissionsTick((t) => t + 1);
    }
    profileViewPrev.current = state.currentView;
  }, [state.currentView, state.currentUser.id]);

  const profileInAppNotifications = useMemo(() => {
    if (!state.currentUser) return [];
    const raw = supabaseEnabled ? cloudNotifs : getNotificationsForUser(state.currentUser.id);
    const { superLikeEnabled, systemEnabled } = getNotificationPreferences();
    return raw.filter((n) => {
      if (n.type === 'super_like' && !superLikeEnabled) return false;
      if (n.type === 'system' && !systemEnabled) return false;
      return true;
    });
  }, [state.currentUser?.id, notifTick, prefsTick, supabaseEnabled, cloudNotifs]);

  const notifUnreadCount = useMemo(
    () => profileInAppNotifications.filter((n) => !n.read).length,
    [profileInAppNotifications]
  );

  const currentUserId = state.currentUser?.id;
  const handleNotifBellToggle = useCallback(() => {
    setNotifPanelOpen((prev) => {
      if (!prev && currentUserId) {
        if (supabaseEnabled && sbSession?.user?.id) {
          void markAllNotificationsReadDb(sbSession.user.id).then(() => {
            setCloudNotifs((list) => list.map((n) => ({ ...n, read: true })));
          });
        } else {
          markAllNotificationsRead(currentUserId);
        }
        setNotifTick((t) => t + 1);
      }
      return !prev;
    });
  }, [currentUserId, supabaseEnabled, sbSession?.user?.id]);

  useEffect(() => {
    const v = state.currentView;
    if (
      v === View.LIVE_STREAM ||
      v === View.HOST_LIVE ||
      v === View.CHAT_ROOM ||
      v === View.VIDEO_CALL ||
      v === View.USER_DETAIL
    ) {
      setNotifPanelOpen(false);
    }
  }, [state.currentView]);
  const userAdSubmissions = useMemo(
    () =>
      state.currentUser
        ? supabaseEnabled
          ? cloudUserAdSubmissions
          : adminStore.getUserAdSubmissionsForUser(state.currentUser.id)
        : [],
    [state.currentUser?.id, userAdSubmissionsTick, supabaseEnabled, cloudUserAdSubmissions]
  );

  const [reportTarget, setReportTarget] = useState<{ id: string; name: string; context: ReportContext } | null>(null);

  /** Block a member and drop them from matches / following; leaves their profile if it's open. */
  const blockUserAndLeaveProfile = (id: string) => {
    if (supabaseEnabled && sbSession?.user?.id) {
      void addBlock(sbSession.user.id, id);
    }
    addBlockedUserId(id);
    setBlockedUserIds((prev) => (prev.includes(id) ? prev : [...prev, id]));
    setState((prev) => ({
      ...prev,
      matches: prev.matches.filter((m) => m.id !== id),
      followingIds: prev.followingIds.filter((x) => x !== id),
      ...(prev.selectedUserForDetail?.id === id
        ? { currentView: prev.profileReturnView ?? View.EXPLORE, selectedUserForDetail: undefined }
        : {}),
    }));
  };

  const handleSubmitReport = async (input: {
    reason: ReportReason;
    details: string;
    alsoBlock: boolean;
  }): Promise<string | void> => {
    const target = reportTarget;
    if (!target) return;
    if (supabaseEnabled && sbSession?.user?.id) {
      const res = await submitUserReport({
        reporterId: sbSession.user.id,
        reportedId: target.id,
        reason: input.reason,
        details: input.details,
        context: target.context,
      });
      if (res.ok === false) return res.error;
    }
    if (input.alsoBlock) blockUserAndLeaveProfile(target.id);
  };

  const handleDeleteAccount = async (): Promise<string | void> => {
    const res = await deleteMyAccount();
    if (res.ok === false) return res.error;
    // The auth user no longer exists, so only clear the local session.
    await getSupabase().auth.signOut({ scope: 'local' }).catch(() => undefined);
    await handleAppLogout();
  };

  const handleUnblockUser = useCallback(
    (userId: string) => {
      if (supabaseEnabled && sbSession?.user?.id) {
        void removeBlock(sbSession.user.id, userId);
      }
      setBlockedUserIds((prev) => prev.filter((id) => id !== userId));
    },
    [supabaseEnabled, sbSession?.user?.id]
  );

  const setView = (view: View) => {
    if (view === View.HOME) {
      setIsHomeMenuOpen(true);
    } else {
      setIsHomeMenuOpen(false); // Always close menu when navigating
      setState((prev) => {
        const next: Partial<AppState> = { currentView: view };
        // Fresh host session: stale participants from watching someone else's live
        // made mainUser !== you, so camera never turned on.
        if (view === View.HOST_LIVE && prev.currentUser) {
          next.liveStreamParticipants = [prev.currentUser];
          next.selectedLiveHost = undefined;
          next.liveHostBroadcastMedia = { micOn: true, camOn: true };
        }
        return { ...prev, ...next };
      });
    }
  };

  const handleMenuAction = (viewToGo: View) => {
    setIsHomeMenuOpen(false);
    setTimeout(() => {
      setState(prev => ({ ...prev, currentView: viewToGo }));
    }, 200);
  };

  const openUserDetail = (user: User) => {
    setState(prev => ({
      ...prev,
      currentView: View.USER_DETAIL,
      selectedUserForDetail: user,
      profileReturnView: prev.currentView
    }));
  };

  const toggleFollow = (userId: string) => {
    setState((prev) => {
      const isF = prev.followingIds.includes(userId);
      const me = sbSession?.user?.id;
      if (supabaseEnabled && me) {
        void (isF ? removeFollow(me, userId) : addFollow(me, userId));
      }
      return {
        ...prev,
        followingIds: isF ? prev.followingIds.filter((id) => id !== userId) : [...prev.followingIds, userId],
      };
    });
  };

  const ensureFollowing = (userId: string) => {
    setState((prev) => {
      if (prev.followingIds.includes(userId)) return prev;
      const me = sbSession?.user?.id;
      if (supabaseEnabled && me) {
        void addFollow(me, userId);
      }
      return { ...prev, followingIds: [...prev.followingIds, userId] };
    });
  };

  const openChat = (user: User) => {
    void (async () => {
      let cid: string | null = null;
      let inboxPartners: User[] | null = null;
      if (supabaseEnabled && sbSession?.user?.id && !user.isAI) {
        const me = sbSession.user.id;
        setChatThreadError(null);
        await ensureMatchPair(me, user.id);
        cid = await getOrCreateConversation(me, user.id);
        if (!cid) {
          setChatThreadError('Could not open a synced chat. Check your connection and try again.');
        }
        const inbox = await listInboxForUser(me);
        setInboxSummaries(inbox);
        inboxPartners = inbox.map((x) => x.partner);
      } else {
        setChatThreadError(null);
      }
      setActiveCloudConversationId(cid);
      setState((prev) => {
        const baseMatches = inboxPartners ?? prev.matches ?? [];
        const isAlreadyMatched = baseMatches.some((m) => m.id === user.id);
        const nextMatches =
          !isAlreadyMatched && !user.isAI ? [...baseMatches, user] : baseMatches;
        return {
          ...prev,
          matches: nextMatches,
          currentView: View.CHAT_ROOM,
          selectedChatPartner: user,
        };
      });
    })();
  };

  const openLive = (user: User) => {
    const others = getUsers().filter(u => u.id !== user.id).slice(0, 4);
    setState(prev => ({
      ...prev,
      currentView: View.LIVE_STREAM,
      selectedLiveHost: user,
      liveStreamParticipants: [user, ...others]
    }));
  };

  const handleUpdateAlbum = (newAlbum: string[]) => {
    if (!state.currentUser) return;
    const id = state.currentUser.id;
    adminStore.updateUser(id, { album: newAlbum });
    setState((prev) => ({ ...prev, currentUser: { ...prev.currentUser, album: newAlbum } }));
    if (supabaseEnabled && sbSession?.user?.id) {
      void updateMyProfile(sbSession.user.id, { album: newAlbum });
    }
  };

  const handleUpdateAvatar = (newAvatarUrl: string) => {
    if (!state.currentUser) return;
    const id = state.currentUser.id;
    adminStore.updateUser(id, { avatar: newAvatarUrl });
    setState((prev) => ({ ...prev, currentUser: { ...prev.currentUser, avatar: newAvatarUrl } }));
    if (supabaseEnabled && sbSession?.user?.id) {
      void updateMyProfile(sbSession.user.id, { avatar: newAvatarUrl });
    }
  };

  const handleUpdateProfile = (updates: Partial<User>) => {
    setState((prev) => {
      const id = prev.currentUser.id;
      adminStore.updateUser(id, updates);
      return {
        ...prev,
        currentUser: { ...prev.currentUser, ...updates },
      };
    });
    if (supabaseEnabled && sbSession?.user?.id) {
      void updateMyProfile(sbSession.user.id, updates);
    }
  };

  const handlePurchaseBadge = (tier: import('./types').BadgeTier): boolean => {
    const badge = getBadges().find((b) => b.id === tier);
    if (!badge || badge.tokenCost === 0) return false;
    if (state.tokens >= badge.tokenCost) {
      setState((prev) => {
        const next = prev.tokens - badge.tokenCost;
        if (supabaseEnabled && sbSession?.user?.id) void spendTokens(sbSession.user.id, badge.tokenCost);
        return {
          ...prev,
          tokens: next,
          currentUser: { ...prev.currentUser, badgeTier: tier },
        };
      });
      return true;
    }
    setView(View.TOKEN_SHOP);
    return false;
  };

  const deductTokens = (amount: number): boolean => {
    if (state.tokens && state.tokens >= amount) {
      setState((prev) => {
        const next = (prev.tokens || 0) - amount;
        if (supabaseEnabled && sbSession?.user?.id) void spendTokens(sbSession.user.id, amount);
        return { ...prev, tokens: next };
      });
      return true;
    }
    setView(View.TOKEN_SHOP);
    return false;
  };

  /** Local / offline token credit (e.g. refunds in mock mode). With Supabase, prefer server wallet after purchases. */
  const addTokens = async (amount: number, priceUsd?: number) => {
    if (supabaseEnabled && sbSession?.user?.id) {
      setState((prev) => ({ ...prev, tokens: (prev.tokens ?? 0) + amount }));
      return;
    }

    setState((prev) => ({ ...prev, tokens: prev.tokens + amount }));
    if (priceUsd != null && priceUsd > 0) {
      adminStore.addPlatformRevenueFromTokenSales(priceUsd);
    }
  };

  const purchaseTokenPackage = async (pkg: TokenPackage, method?: WebPaymentMethod) => {
    const priceUsd = parseFloat(pkg.price.replace(/[^0-9.]/g, '')) || 0;
    if (!supabaseEnabled || !sbSession?.user?.id) {
      await addTokens(pkg.tokens, priceUsd);
      return;
    }

    const uid = sbSession.user.id;
    setPurchasePending(true);
    setPurchaseNotice(null);
    try {
      const snapshot = await fetchUserWallet(uid);
      const beforeTokens = snapshot?.token_balance ?? state.tokens ?? 0;
      if (!isNativeApp()) {
        sessionStorage.setItem(
          'zongo_pending_checkout',
          JSON.stringify({ userId: uid, beforeTokens })
        );
      }
      const result = await startTokenPurchase({
        packageId: pkg.id,
        revenuecatProductId: pkg.revenuecatProductId,
        method,
      });
      if (result.errorMessage) {
        if (!result.userCancelled) {
          setPurchaseNotice(toUserSafeMessage(result.errorMessage));
        }
        setPurchasePending(false);
        sessionStorage.removeItem('zongo_pending_checkout');
        return;
      }
      if (result.redirected) return;

      if (result.purchaseCompleted) {
        setPurchaseNotice('Confirming your purchase…');
        const credited = await pollWalletBalanceIncrease(uid, beforeTokens);
        if (credited) {
          const wallet = await fetchUserWallet(uid);
          if (wallet) {
            setState((prev) => ({ ...prev, tokens: wallet.token_balance }));
          }
          setPurchaseNotice('Tokens added to your wallet.');
        } else {
          setPurchaseNotice(
            'Purchase completed. Your balance will update shortly — reopen the Token Shop to refresh.'
          );
        }
        setPurchasePending(false);
        return;
      }

      setPurchasePending(false);
      sessionStorage.removeItem('zongo_pending_checkout');
    } catch (e) {
      setPurchaseNotice(toUserSafeMessage(e, 'Checkout could not start. Try again.'));
      setPurchasePending(false);
      sessionStorage.removeItem('zongo_pending_checkout');
    }
  };

  useEffect(() => {
    if (!isNativeApp()) return;
    void configureRevenueCatIfNeeded();
  }, []);

  useEffect(() => {
    const uid = sbSession?.user?.id;
    if (!uid || !isNativeApp()) return;
    void revenueCatLogIn(uid);
  }, [sbSession?.user?.id]);

  useEffect(() => {
    const uid = sbSession?.user?.id;
    if (!supabaseEnabled || !uid) return;
    const params = new URLSearchParams(window.location.search);
    const checkout = params.get('checkout');
    if (!checkout) return;

    const cleanupUrl = () => {
      window.history.replaceState({}, '', window.location.pathname + window.location.hash);
    };

    if (checkout === 'cancel') {
      cleanupUrl();
      setPurchaseNotice('Checkout canceled.');
      sessionStorage.removeItem('zongo_pending_checkout');
      return;
    }

    if (checkout !== 'success') return;

    let cancelled = false;
    setPurchasePending(true);
    setPurchaseNotice('Confirming your payment…');

    (async () => {
      const raw = sessionStorage.getItem('zongo_pending_checkout');
      let beforeTokens = 0;
      if (raw) {
        try {
          const o = JSON.parse(raw) as { beforeTokens?: number; userId?: string };
          if (o.userId === uid && typeof o.beforeTokens === 'number') beforeTokens = o.beforeTokens;
        } catch {
          /* ignore */
        }
      }

      const credited = await pollWalletBalanceIncrease(uid, beforeTokens);
      if (cancelled) return;
      if (credited) {
        const wallet = await fetchUserWallet(uid);
        sessionStorage.removeItem('zongo_pending_checkout');
        cleanupUrl();
        if (wallet) {
          setState((prev) => ({ ...prev, tokens: wallet.token_balance }));
        }
        setPurchaseNotice('Tokens added to your wallet.');
        setPurchasePending(false);
        return;
      }
      if (!cancelled) {
        cleanupUrl();
        setPurchaseNotice(
          'If you completed payment, your balance will update shortly. You can reopen the Token Shop to refresh.'
        );
        setPurchasePending(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [supabaseEnabled, sbSession?.user?.id]);

  const handleSubmitUserAd = async (payload: {
    tierId: string;
    durationDays: number;
    title: string;
    subtitle: string;
    badgeLabel: string;
    imageUrl: string;
    imageDataUrl: string;
    backgroundColor: string;
    linkUrl: string;
    displayDurationSec: number;
  }): Promise<{ success: boolean; error?: string }> => {
    const settings = getMonetizationSettings();
    const tier = settings.userAdDurationTiers.find((t) => t.id === payload.tierId);
    if (!tier) return { success: false, error: 'Invalid ad option.' };
    const cost = tier.tokenCost;
    if (!deductTokens(cost)) return { success: false, error: 'Not enough tokens.' };

    if (supabaseEnabled && sbSession?.user?.id) {
      const ins = await insertUserAdSubmissionDb(sbSession.user.id, {
        durationDays: payload.durationDays,
        tokensPaid: cost,
        title: payload.title,
        subtitle: payload.subtitle,
        badgeLabel: payload.badgeLabel,
        imageUrl: payload.imageUrl,
        imageDataUrl: payload.imageDataUrl,
        backgroundColor: payload.backgroundColor,
        linkUrl: payload.linkUrl,
        displayDurationSec: payload.displayDurationSec,
      });
      if (ins.ok === false) {
        addTokens(cost);
        return { success: false, error: ins.error };
      }
      const refreshed = await fetchUserAdSubmissionsFromDb(sbSession.user.id);
      setCloudUserAdSubmissions(refreshed);
      setUserAdSubmissionsTick((t) => t + 1);
      return { success: true };
    }

    const r = adminStore.submitUserAdSubmission({
      ...payload,
      userId: state.currentUser.id,
      tokensPaid: cost,
    });
    if (r.ok === false) {
      addTokens(cost);
      return { success: false, error: r.error };
    }
    setUserAdSubmissionsTick((t) => t + 1);
    return { success: true };
  };

  const addEarnings = (amount: number) => {
    setState((prev) => {
      const newEarnings = (prev.currentUser.earnings || 0) + amount;
      adminStore.updateUser(prev.currentUser.id, { earnings: newEarnings });
      if (supabaseEnabled && sbSession?.user?.id === prev.currentUser.id) return prev;
      return { ...prev, currentUser: { ...prev.currentUser, earnings: newEarnings } };
    });
  };

  const handleCashOut = (amount: number) => {
    if (!state.currentUser) return;
    const id = state.currentUser.id;
    const newEarnings = (state.currentUser.earnings ?? 0) - amount;
    const newTransferredOut = (state.currentUser.transferredOut ?? 0) + amount;
    adminStore.updateUser(id, { earnings: newEarnings, transferredOut: newTransferredOut });
    if (supabaseEnabled && sbSession?.user?.id === id) {
      void cashOutWallet(sbSession.user.id, amount);
    }
    setState((prev) => ({
      ...prev,
      currentUser: { ...prev.currentUser, earnings: newEarnings, transferredOut: newTransferredOut },
    }));
  };

  const handleMainScroll = () => {
    setIsScrolling(true);
    if (scrollEndTimer) clearTimeout(scrollEndTimer);
    const timer = setTimeout(() => setIsScrolling(false), 180);
    setScrollEndTimer(timer);
  };
  
  if (!state.currentUser) {
    return (
      <div className="flex flex-col min-h-screen bg-white text-zinc-900 max-w-md mx-auto items-center justify-center">
        <div className="text-pink-500 text-4xl animate-bounce">❤</div>
        <p className="mt-4 font-bold tracking-widest uppercase">Loading Profile...</p>
      </div>
    );
  }

  const waitingSupabaseBootstrap =
    supabaseEnabled &&
    (!sbAuthResolved || (Boolean(sbSession?.user) && !sbProfileResolved));

  if (waitingSupabaseBootstrap) {
    return (
      <div className="flex flex-col min-h-screen bg-white text-zinc-900 max-w-md mx-auto items-center justify-center px-6 text-center">
        <div className="text-pink-500 text-4xl animate-bounce">❤</div>
        <p className="mt-4 font-bold tracking-widest uppercase">Signing you in…</p>
        <p className="mt-2 text-sm text-zinc-500">Loading your profile from the server</p>
      </div>
    );
  }

  if (failClosedSupabaseMisconfig) {
    return (
      <div className="flex flex-col min-h-screen bg-white text-zinc-900 max-w-md mx-auto items-center justify-center px-6 text-center">
        <div className="text-pink-500 text-4xl">!</div>
        <p className="mt-4 font-bold tracking-widest uppercase">Supabase Configuration Required</p>
        <p className="mt-2 text-sm text-zinc-500">
          This deployment is running in production mode and requires valid Supabase environment variables.
        </p>
      </div>
    );
  }

  if (underageNotice) {
    return (
      <div className="min-h-screen bg-zinc-950 flex justify-center">
        <div className="w-full max-w-md min-h-[100dvh] mx-auto relative overflow-hidden">
          <AgeGatePage
            blocked
            onSubmit={async () => undefined}
            onUnderage={() => undefined}
            onSignOut={() => setUnderageNotice(false)}
          />
        </div>
      </div>
    );
  }

  const showLanding = supabaseEnabled ? !sbSession : devLocalMockAuth ? !appSession : true;
  if (showLanding) {
    return (
      <div className="min-h-screen bg-white flex justify-center">
        <div className="w-full max-w-md min-h-[100dvh] mx-auto relative overflow-hidden">
          <LandingPage
            onEmailAuth={async (email, password, mode) => {
              if (!supabaseEnabled) {
                handleMockEmailAuth(email, password);
                return;
              }
              const sb = getSupabase();
              if (mode === 'signUp') {
                const { data, error } = await sb.auth.signUp({ email, password });
                if (error) {
                  trackFailure('auth', 'user_sign_up', error, { emailDomain: email.split('@')[1] || 'unknown' });
                  return { error: toUserSafeMessage(error) };
                }
                if (data.user && !data.session) {
                  return {
                    info: 'Check your email to confirm your account, then log in.',
                  };
                }
                return undefined;
              }
              const { error } = await sb.auth.signInWithPassword({ email, password });
              if (error) {
                trackFailure('auth', 'user_sign_in', error, { emailDomain: email.split('@')[1] || 'unknown' });
                return { error: toUserSafeMessage(error) };
              }
              return undefined;
            }}
            onAnonymousAuth={async () => {
              if (!supabaseEnabled) {
                handleMockAnonymousAuth();
                return;
              }
              const { error } = await getSupabase().auth.signInAnonymously();
              if (error) {
                trackFailure('auth', 'user_sign_in_anonymous', error, {});
                return { error: toUserSafeMessage(error) };
              }
              return undefined;
            }}
          />
        </div>
      </div>
    );
  }

  if (supabaseEnabled && !ageVerified) {
    return (
      <div className="min-h-screen bg-zinc-950 flex justify-center">
        <div className="w-full max-w-md min-h-[100dvh] mx-auto relative overflow-hidden">
          <AgeGatePage
            blocked={isDeviceMarkedUnderage()}
            onSubmit={handleBirthdateSubmit}
            onUnderage={handleUnderage}
            onSignOut={() => void handleAppLogout()}
          />
        </div>
      </div>
    );
  }

  const showGenderGate = supabaseEnabled ? !serverGender : devLocalMockAuth ? !appSession?.gender : false;
  if (showGenderGate) {
    return (
      <div className="min-h-screen bg-white flex justify-center">
        <div className="w-full max-w-md min-h-[100dvh] mx-auto relative overflow-hidden">
          <GenderSelectPage onSelect={(g) => void handleGenderSelect(g)} />
        </div>
      </div>
    );
  }

  const exploreGender: UserGender = supabaseEnabled ? serverGender! : appSession!.gender!;

  const isLiveView = state.currentView === View.LIVE_STREAM || state.currentView === View.HOST_LIVE;
  const isChatRoom = state.currentView === View.CHAT_ROOM;
  const isVideoCall = state.currentView === View.VIDEO_CALL;
  const fullBleedMain = isLiveView || isChatRoom || isVideoCall;
  const showNotificationBell =
    !fullBleedMain &&
    state.currentView !== View.USER_DETAIL &&
    state.currentView !== View.EXPLORE;

  const renderView = () => {
    switch (state.currentView) {
      case View.EXPLORE:
        return (
          <DiscoverView
            userGender={exploreGender}
            currentUserId={state.currentUser.id}
            currentUser={state.currentUser}
            tokens={state.tokens ?? 0}
            onGoShop={() => setView(View.TOKEN_SHOP)}
            onOpenProfile={() => setView(View.PROFILE)}
            onSelectUser={openUserDetail}
            onSelectLive={openLive}
            onGoLive={() => setView(View.HOST_LIVE)}
            exploreFilterOpenSignal={exploreFilterSignal}
            blockedUserIds={blockedUserIds}
            useRemoteHumanProfiles={supabaseEnabled}
            cloudHumanUsers={cloudDiscoverUsers}
            cloudDiscoverLoading={cloudDiscoverLoading}
            cloudDiscoverError={cloudDiscoverError}
            onReloadCloudDiscover={() => void loadCloudData()}
            cloudCarouselAds={cloudCarouselAds}
            useRemoteCarousel={supabaseEnabled}
          />
        );
      case View.FOLLOWING: {
        const blocked = new Set(blockedUserIds);
        const followingUsers = supabaseEnabled
          ? followingUsersCloud.filter((u) => !blocked.has(u.id))
          : getUsers().filter((u) => state.followingIds.includes(u.id) && !blocked.has(u.id));
        const badges = getBadges();
        return (
          <div className="min-h-full bg-white pb-24">
            <div className="px-4 pt-6 pb-4">
              <h1 className="text-xl font-bold text-zinc-900">People I&apos;m Following</h1>
            </div>
            {followingUsers.length > 0 ? (
              <div className="grid grid-cols-2 gap-0 w-full">
                {followingUsers.map((user) => (
                  <div
                    key={user.id}
                    onClick={() => openUserDetail(user)}
                    className="relative aspect-[3/4] overflow-hidden group cursor-pointer active:scale-[0.99] transition-transform"
                  >
                    <img
                      src={user.avatar}
                      alt={user.name}
                      className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                    />
                    <div className="absolute inset-0 bg-gradient-to-t from-black/75 via-transparent to-transparent" />
                    {user.isAI && (
                      <span className="absolute top-2 left-2 flex items-center gap-1 bg-black/40 backdrop-blur-md px-2 py-0.5 rounded-full text-[10px] font-semibold text-white">
                        <span className="text-xs">🤖</span> AI
                      </span>
                    )}
                    {user.isLive && (
                      <div className="absolute top-2 left-2 flex items-center gap-1.5 bg-red-500/90 backdrop-blur-md px-2.5 py-1 rounded-md text-[10px] font-bold text-white animate-pulse">
                        <span className="w-1.5 h-1.5 bg-white rounded-full" /> LIVE
                      </div>
                    )}
                    {!user.isAI && !user.isLive && (
                      <span className="absolute top-2 left-2 bg-white/25 backdrop-blur-md px-2 py-1 rounded-full text-[10px] font-semibold text-white shadow-sm">
                        {user.interests?.[0] || 'New'}
                      </span>
                    )}
                    {user.badgeTier && user.badgeTier !== 'none' && (
                      <div className="absolute top-2 right-2 text-[22px] drop-shadow-md" title={badges.find(b => b.id === user.badgeTier)?.name}>
                        {badges.find(b => b.id === user.badgeTier)?.icon}
                      </div>
                    )}
                    <div className="absolute bottom-3 left-3 right-3">
                      <h3 className="text-[0.91875rem] font-bold text-white drop-shadow-md">{user.name}, {user.age}</h3>
                      <p className="text-[10px] text-white/90 truncate drop-shadow-md mt-0.5">
                        {user.isAI ? 'AI Companion' : (user.isLive ? 'Tap to watch live' : `${user.distance} miles away`)}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <p className="px-4 text-sm text-zinc-500 mt-2">When you follow someone, they&apos;ll appear here.</p>
            )}
          </div>
        );
      }
      case View.CHATS:
        return (
          <ChatListView
            matches={state.matches || []}
            onChatSelect={openChat}
            inboxRows={
              supabaseEnabled
                ? inboxSummaries.map(
                    (s): ChatInboxRow => ({
                      user: s.partner,
                      preview: s.preview,
                      at: s.at,
                    })
                  )
                : undefined
            }
          />
        );
      case View.CHAT_ROOM:
        return state.selectedChatPartner ? (
          <ChatRoomView
            partner={state.selectedChatPartner}
            selfUserId={state.currentUser.id}
            cloudChat={
              supabaseEnabled &&
              activeCloudConversationId &&
              !state.selectedChatPartner.isAI
                ? { conversationId: activeCloudConversationId, partnerIsAi: false }
                : undefined
            }
            onBack={() => {
              setChatThreadError(null);
              setView(View.CHATS);
            }}
            threadSetupError={chatThreadError}
            onDismissThreadSetupError={() => setChatThreadError(null)}
            onVideoCall={() => setView(View.VIDEO_CALL)}
            onAudioCall={() => {
              const cost = getMonetizationSettings().videoCallTokens;
              if (!deductTokens(cost)) return;
              window.alert(`Calling ${state.selectedChatPartner!.name} — audio…`);
            }}
            onViewProfile={() => openUserDetail(state.selectedChatPartner!)}
            deductTokens={deductTokens}
            uploadChatMedia={
              supabaseEnabled && sbSession?.user?.id
                ? (blob, mime) => uploadChatMediaToStorage(sbSession.user.id, blob, mime)
                : undefined
            }
            onGiftRecorded={
              supabaseEnabled && sbSession?.user?.id
                ? (gift, partnerId) => {
                    void recordGiftEvent(sbSession.user.id, partnerId, {
                      id: gift.id,
                      name: gift.name,
                      value: gift.value,
                    });
                  }
                : undefined
            }
          />
        ) : null;
      case View.VIDEO_CALL:
        return state.selectedChatPartner ? (
          <VideoCallView 
            partner={state.selectedChatPartner} 
            onEnd={() => setView(View.CHAT_ROOM)} 
            deductTokens={deductTokens}
            tokens={state.tokens!}
          />
        ) : null;
      case View.LIVE_STREAM: {
        const streamHost = state.selectedLiveHost || getUsers()[0];
        const participants = state.liveStreamParticipants?.length
          ? state.liveStreamParticipants
          : [streamHost];
        return (
          <LiveStreamView 
            host={streamHost}
            participants={participants}
            broadcastMedia={
              streamHost.id === state.currentUser.id
                ? (state.liveHostBroadcastMedia ?? { micOn: true, camOn: true })
                : { micOn: true, camOn: true }
            }
            onEnd={() =>
              setState((prev) => ({
                ...prev,
                currentView: View.EXPLORE,
                liveStreamParticipants: undefined,
                selectedLiveHost: undefined,
              }))
            }
            deductTokens={deductTokens}
            onViewProfile={(user) => openUserDetail(user)}
            onSwitchMain={(user) => {
              const idx = participants.findIndex(p => p.id === user.id);
              if (idx >= 0) {
                const reordered = [participants[idx], ...participants.filter((_, i) => i !== idx)];
                setState(prev => ({ ...prev, liveStreamParticipants: reordered }));
              }
            }}
          />
        );
      }
      case View.HOST_LIVE: {
        const hostUser = state.currentUser;
        const participants = state.liveStreamParticipants?.length
          ? state.liveStreamParticipants
          : [hostUser];
        return (
          <LiveStreamView 
            isHost 
            host={hostUser} 
            participants={participants}
            broadcastMedia={state.liveHostBroadcastMedia ?? { micOn: true, camOn: true }}
            onBroadcastMediaChange={(next) =>
              setState((prev) => ({ ...prev, liveHostBroadcastMedia: next }))
            }
            onEnd={() =>
              setState((prev) => ({
                ...prev,
                currentView: View.EXPLORE,
                liveStreamParticipants: undefined,
                liveHostBroadcastMedia: undefined,
              }))
            }
            deductTokens={deductTokens} 
            onReceiveGift={addEarnings}
            onAddGuest={(user) => {
              const current = state.liveStreamParticipants || [hostUser];
              if (current.length < 4 && !current.find(p => p.id === user.id)) {
                setState(prev => ({
                  ...prev,
                  liveStreamParticipants: [...(prev.liveStreamParticipants || [hostUser]), user]
                }));
              }
            }}
            onSwitchMain={(user) => {
              const current = state.liveStreamParticipants || [hostUser];
              const idx = current.findIndex(p => p.id === user.id);
              if (idx >= 0) {
                const reordered = [current[idx], ...current.filter((_, i) => i !== idx)];
                setState(prev => ({ ...prev, liveStreamParticipants: reordered }));
              }
            }}
            onRemoveGuest={(user) => {
              if (user.id === hostUser.id) return;
              setState((prev) => {
                const current = prev.liveStreamParticipants || [hostUser];
                const next = current.filter((p) => p.id !== user.id);
                if (next.length === 0) return { ...prev, liveStreamParticipants: [hostUser] };
                return { ...prev, liveStreamParticipants: next };
              });
            }}
          />
        );
      }
      case View.TOKEN_SHOP:
        return (
          <TokenShopView
            onBack={() => setView(View.EXPLORE)}
            currentTokens={state.tokens!}
            onPurchase={purchaseTokenPackage}
            purchasePending={purchasePending}
            purchaseNotice={purchaseNotice}
            packages={supabaseEnabled ? cloudTokenPackages : undefined}
            isNativeCheckout={isNativeApp()}
            paymentMethods={supabaseEnabled ? getWebPaymentMethods() : undefined}
          />
        );
      case View.PROFILE:
        return (
          <ProfileView
            user={state.currentUser}
            tokens={state.tokens}
            onGoShop={() => setView(View.TOKEN_SHOP)}
            onUpdateAlbum={handleUpdateAlbum}
            onUpdateProfile={handleUpdateProfile}
            onPurchaseBadge={handlePurchaseBadge}
            cloudAccountActive={supabaseEnabled}
            onLogout={() => void handleAppLogout()}
            onNavigateToExploreFilters={() => {
              setExploreFilterSignal((n) => n + 1);
              setView(View.EXPLORE);
            }}
            onPreferencesChanged={() => {
              setBlockedUserIds([...getPrivacyPreferences().blockedUserIds]);
              setPrefsTick((t) => t + 1);
            }}
            onSubmitUserAd={handleSubmitUserAd}
            userAdSubmissions={userAdSubmissions}
            onUnblockUser={handleUnblockUser}
            onDeleteAccount={supabaseEnabled ? handleDeleteAccount : undefined}
          />
        );
      case View.USER_DETAIL:
        return state.selectedUserForDetail ? (
          <UserDetailView 
            user={state.selectedUserForDetail} 
            onBack={() => setView(state.profileReturnView ?? View.EXPLORE)} 
            onChat={openChat} 
            onLive={openLive}
            deductTokens={deductTokens}
            onGoToTokenShop={() => setView(View.TOKEN_SHOP)}
            isFollowing={state.followingIds.includes(state.selectedUserForDetail.id)}
            onFollowToggle={() => toggleFollow(state.selectedUserForDetail!.id)}
            onFollowUser={ensureFollowing}
            onSuperLikeSuccess={(recipient) => {
              if (supabaseEnabled && sbSession?.user?.id) {
                void insertSuperLikeNotificationDb(recipient.id, {
                  id: state.currentUser.id,
                  name: state.currentUser.name,
                  avatar: state.currentUser.avatar,
                });
              } else {
                addSuperLikeNotification(recipient.id, {
                  id: state.currentUser.id,
                  name: state.currentUser.name,
                  avatar: state.currentUser.avatar,
                });
              }
            }}
            onReport={(u) => setReportTarget({ id: u.id, name: u.name, context: 'profile' })}
            onBlock={(u) => blockUserAndLeaveProfile(u.id)}
          />
        ) : null;
      case View.CASH_OUT:
        return <CashOutView earnings={state.currentUser?.earnings || 0} onBack={() => {
          setState(prev => ({ ...prev, currentView: View.EXPLORE }));
          setIsHomeMenuOpen(true);
        }} onConfirmCashOut={handleCashOut} />;
      default:
        return (
          <DiscoverView
            userGender={exploreGender}
            currentUserId={state.currentUser.id}
            currentUser={state.currentUser}
            tokens={state.tokens ?? 0}
            onGoShop={() => setView(View.TOKEN_SHOP)}
            onOpenProfile={() => setView(View.PROFILE)}
            onSelectUser={openUserDetail}
            onSelectLive={openLive}
            onGoLive={() => setView(View.HOST_LIVE)}
            exploreFilterOpenSignal={exploreFilterSignal}
            blockedUserIds={blockedUserIds}
            useRemoteHumanProfiles={supabaseEnabled}
            cloudHumanUsers={cloudDiscoverUsers}
            cloudDiscoverLoading={cloudDiscoverLoading}
            cloudDiscoverError={cloudDiscoverError}
            onReloadCloudDiscover={() => void loadCloudData()}
            cloudCarouselAds={cloudCarouselAds}
            useRemoteCarousel={supabaseEnabled}
          />
        );
    }
  };

  return (
    <div className="flex flex-col min-h-screen bg-white text-zinc-900 max-w-md mx-auto relative border-x border-zinc-200 shadow-2xl overflow-hidden">
      {superLikeToast ? (
        <div
          className="pointer-events-none fixed left-1/2 top-[max(0.75rem,env(safe-area-inset-top))] z-[80] w-full max-w-md -translate-x-1/2 px-4 animate-in fade-in slide-in-from-top duration-300"
          role="status"
        >
          <div className="rounded-2xl border border-pink-300/80 bg-gradient-to-r from-pink-600 to-rose-600 px-4 py-3 text-center text-sm font-bold text-white shadow-lg">
            {superLikeToast}
          </div>
        </div>
      ) : null}
      <main
        className={`flex-1 min-h-0 ${fullBleedMain ? 'relative flex flex-col min-h-[100dvh] h-[100dvh] overflow-hidden' : 'overflow-y-auto pb-28'}`}
        onScroll={handleMainScroll}
      >
        {renderView()}
      </main>

      {showNotificationBell ? (
        <NotificationBell
          notifications={profileInAppNotifications}
          unreadCount={notifUnreadCount}
          isOpen={notifPanelOpen}
          onToggle={handleNotifBellToggle}
        />
      ) : null}

      <Navbar
        currentView={state.currentView}
        setView={setView}
        tokenCount={state.tokens}
        liveStreamingEnabled={getMonetizationSettings().liveStreamingEnabled}
        hidden={isScrolling || isLiveView || isChatRoom || isVideoCall}
        viewerGender={exploreGender}
      />

      {reportTarget ? (
        <ReportUserSheet
          key={reportTarget.id}
          userName={reportTarget.name}
          onClose={() => setReportTarget(null)}
          onSubmit={handleSubmitReport}
        />
      ) : null}
    </div>
  );
};

export default App;
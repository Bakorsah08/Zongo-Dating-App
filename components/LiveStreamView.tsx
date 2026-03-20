import React, { useState, useEffect, useRef, useCallback } from 'react';
import { getGifts, getUsers, getMonetizationSettings } from '../data';
import { User, Gift } from '../types';

interface Particle {
  id: number;
  emoji: string;
  left: string;
  drift: string;
}

interface ChatLine {
  user: string;
  text: string;
  isGift?: boolean;
  avatar?: string;
  /** Real profile id when this line is from a known user (viewers in chat). */
  userId?: string;
}

interface LiveBroadcastMedia {
  micOn: boolean;
  camOn: boolean;
}

interface LiveStreamViewProps {
  host: User;
  participants?: User[];
  onEnd: () => void;
  deductTokens: (amount: number) => boolean;
  isHost?: boolean;
  onReceiveGift?: (amount: number) => void;
  onViewProfile?: (user: User) => void;
  onAddGuest?: (user: User) => void;
  onRemoveGuest?: (user: User) => void;
  onSwitchMain?: (user: User) => void;
  /** Stream host mic/camera — drives viewer overlays and host track.enabled */
  broadcastMedia?: LiveBroadcastMedia;
  onBroadcastMediaChange?: (next: LiveBroadcastMedia) => void;
}

function messageForMediaError(err: unknown): string {
  if (err instanceof DOMException) {
    switch (err.name) {
      case 'NotAllowedError':
      case 'PermissionDeniedError':
        return 'Permission was denied. Use the lock or camera icon in the address bar → Site settings → allow Camera and Microphone, then tap Try again.';
      case 'NotFoundError':
      case 'DevicesNotFoundError':
        return 'No camera or microphone was detected. Connect a device or turn the camera on in Windows / Mac settings.';
      case 'NotReadableError':
      case 'TrackStartError':
        return 'Camera or mic is already in use (another tab, app, or virtual camera). Close those, then tap Try again.';
      case 'OverconstrainedError':
        return 'This device could not open the camera with the requested settings. Try another browser or disable virtual cameras.';
      case 'SecurityError':
        return 'Camera only works on a secure page. Use https:// or open the app at http://localhost (not a raw file or LAN IP over http).';
      case 'AbortError':
        return 'The request was interrupted. Tap Try again.';
      default:
        break;
    }
  }
  return 'Could not open camera or microphone. Check browser and system privacy settings, then tap Try again.';
}

function formatEngagementCount(n: number): string {
  if (!Number.isFinite(n) || n < 0) return '0';
  if (n >= 1_000_000) {
    const v = n / 1_000_000;
    return v >= 10 ? `${Math.round(v)}M` : `${parseFloat(v.toFixed(1))}M`;
  }
  if (n >= 1_000) {
    const v = n / 1_000;
    return v >= 100 ? `${Math.round(v)}K` : `${parseFloat(v.toFixed(1))}K`;
  }
  return String(Math.floor(n));
}

const avatarForUsername = (name: string) =>
  `https://picsum.photos/seed/${encodeURIComponent(name)}/64/64`;

const EyeIcon = ({ className }: { className?: string }) => (
  <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
    <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
    <circle cx="12" cy="12" r="3" />
  </svg>
);

const HeartOutlineIcon = ({ className }: { className?: string }) => (
  <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
    <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z" />
  </svg>
);

const SendIcon = ({ className }: { className?: string }) => (
  <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
    <line x1="22" y1="2" x2="11" y2="13" />
    <polygon points="22 2 15 22 11 13 2 9 22 2" />
  </svg>
);

const MicIcon = ({ className, off }: { className?: string; off?: boolean }) => (
  <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
    <path d="M12 2a3 3 0 0 0-3 3v7a3 3 0 0 0 6 0V5a3 3 0 0 0-3-3Z" />
    <path d="M19 10v1a7 7 0 0 1-14 0v-1" />
    <line x1="12" y1="19" x2="12" y2="22" />
    <line x1="8" y1="22" x2="16" y2="22" />
    {off && <line x1="2" y1="2" x2="22" y2="22" strokeWidth="2.5" />}
  </svg>
);

const CamIcon = ({ className, off }: { className?: string; off?: boolean }) => (
  <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
    <path d="M23 7l-7 5 7 5V7z" />
    <rect x="1" y="5" width="15" height="14" rx="2" ry="2" />
    {off && <line x1="2" y1="2" x2="22" y2="22" strokeWidth="2.5" />}
  </svg>
);

const LiveStreamView: React.FC<LiveStreamViewProps> = ({
  host,
  participants: participantsProp,
  onEnd,
  deductTokens,
  isHost,
  onReceiveGift,
  onViewProfile,
  onAddGuest,
  onRemoveGuest,
  onSwitchMain,
  broadcastMedia: broadcastMediaProp,
  onBroadcastMediaChange,
}) => {
  const participants = participantsProp && participantsProp.length > 0 ? participantsProp : [host];
  const mainUser = participants[0];
  const MAX_GUESTS = 3;
  const panes = participants.slice(1, 1 + MAX_GUESTS);
  const broadcast = broadcastMediaProp ?? { micOn: true, camOn: true };
  const canAddMore = isHost && participants.length < 1 + MAX_GUESTS;
  const [hasJoined, setHasJoined] = useState(isHost || false);
  const [viewerCount, setViewerCount] = useState(
    isHost ? 0 : host.viewerCount || Math.floor(Math.random() * 500) + 100
  );
  const [likeCount, setLikeCount] = useState(isHost ? 0 : Math.floor(Math.random() * 2000) + 500);
  const [hostEarnings, setHostEarnings] = useState(host.earnings || 0);
  const [comments, setComments] = useState<ChatLine[]>([]);
  const [showGiftSelector, setShowGiftSelector] = useState(false);
  const [showAddGuest, setShowAddGuest] = useState(false);
  const [messageInput, setMessageInput] = useState('');
  const [particles, setParticles] = useState<Particle[]>([]);
  const [hostMediaStream, setHostMediaStream] = useState<MediaStream | null>(null);
  const [hostMediaError, setHostMediaError] = useState<string | null>(null);
  const [hostMediaRequesting, setHostMediaRequesting] = useState(false);
  const [hostPreviewDismissed, setHostPreviewDismissed] = useState(false);
  const videoRef = useRef<HTMLVideoElement>(null);
  const previewVideoRef = useRef<HTMLVideoElement>(null);
  const chatScrollRef = useRef<HTMLDivElement>(null);
  /** Viewers only: hide guest strip to focus on host; swipe right to hide, left to show. */
  const [viewerGuestsHidden, setViewerGuestsHidden] = useState(false);
  const guestRailSwipeRef = useRef<{
    pointerId: number;
    startX: number;
    startY: number;
    startedHorizontal: boolean;
    wasHidden: boolean;
    startedOnHandle: boolean;
  } | null>(null);
  const suppressGuestHandleClickRef = useRef(false);

  const viewerCanSwipeGuests = !isHost && panes.length > 0;
  const guestsReserveChatSpace = panes.length > 0 && (!viewerCanSwipeGuests || !viewerGuestsHidden);
  /** Keeps the hide handle at the same vertical band when guests are collapsed (flex row would shrink to 4.5rem otherwise). */
  const viewerGuestRailMinHeight =
    viewerCanSwipeGuests && panes.length > 0
      ? (`calc(${panes.length} * (min(30vw, 7rem) * 1.5) + ${(panes.length - 1) * 0.5}rem)` as const)
      : undefined;

  const startHostCapture = useCallback(async () => {
    if (!navigator.mediaDevices?.getUserMedia) {
      setHostMediaError(
        'Camera is not available in this context. Use HTTPS or localhost, or try Chrome or Safari.'
      );
      return;
    }
    setHostMediaError(null);
    setHostMediaRequesting(true);
    try {
      const s = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'user' },
        audio: true,
      });
      setHostMediaStream((prev) => {
        prev?.getTracks().forEach((t) => t.stop());
        return s;
      });
    } catch (err) {
      setHostMediaError(messageForMediaError(err));
    } finally {
      setHostMediaRequesting(false);
    }
  }, []);

  const spawnParticle = (emoji: string) => {
    const id = Date.now() + Math.random();
    const drift = `${Math.random() * 100 - 50}px`;
    const left = `${Math.random() * 25 + 70}%`;
    setParticles((prev) => [...prev, { id, emoji, left, drift }]);
    setTimeout(() => {
      setParticles((prev) => prev.filter((p) => p.id !== id));
    }, 1500);
  };

  useEffect(() => {
    if (hasJoined && chatScrollRef.current) {
      chatScrollRef.current.scrollTop = chatScrollRef.current.scrollHeight;
    }
  }, [comments, hasJoined]);

  useEffect(() => {
    if (!hasJoined) return;
    if (isHost && mainUser.id === host.id && !hostPreviewDismissed) return;

    const interval = setInterval(() => {
        const candidatePool = getUsers().filter(
          (u) => u.id !== host.id && !participants.some((p) => p.id === u.id)
        );
        if (candidatePool.length === 0) return;

        const chatter = candidatePool[Math.floor(Math.random() * candidatePool.length)];
        const chatTemplates = [
          'Looking great tonight!',
          'Hiii everyone!',
          'Send some hearts!',
          'This is vibes ✨',
          'Are you from around here?',
          'Keep it up!',
          'Gorgeous!',
        ];
        const text = chatTemplates[Math.floor(Math.random() * chatTemplates.length)];
        setComments((prev) => [
          ...prev.slice(-19),
          {
            user: chatter.name,
            text,
            avatar: chatter.avatar,
            userId: chatter.id,
          },
        ]);

        setViewerCount((prev) => prev + Math.floor(Math.random() * 10) - 2);
        setLikeCount((prev) => prev + Math.floor(Math.random() * 20) + 5);

        if (isHost && Math.random() > 0.85) {
          const gifts = getGifts();
          const randomGift = gifts[Math.floor(Math.random() * Math.min(3, gifts.length))];
          if (randomGift) {
            const giftFrom = candidatePool[Math.floor(Math.random() * candidatePool.length)];
            setHostEarnings((prev) => prev + randomGift.value);
            setComments((prev) => [
              ...prev.slice(-19),
              {
                user: giftFrom.name,
                text: `sent a ${randomGift.name} ${randomGift.icon}`,
                isGift: true,
                avatar: giftFrom.avatar,
                userId: giftFrom.id,
              },
            ]);
            spawnParticle(randomGift.icon);
            onReceiveGift?.(randomGift.value);
          }
        }
      }, isHost ? 2000 : 3000);

    return () => clearInterval(interval);
  }, [hasJoined, isHost, onReceiveGift, mainUser.id, host.id, hostPreviewDismissed, participants]);

  useEffect(() => {
    if (!isHost || !hasJoined || mainUser.id !== host.id) {
      setHostMediaStream((prev) => {
        prev?.getTracks().forEach((t) => t.stop());
        return null;
      });
      setHostMediaError(null);
      setHostMediaRequesting(false);
      setHostPreviewDismissed(false);
    }

    return () => {
      setHostMediaStream((prev) => {
        prev?.getTracks().forEach((t) => t.stop());
        return null;
      });
    };
  }, [isHost, hasJoined, mainUser.id, host.id]);

  useEffect(() => {
    const attach = (el: HTMLVideoElement | null) => {
      if (!el) return;
      if (hostMediaStream) {
        el.srcObject = hostMediaStream;
        el.play().catch(() => {});
      } else {
        el.srcObject = null;
      }
    };
    attach(videoRef.current);
    attach(previewVideoRef.current);
  }, [hostMediaStream, hostPreviewDismissed]);

  useEffect(() => {
    if (!isHost || !hostMediaStream) return;
    hostMediaStream.getVideoTracks().forEach((t) => {
      t.enabled = broadcast.camOn;
    });
    hostMediaStream.getAudioTracks().forEach((t) => {
      t.enabled = broadcast.micOn;
    });
  }, [isHost, hostMediaStream, broadcast.camOn, broadcast.micOn]);

  const liveEntryCost = getMonetizationSettings().liveStreamEntryTokens;
  const giftingEnabled = getMonetizationSettings().giftingEnabled;
  const viewerGifts = getGifts();
  const showViewerGiftStrip = !isHost && giftingEnabled && viewerGifts.length > 0;

  const handleJoin = () => {
    if (deductTokens(liveEntryCost)) {
      setHasJoined(true);
    }
  };

  const handleSendMessage = () => {
    if (!messageInput.trim()) return;
    setComments((prev) => [
      ...prev.slice(-19),
      { user: 'You', text: messageInput, avatar: avatarForUsername('You') },
    ]);
    setMessageInput('');
  };

  const handleSendGift = (gift: Gift) => {
    if (deductTokens(gift.value)) {
      setHostEarnings((prev) => prev + gift.value);
      setComments((prev) => [
        ...prev.slice(-19),
        {
          user: 'You',
          text: `sent a ${gift.name} ${gift.icon}`,
          isGift: true,
          avatar: avatarForUsername('You'),
        },
      ]);
      spawnParticle(gift.icon);
      setShowGiftSelector(false);
    }
  };

  const handleHypeBoost = () => {
    setLikeCount((prev) => prev + 10);
    spawnParticle('🔥');
  };

  const handleLikeTap = () => {
    setLikeCount((prev) => prev + 1);
    spawnParticle('❤️');
  };

  useEffect(() => {
    if (panes.length === 0) setViewerGuestsHidden(false);
  }, [panes.length]);

  const onGuestRailPointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!viewerCanSwipeGuests) return;
    const el = e.target as HTMLElement | null;
    guestRailSwipeRef.current = {
      pointerId: e.pointerId,
      startX: e.clientX,
      startY: e.clientY,
      startedHorizontal: false,
      wasHidden: viewerGuestsHidden,
      startedOnHandle: Boolean(el?.closest?.('[data-guest-rail-handle]')),
    };
  };

  const onGuestRailPointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    const s = guestRailSwipeRef.current;
    if (!s || s.pointerId !== e.pointerId) return;
    const dx = e.clientX - s.startX;
    const dy = e.clientY - s.startY;
    if (!s.startedHorizontal && Math.abs(dx) > 14 && Math.abs(dx) > Math.abs(dy) * 1.15) {
      s.startedHorizontal = true;
      try {
        e.currentTarget.setPointerCapture(e.pointerId);
      } catch {
        /* ignore */
      }
    }
  };

  const onGuestRailPointerUp = (e: React.PointerEvent<HTMLDivElement>) => {
    const s = guestRailSwipeRef.current;
    if (!s || s.pointerId !== e.pointerId) return;
    const dx = e.clientX - s.startX;
    try {
      if (e.currentTarget.hasPointerCapture(e.pointerId)) {
        e.currentTarget.releasePointerCapture(e.pointerId);
      }
    } catch {
      /* ignore */
    }
    guestRailSwipeRef.current = null;
    if (!viewerCanSwipeGuests || !s.startedHorizontal) return;
    const TH = 40;
    if (!s.wasHidden && dx > TH) {
      setViewerGuestsHidden(true);
      if (s.startedOnHandle) suppressGuestHandleClickRef.current = true;
    } else if (s.wasHidden && dx < -TH) {
      setViewerGuestsHidden(false);
      if (s.startedOnHandle) suppressGuestHandleClickRef.current = true;
    }
  };

  const onGuestRailLostPointerCapture = (e: React.PointerEvent<HTMLDivElement>) => {
    if (guestRailSwipeRef.current?.pointerId === e.pointerId) {
      guestRailSwipeRef.current = null;
    }
  };

  const onGuestHandleClick = () => {
    if (suppressGuestHandleClickRef.current) {
      suppressGuestHandleClickRef.current = false;
      return;
    }
    setViewerGuestsHidden((h) => !h);
  };

  if (!hasJoined) {
    return (
      <div className="min-h-[100dvh] h-[100dvh] w-full flex flex-col items-center justify-center bg-black text-white relative overflow-hidden">
        <img src={host.avatar} className="absolute inset-0 w-full h-full object-cover blur-2xl opacity-40 scale-110" alt="" />
        <div className="absolute inset-0 bg-black/50" />
        <div className="relative z-10 w-full max-w-sm px-6 flex flex-col items-center gap-5">
          <div className="relative">
            <img
              src={host.avatar}
              className="w-24 h-24 rounded-full border-4 border-white/30 shadow-2xl object-cover"
              alt={host.name}
            />
            <div className="absolute -bottom-1 left-1/2 -translate-x-1/2 bg-red-600 px-2.5 py-0.5 rounded-md text-[10px] font-black tracking-wide">
              LIVE
            </div>
          </div>
          <div className="text-center space-y-2">
            <h2 className="text-2xl font-bold">Watch {host.name}&apos;s stream</h2>
            <div className="inline-flex items-center gap-2 bg-black/45 backdrop-blur-md px-3 py-1.5 rounded-full text-xs font-bold border border-white/10">
              <EyeIcon className="w-3.5 h-3.5" />
              <span>{viewerCount.toLocaleString()} watching</span>
            </div>
          </div>
          <p className="text-zinc-300 text-sm text-center leading-relaxed">
            Join {host.name}&apos;s live — chat with other viewers in real time.
          </p>
          <div className="w-full bg-zinc-900/80 backdrop-blur-md p-4 rounded-2xl border border-white/10">
            <div className="flex justify-between items-center mb-3">
              <span className="text-zinc-400 text-xs font-bold uppercase tracking-widest">Entry</span>
              <span className="font-black text-pink-400 flex items-center gap-1">💎 {liveEntryCost}</span>
            </div>
            <button
              type="button"
              onClick={handleJoin}
              className="w-full gradient-pink py-3.5 rounded-xl font-bold text-white shadow-lg shadow-pink-900/40 active:scale-[0.98] transition-transform"
            >
              Join live
            </button>
            <button type="button" onClick={onEnd} className="w-full mt-3 text-zinc-500 text-sm py-2">
              Maybe later
            </button>
          </div>
        </div>
      </div>
    );
  }

  const bottomSafe = 'pb-[max(1rem,env(safe-area-inset-bottom))]';
  const showHostSetupOverlay =
    Boolean(isHost && hasJoined && mainUser.id === host.id && !hostPreviewDismissed);
  const streamingHudVisible =
    !isHost || mainUser.id !== host.id || hostPreviewDismissed;

  return (
    <div className={`relative w-full min-h-[100dvh] h-[100dvh] bg-black text-white overflow-hidden flex flex-col ${bottomSafe}`}>
      {streamingHudVisible &&
        particles.map((p) => (
        <span
          key={p.id}
          className="absolute z-[60] text-3xl pointer-events-none animate-hype"
          style={
            {
              left: p.left,
              bottom: '180px',
              '--drift': p.drift,
            } as React.CSSProperties
          }
        >
          {p.emoji}
        </span>
        ))}

      {/* Full-bleed video / image */}
      <div className="absolute inset-0">
        {isHost && mainUser.id === host.id ? (
          <video
            ref={videoRef}
            poster={mainUser.avatar}
            autoPlay
            muted
            playsInline
            className={`w-full h-full object-cover scale-x-[-1] bg-black ${showHostSetupOverlay ? 'opacity-0' : 'opacity-100'}`}
          />
        ) : (
          <img src={mainUser.avatar} className="w-full h-full object-cover" alt={mainUser.name} />
        )}
        {streamingHudVisible && !broadcast.camOn && mainUser.id === host.id && (
          <div className="pointer-events-none absolute inset-0 z-[18]">
            <img src={host.avatar} alt="" className="absolute inset-0 h-full w-full object-cover" />
            <div className="absolute inset-0 bg-black/50" />
            <div className="absolute inset-0 flex items-center justify-center px-6">
              <p className="text-center text-xl font-semibold leading-tight text-white drop-shadow-[0_2px_16px_rgba(0,0,0,0.85)] sm:text-2xl">
                Will be right back
              </p>
            </div>
          </div>
        )}
        {streamingHudVisible && (
          <>
            <div className="absolute inset-0 bg-gradient-to-b from-black/55 via-transparent to-black/70 pointer-events-none" />
            <button
              type="button"
              aria-label="Like stream"
              tabIndex={-1}
              onClick={handleLikeTap}
              className="absolute inset-0 z-[1] bg-transparent border-0 p-0 touch-manipulation cursor-default"
            />
          </>
        )}
      </div>

      {/* Host setup: permission + preview only — no live HUD until Go live (light theme) */}
      {showHostSetupOverlay && (
        <div className="absolute inset-0 z-[70] flex flex-col bg-zinc-100">
          <div className="flex justify-end shrink-0 pt-[max(0.75rem,env(safe-area-inset-top))] px-3 pb-2">
            <button
              type="button"
              onClick={onEnd}
              className="flex h-10 w-10 items-center justify-center rounded-full text-2xl font-light leading-none text-zinc-500 transition-colors hover:bg-zinc-200/80 hover:text-zinc-800 active:scale-95"
              aria-label="Close"
            >
              ×
            </button>
          </div>
          <div className="flex min-h-0 flex-1 items-center justify-center px-5 pb-8">
            <div className="w-full max-w-sm rounded-2xl border border-zinc-200/90 bg-white px-5 py-6 text-center shadow-[0_8px_40px_-12px_rgba(0,0,0,0.12)]">
              <div className="relative mx-auto mb-4 aspect-[9/16] w-full max-h-[min(42vh,320px)] overflow-hidden rounded-xl border-2 border-zinc-200 bg-zinc-100 shadow-inner ring-1 ring-zinc-100">
                {hostMediaStream ? (
                  <video
                    ref={previewVideoRef}
                    autoPlay
                    muted
                    playsInline
                    className="absolute inset-0 h-full w-full object-cover scale-x-[-1]"
                  />
                ) : (
                  <img src={mainUser.avatar} alt="" className="absolute inset-0 h-full w-full object-cover" />
                )}
                {hostMediaRequesting && (
                  <div className="absolute inset-0 flex items-center justify-center bg-white/75 backdrop-blur-[2px]">
                    <p className="text-sm font-semibold text-zinc-800">Connecting…</p>
                  </div>
                )}
              </div>
              <p className="mb-2 text-xs font-bold uppercase tracking-widest text-pink-600">Your preview</p>
              <p className="mb-5 text-sm leading-relaxed text-zinc-600">
                {hostMediaStream
                  ? 'This is what viewers see (mirrored like your front camera). Tap below when you’re ready to broadcast.'
                  : hostMediaRequesting
                    ? 'Opening camera and microphone…'
                    : 'Your profile photo fills the frame until the camera is on. Allow access so viewers can see and hear you live.'}
              </p>
              {hostMediaError && !hostMediaRequesting && (
                <p className="mb-4 text-sm leading-snug text-amber-800">{hostMediaError}</p>
              )}
              {hostMediaStream ? (
                <button
                  type="button"
                  onClick={() => setHostPreviewDismissed(true)}
                  className="w-full rounded-xl bg-gradient-to-r from-pink-500 to-rose-500 py-3.5 font-bold text-white shadow-md shadow-pink-500/25 transition-transform active:scale-[0.98]"
                >
                  Go live
                </button>
              ) : (
                <button
                  type="button"
                  onClick={startHostCapture}
                  disabled={hostMediaRequesting}
                  className="w-full rounded-xl bg-gradient-to-r from-pink-500 to-rose-500 py-3.5 font-bold text-white shadow-md shadow-pink-500/25 transition-transform active:scale-[0.98] disabled:scale-100 disabled:opacity-60"
                >
                  {hostMediaRequesting ? 'Please wait…' : hostMediaError ? 'Try again' : 'Allow camera & microphone'}
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Top bar — host avatar (replaces LIVE pill) + viewers + close */}
      {streamingHudVisible && (
      <header className="relative z-30 flex items-center justify-between gap-3 pt-[max(0.75rem,env(safe-area-inset-top))] pb-1 px-3">
        <div className="flex items-center gap-2 min-w-0">
          <button
            type="button"
            onClick={() => !isHost && onViewProfile?.(mainUser)}
            className={`relative shrink-0 ${!isHost && onViewProfile ? 'cursor-pointer active:scale-95' : 'cursor-default'}`}
            aria-label={!isHost ? `View ${mainUser.name}` : 'Host'}
          >
            <img
              src={mainUser.avatar}
              alt=""
              className="w-11 h-11 rounded-full object-cover border-2 border-white/90 shadow-lg"
            />
            <div className="absolute -bottom-0.5 left-1/2 -translate-x-1/2 bg-red-600 px-1.5 py-0.5 rounded text-[8px] font-black tracking-wide text-white shadow-md whitespace-nowrap leading-none">
              LIVE
            </div>
            {!isHost && onViewProfile && (
              <span className="absolute -top-0.5 -right-0.5 w-5 h-5 rounded-full bg-white text-black text-sm font-bold flex items-center justify-center border border-black/20 shadow">
                +
              </span>
            )}
          </button>
          <div className="flex items-center gap-1.5 bg-black/45 backdrop-blur-md rounded-full px-3 py-1.5 border border-white/10 shrink-0">
            <EyeIcon className="w-3.5 h-3.5 text-white" />
            <span className="text-xs font-bold tabular-nums">{formatEngagementCount(Math.max(0, viewerCount))}</span>
          </div>
          <button
            type="button"
            onClick={handleLikeTap}
            className="flex items-center gap-1.5 bg-black/45 backdrop-blur-md rounded-full px-3 py-1.5 border border-white/10 shrink-0 active:scale-95"
            aria-label="Like stream"
          >
            <HeartOutlineIcon className="w-3.5 h-3.5 text-white" />
            <span className="text-xs font-bold tabular-nums">{formatEngagementCount(likeCount)}</span>
          </button>
          {isHost && (
            <span className="text-[10px] font-bold text-white/80 bg-black/35 px-2 py-1 rounded-full border border-white/10 truncate max-w-[100px]">
              💎 {hostEarnings.toLocaleString()}
            </span>
          )}
          {isHost && canAddMore && (
            <button
              type="button"
              onClick={() => setShowAddGuest(true)}
              className="text-[10px] font-black uppercase tracking-wide text-white bg-white/15 px-2.5 py-1 rounded-full border border-white/25 shrink-0 hover:bg-white/25 active:scale-95"
            >
              + Guest
            </button>
          )}
        </div>
        <button
          type="button"
          onClick={onEnd}
          className="shrink-0 w-10 h-10 flex items-center justify-center text-white text-2xl font-light leading-none hover:opacity-80 active:scale-95"
          aria-label="Close"
        >
          ×
        </button>
      </header>
      )}

      {streamingHudVisible && !broadcast.micOn && (
        <div className="pointer-events-none absolute left-1/2 top-[calc(4.5rem+env(safe-area-inset-top))] z-[35] -translate-x-1/2 rounded-full border border-white/20 bg-black/75 px-5 py-2 backdrop-blur-md">
          <p className="text-center text-xs font-bold tracking-wide text-white">Microphone Paused</p>
        </div>
      )}

      {/* Guest video strip (1–3 slots). Viewers: swipe right to hide, left to show; grey handle + tap. */}
      {streamingHudVisible && panes.length > 0 && (
        <div
          className={`absolute right-2 top-[calc(4.25rem+env(safe-area-inset-top))] z-[25] flex flex-row gap-1 ${
            viewerCanSwipeGuests ? 'touch-pan-y select-none items-center' : 'items-stretch'
          }`}
          style={viewerGuestRailMinHeight ? { minHeight: viewerGuestRailMinHeight } : undefined}
          aria-label="Guest cameras"
          onPointerDown={viewerCanSwipeGuests ? onGuestRailPointerDown : undefined}
          onPointerMove={viewerCanSwipeGuests ? onGuestRailPointerMove : undefined}
          onPointerUp={viewerCanSwipeGuests ? onGuestRailPointerUp : undefined}
          onPointerCancel={viewerCanSwipeGuests ? onGuestRailPointerUp : undefined}
          onLostPointerCapture={viewerCanSwipeGuests ? onGuestRailLostPointerCapture : undefined}
        >
          {viewerCanSwipeGuests && (
            <button
              type="button"
              data-guest-rail-handle
              onClick={onGuestHandleClick}
              className={`flex h-[4.5rem] w-[1.4rem] shrink-0 flex-col items-center justify-center self-center border border-white/20 bg-zinc-600/50 text-base font-bold leading-none text-white shadow-lg backdrop-blur-[2px] transition-colors hover:bg-zinc-500/50 active:scale-95 ${
                viewerGuestsHidden ? 'rounded-r-lg rounded-l-none' : 'rounded-l-lg'
              }`}
              aria-label={viewerGuestsHidden ? 'Show guest cameras' : 'Hide guest cameras'}
              aria-expanded={!viewerGuestsHidden}
            >
              <span aria-hidden>{viewerGuestsHidden ? '‹' : '›'}</span>
            </button>
          )}
          <div
            className={`flex w-[min(30vw,7rem)] flex-col gap-2 transition-all duration-300 ease-out will-change-transform ${
              viewerCanSwipeGuests && viewerGuestsHidden
                ? 'pointer-events-none absolute top-0 right-[calc(1.4rem+0.25rem)] translate-x-full opacity-0'
                : 'relative translate-x-0 opacity-100'
            }`}
          >
            {panes.map((guest) => (
              <div key={guest.id} className="relative aspect-[2/3] w-full shrink-0">
                <button
                  type="button"
                  onClick={() => {
                    if (isHost) onSwitchMain?.(guest);
                    else onViewProfile?.(guest);
                  }}
                  className={`h-full w-full overflow-hidden rounded-xl border-2 border-white/35 bg-zinc-900/80 shadow-lg outline-none ring-offset-2 ring-offset-black/40 focus-visible:ring-2 focus-visible:ring-pink-400 ${
                    isHost || onViewProfile ? 'cursor-pointer active:scale-[0.98]' : ''
                  }`}
                  aria-label={isHost ? `Show ${guest.name} as main` : `View ${guest.name}`}
                >
                  <img src={guest.avatar} alt="" className="h-full w-full object-cover" />
                </button>
                {isHost && onRemoveGuest && guest.id !== host.id && (
                  <button
                    type="button"
                    onClick={(e) => {
                      e.preventDefault();
                      e.stopPropagation();
                      onRemoveGuest(guest);
                    }}
                    className="absolute right-1 top-1 z-10 flex h-7 w-7 items-center justify-center rounded-full border border-white/25 bg-black/75 text-lg font-light leading-none text-white shadow-md backdrop-blur-sm transition-colors hover:bg-red-600/90 active:scale-95"
                    aria-label={`Remove ${guest.name} from live`}
                  >
                    ×
                  </button>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Viewer gift strip + comment row (host: comment row only) */}
      {streamingHudVisible && (
      <div className="relative z-30 mt-auto flex w-full flex-col">
        {/* Chat — in document order above gift strip so it never overlaps */}
        <div
          className={`max-h-[30vh] shrink-0 flex flex-col justify-end pointer-events-none pl-3 ${
            guestsReserveChatSpace
              ? 'pr-[calc(0.75rem+min(30vw,7rem)+0.5rem)]'
              : viewerCanSwipeGuests && viewerGuestsHidden
                ? 'pr-[calc(0.75rem+1.4rem+0.25rem)]'
                : 'pr-3'
          } pb-2`}
        >
          <div
            ref={chatScrollRef}
            className="flex flex-col gap-2 overflow-y-auto overflow-x-hidden pointer-events-auto scrollbar-hide mask-[linear-gradient(to_bottom,transparent,black_12px)]"
          >
            {comments.map((c, i) => (
              <div
                key={`${c.user}-${i}-${c.text.slice(0, 12)}`}
                className={`flex gap-2 items-start pr-1 ${c.isGift ? 'drop-shadow-[0_0_12px_rgba(236,72,153,0.35)]' : ''}`}
              >
                <img
                  src={c.avatar || avatarForUsername(c.user)}
                  alt=""
                  className="w-8 h-8 rounded-full object-cover shrink-0 border border-white/25"
                />
                <div className="min-w-0">
                  <p className="text-[11px] font-normal text-white/40 leading-tight">
                    {c.user}
                  </p>
                  <p
                    className={`text-sm leading-snug drop-shadow-[0_1px_2px_rgba(0,0,0,0.75)] ${
                      c.isGift ? 'text-pink-200 font-semibold italic' : 'text-white font-normal'
                    }`}
                  >
                    {c.text}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </div>
        {showViewerGiftStrip && (
          <div className="shrink-0 bg-transparent px-0 pt-2">
            <div
              className="flex gap-2 overflow-x-auto px-3 pb-2 scrollbar-hide [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden"
              role="list"
              aria-label="Gifts — scroll sideways to send"
            >
              {viewerGifts.map((gift) => (
                <button
                  key={gift.id}
                  type="button"
                  role="listitem"
                  onClick={() => handleSendGift(gift)}
                  className="flex min-w-[4.5rem] shrink-0 flex-col items-center gap-0.5 rounded-xl border-0 bg-transparent py-2 px-2 transition-transform active:scale-95"
                  aria-label={`Send ${gift.name}, ${gift.value} tokens`}
                >
                  <span className="text-2xl leading-none" aria-hidden>
                    {gift.icon}
                  </span>
                  <span className="max-w-[4.25rem] truncate text-center text-[9px] font-bold leading-tight text-zinc-200">
                    {gift.name}
                  </span>
                  <span className="flex items-center gap-0.5 text-[10px] font-black text-pink-400">
                    <span className="text-[8px]">💎</span>
                    {gift.value}
                  </span>
                </button>
              ))}
            </div>
          </div>
        )}
        <div className="flex items-center gap-2 px-3 pt-2">
        {isHost ? (
          <>
            <div className="flex min-h-[44px] min-w-0 flex-1 items-center rounded-full border border-white/15 bg-black/45 py-2 pl-4 pr-2 backdrop-blur-md">
              <input
                type="text"
                value={messageInput}
                onChange={(e) => setMessageInput(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleSendMessage()}
                placeholder="Comment..."
                className="min-w-0 flex-1 bg-transparent py-2.5 text-sm text-white placeholder:text-zinc-400 outline-none"
              />
              <button
                type="button"
                onClick={handleSendMessage}
                className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-full transition-all ${
                  messageInput.trim() ? 'text-white' : 'text-zinc-500 opacity-60'
                }`}
                aria-label="Send"
              >
                <SendIcon className="h-5 w-5" />
              </button>
            </div>
            {hostMediaStream && onBroadcastMediaChange && (
              <>
                <button
                  type="button"
                  onClick={() =>
                    onBroadcastMediaChange({ ...broadcast, micOn: !broadcast.micOn })
                  }
                  className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-full border border-white/15 bg-black/45 shadow-sm backdrop-blur-md transition-colors active:scale-95 ${
                    broadcast.micOn ? 'text-white' : 'text-red-400'
                  }`}
                  aria-label={broadcast.micOn ? 'Mute microphone' : 'Unmute microphone'}
                >
                  <MicIcon className="h-5 w-5" off={!broadcast.micOn} />
                </button>
                <button
                  type="button"
                  onClick={() =>
                    onBroadcastMediaChange({ ...broadcast, camOn: !broadcast.camOn })
                  }
                  className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-full border border-white/15 bg-black/45 shadow-sm backdrop-blur-md transition-colors active:scale-95 ${
                    broadcast.camOn ? 'text-white' : 'text-red-400'
                  }`}
                  aria-label={broadcast.camOn ? 'Turn off camera' : 'Turn on camera'}
                >
                  <CamIcon className="h-5 w-5" off={!broadcast.camOn} />
                </button>
              </>
            )}
            <button
              type="button"
              onClick={handleHypeBoost}
              className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full border border-white/15 bg-zinc-800/90 text-xl shadow-sm backdrop-blur-md active:scale-95"
              aria-label="Hype"
            >
              🔥
            </button>
          </>
        ) : (
          <>
            <div className="flex min-h-[44px] min-w-0 flex-1 items-center rounded-full border border-white/15 bg-black/45 py-2 pl-4 pr-2 backdrop-blur-md">
              <input
                type="text"
                value={messageInput}
                onChange={(e) => setMessageInput(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleSendMessage()}
                placeholder="Comment..."
                className="min-w-0 flex-1 bg-transparent py-2.5 text-sm text-white placeholder:text-zinc-400 outline-none"
              />
              <button
                type="button"
                onClick={handleSendMessage}
                className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-full transition-all ${
                  messageInput.trim() ? 'text-white' : 'text-zinc-500 opacity-60'
                }`}
                aria-label="Send"
              >
                <SendIcon className="h-5 w-5" />
              </button>
            </div>
            {giftingEnabled && (
              <button
                type="button"
                onClick={() => setShowGiftSelector(true)}
                className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full border border-white/15 bg-black/45 text-xl shadow-sm backdrop-blur-md active:scale-95"
                aria-label="Send gift"
              >
                🎁
              </button>
            )}
          </>
        )}
        </div>
      </div>
      )}

      {/* Home indicator bar (visual) */}
      {streamingHudVisible && (
      <div className="relative z-30 flex justify-center pt-1 pb-0">
        <div className="w-28 h-1 rounded-full bg-white/35" />
      </div>
      )}

      {/* Add Guest Modal */}
      {isHost &&
        streamingHudVisible &&
        showAddGuest &&
        (() => {
          const pool = getUsers().filter((u) => u.id !== host.id && !participants.find((p) => p.id === u.id));
          const viewerIds = new Set<string>();
          for (const c of comments) {
            if (c.user === 'You') continue;
            if (c.userId) {
              if (pool.some((u) => u.id === c.userId)) viewerIds.add(c.userId);
              continue;
            }
            const byName = pool.find((u) => u.name === c.user);
            if (byName) viewerIds.add(byName.id);
          }
          const addableUsers = pool
            .filter((u) => viewerIds.has(u.id))
            .sort((a, b) => a.name.localeCompare(b.name));
          return (
            <div className="fixed inset-0 z-[60] flex items-end justify-center bg-black/40 backdrop-blur-[2px] animate-in fade-in duration-300">
              <div className="absolute inset-0" onClick={() => setShowAddGuest(false)} aria-hidden />
              <div className="w-full max-w-md bg-zinc-950 border-t border-zinc-800 rounded-t-[32px] p-6 pb-12 relative animate-in slide-in-from-bottom duration-300 max-h-[60vh] flex flex-col">
                <div className="w-12 h-1 bg-zinc-800 rounded-full mx-auto mb-6" />
                <div className="flex justify-between items-center mb-4 px-1">
                  <h3 className="text-sm font-black uppercase tracking-widest text-zinc-400">Add to live</h3>
                  <button type="button" onClick={() => setShowAddGuest(false)} className="text-zinc-600 text-sm font-bold">
                    Close
                  </button>
                </div>
                <p className="text-xs text-zinc-500 mb-4">
                  Only people in your live chat can join as a guest ({panes.length}/{MAX_GUESTS})
                </p>
                <div className="overflow-y-auto flex-1 space-y-2">
                  {addableUsers.length > 0 ? (
                    addableUsers.map((user) => (
                      <button
                        key={user.id}
                        type="button"
                        onClick={() => {
                          onAddGuest?.(user);
                          setShowAddGuest(false);
                        }}
                        className="w-full flex items-center gap-3 p-3 rounded-xl bg-zinc-900/50 border border-zinc-800 hover:border-pink-500/50 transition-all"
                      >
                        <img src={user.avatar} className="w-12 h-12 rounded-full object-cover" alt={user.name} />
                        <div className="text-left flex-1">
                          <p className="font-bold text-sm text-white">
                            {user.name}, {user.age}
                          </p>
                          <p className="text-[10px] text-zinc-500">In your chat · watching live</p>
                        </div>
                        <span className="text-pink-500 text-sm font-bold">+ Add</span>
                      </button>
                    ))
                  ) : (
                    <p className="text-center text-zinc-500 py-8">
                      No viewers in chat yet. They&apos;ll appear here after they comment.
                    </p>
                  )}
                </div>
              </div>
            </div>
          );
        })()}

      {!isHost && showGiftSelector && (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 backdrop-blur-[2px] animate-in fade-in duration-300">
          <div className="absolute inset-0" onClick={() => setShowGiftSelector(false)} aria-hidden />
          <div className="w-full max-w-md bg-zinc-950 border-t border-zinc-800 rounded-t-[32px] p-6 pb-12 relative animate-in slide-in-from-bottom duration-300">
            <div className="w-12 h-1 bg-zinc-800 rounded-full mx-auto mb-6" />
            <div className="flex justify-between items-center mb-6 px-1">
              <h3 className="text-sm font-black uppercase tracking-widest text-zinc-400">Send a gift</h3>
              <button type="button" onClick={() => setShowGiftSelector(false)} className="text-zinc-600 text-sm font-bold">
                Close
              </button>
            </div>
            <div className="grid grid-cols-4 gap-4">
              {getGifts().map((gift) => (
                <button
                  key={gift.id}
                  type="button"
                  onClick={() => handleSendGift(gift)}
                  className="flex flex-col items-center gap-2 p-3 rounded-2xl bg-zinc-900/50 border-0 hover:bg-zinc-800 transition-all active:scale-90"
                >
                  <span className="text-3xl">{gift.icon}</span>
                  <div className="flex flex-col items-center">
                    <span className="text-[10px] font-bold text-zinc-300">{gift.name}</span>
                    <span className="text-[10px] font-black text-pink-500 flex items-center gap-0.5">
                      <span className="text-[8px]">💎</span>
                      {gift.value}
                    </span>
                  </div>
                </button>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default LiveStreamView;

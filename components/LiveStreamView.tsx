import React, { useState, useEffect, useRef } from 'react';
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
  onSwitchMain?: (user: User) => void;
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

const LiveWaveIcon = ({ className }: { className?: string }) => (
  <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" aria-hidden>
    <path d="M4.5 16.5c0-3.5 2-6 7.5-6s7.5 2.5 7.5 6" />
    <path d="M8 12.5c0-2 1.6-3.5 4-3.5s4 1.5 4 3.5" />
    <path d="M11.5 9.5h1" />
  </svg>
);

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

const CommentIcon = ({ className }: { className?: string }) => (
  <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
    <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
  </svg>
);

const ShareIcon = ({ className }: { className?: string }) => (
  <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
    <circle cx="18" cy="5" r="3" />
    <circle cx="6" cy="12" r="3" />
    <circle cx="18" cy="19" r="3" />
    <line x1="8.59" y1="13.51" x2="15.42" y2="17.49" />
    <line x1="15.41" y1="6.51" x2="8.59" y2="10.49" />
  </svg>
);

const SendIcon = ({ className }: { className?: string }) => (
  <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
    <line x1="22" y1="2" x2="11" y2="13" />
    <polygon points="22 2 15 22 11 13 2 9 22 2" />
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
  onSwitchMain,
}) => {
  const participants = participantsProp && participantsProp.length > 0 ? participantsProp : [host];
  const mainUser = participants[0];
  const panes = participants.slice(1, 5);
  const canAddMore = isHost && participants.length < 5;
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
  const videoRef = useRef<HTMLVideoElement>(null);
  const chatScrollRef = useRef<HTMLDivElement>(null);

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
    if (hasJoined) {
      const interval = setInterval(() => {
        const mockAudience: ChatLine[] = [
          { user: 'Alex99', text: 'Looking great tonight!' },
          { user: 'Sarah_X', text: 'Hiii everyone!' },
          { user: 'MikeJ', text: 'Send some hearts!' },
          { user: 'Elena_Love', text: 'This is vibes ✨' },
          { user: 'CryptoKing', text: 'Are you from around here?' },
          { user: 'Dave_The_Man', text: 'Keep it up!' },
          { user: 'Linda_B', text: 'Gorgeous!' },
        ];

        const random = mockAudience[Math.floor(Math.random() * mockAudience.length)];
        setComments((prev) => [
          ...prev.slice(-19),
          { ...random, avatar: avatarForUsername(random.user) },
        ]);

        setViewerCount((prev) => prev + Math.floor(Math.random() * 10) - 2);
        setLikeCount((prev) => prev + Math.floor(Math.random() * 20) + 5);

        if (isHost && Math.random() > 0.85) {
          const gifts = getGifts();
          const randomGift = gifts[Math.floor(Math.random() * Math.min(3, gifts.length))];
          if (randomGift) {
            setHostEarnings((prev) => prev + randomGift.value);
            setComments((prev) => [
              ...prev.slice(-19),
              {
                user: random.user,
                text: `sent a ${randomGift.name} ${randomGift.icon}`,
                isGift: true,
                avatar: avatarForUsername(random.user),
              },
            ]);
            spawnParticle(randomGift.icon);
            onReceiveGift?.(randomGift.value);
          }
        }
      }, isHost ? 2000 : 3000);

      return () => clearInterval(interval);
    }
  }, [hasJoined, isHost, onReceiveGift]);

  useEffect(() => {
    let stream: MediaStream | null = null;
    if (isHost && hasJoined && mainUser.id === host.id) {
      navigator.mediaDevices
        .getUserMedia({ video: true, audio: true })
        .then((s) => {
          stream = s;
          if (videoRef.current) videoRef.current.srcObject = s;
        })
        .catch((err) => console.error('Camera access denied', err));
    }
    return () => {
      stream?.getTracks().forEach((track) => track.stop());
    };
  }, [isHost, hasJoined, mainUser.id, host.id]);

  const liveEntryCost = getMonetizationSettings().liveStreamEntryTokens;
  const giftingEnabled = getMonetizationSettings().giftingEnabled;

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

  const handleShare = async () => {
    try {
      if (navigator.share) {
        await navigator.share({
          title: `${mainUser.name} is live`,
          text: `Watch ${mainUser.name} on Zongo`,
        });
      }
    } catch {
      /* dismissed */
    }
  };

  const handleLikeTap = () => {
    setLikeCount((prev) => prev + 1);
    spawnParticle('❤️');
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
  const commentEngagementDisplay = 8200 + comments.length * 3;

  return (
    <div className={`relative w-full min-h-[100dvh] h-[100dvh] bg-black text-white overflow-hidden flex flex-col ${bottomSafe}`}>
      {particles.map((p) => (
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
          <video ref={videoRef} autoPlay muted playsInline className="w-full h-full object-cover scale-x-[-1]" />
        ) : (
          <img src={mainUser.avatar} className="w-full h-full object-cover" alt={mainUser.name} />
        )}
        <div className="absolute inset-0 bg-gradient-to-b from-black/55 via-transparent to-black/70" />
      </div>

      {/* Top bar — Live + viewers + close */}
      <header className="relative z-30 flex items-start justify-between gap-3 pt-[max(0.75rem,env(safe-area-inset-top))] px-3">
        <div className="flex items-center gap-2 min-w-0">
          <div className="flex items-center gap-1.5 bg-red-600 px-2.5 py-1.5 rounded-md shrink-0 shadow-lg">
            <LiveWaveIcon className="w-4 h-4 text-white" />
            <span className="text-xs font-black tracking-wide">LIVE</span>
          </div>
          <div className="flex items-center gap-1.5 bg-black/45 backdrop-blur-md rounded-full px-3 py-1.5 border border-white/10 shrink-0">
            <EyeIcon className="w-3.5 h-3.5 text-white" />
            <span className="text-xs font-bold tabular-nums">{formatEngagementCount(Math.max(0, viewerCount))}</span>
          </div>
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

      {/* Right interaction rail */}
      <aside className="absolute right-2 z-30 flex flex-col items-center gap-4 bottom-[calc(5.25rem+env(safe-area-inset-bottom))]">
        <button
          type="button"
          onClick={() => !isHost && onViewProfile?.(mainUser)}
          className={`relative flex flex-col items-center ${!isHost && onViewProfile ? 'cursor-pointer active:scale-95' : ''}`}
          aria-label={!isHost ? `View ${mainUser.name}` : 'Host'}
        >
          <img
            src={mainUser.avatar}
            alt=""
            className="w-12 h-12 rounded-full object-cover border-2 border-white/90 shadow-lg"
          />
          {!isHost && (
            <span className="absolute -bottom-1 right-0 w-5 h-5 rounded-full bg-white text-black text-sm font-bold flex items-center justify-center border border-black/20 shadow">
              +
            </span>
          )}
        </button>

        <button type="button" onClick={handleLikeTap} className="flex flex-col items-center gap-0.5 active:scale-95">
          <HeartOutlineIcon className="w-8 h-8 text-white drop-shadow-md" />
          <span className="text-[11px] font-bold text-white drop-shadow-sm">{formatEngagementCount(likeCount)}</span>
        </button>

        <div className="flex flex-col items-center gap-0.5 pointer-events-none">
          <CommentIcon className="w-7 h-7 text-white drop-shadow-md" />
          <span className="text-[11px] font-bold text-white drop-shadow-sm">{formatEngagementCount(commentEngagementDisplay)}</span>
        </div>

        <button type="button" onClick={handleShare} className="flex flex-col items-center gap-0.5 active:scale-95">
          <ShareIcon className="w-7 h-7 text-white drop-shadow-md" />
          <span className="text-[10px] font-semibold text-white drop-shadow-sm">Share</span>
        </button>

        {isHost && (
          <button
            type="button"
            onClick={handleHypeBoost}
            className="w-12 h-12 rounded-full bg-zinc-800/90 border border-white/20 flex items-center justify-center text-xl shadow-lg active:scale-95"
            aria-label="Hype"
          >
            🔥
          </button>
        )}
      </aside>

      {/* Chat feed — bottom left */}
      <div
        className="absolute left-3 right-[4.25rem] z-20 bottom-[calc(4.5rem+env(safe-area-inset-bottom))] max-h-[30vh] flex flex-col justify-end pointer-events-none"
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

      {/* Comment input + gift (viewer) — same row, aligned */}
      <div className="relative z-30 mt-auto px-3 pt-2 flex items-center gap-2">
        <div className="flex-1 flex items-center min-h-[44px] bg-black/45 backdrop-blur-md rounded-full border border-white/15 pl-4 pr-2">
          <input
            type="text"
            value={messageInput}
            onChange={(e) => setMessageInput(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleSendMessage()}
            placeholder="Comment..."
            className="flex-1 bg-transparent text-sm text-white placeholder:text-zinc-400 outline-none min-w-0 py-2.5"
          />
          <button
            type="button"
            onClick={handleSendMessage}
            className={`shrink-0 w-9 h-9 rounded-full flex items-center justify-center transition-all ${
              messageInput.trim() ? 'text-white' : 'text-zinc-500 opacity-60'
            }`}
            aria-label="Send"
          >
            <SendIcon className="w-5 h-5" />
          </button>
        </div>
        {!isHost && giftingEnabled && (
          <button
            type="button"
            onClick={() => setShowGiftSelector(true)}
            className="shrink-0 h-11 w-11 rounded-full bg-black/45 backdrop-blur-md border border-white/15 flex items-center justify-center text-xl shadow-sm active:scale-95"
            aria-label="Send gift"
          >
            🎁
          </button>
        )}
      </div>

      {/* Home indicator bar (visual) */}
      <div className="relative z-30 flex justify-center pt-1 pb-0">
        <div className="w-28 h-1 rounded-full bg-white/35" />
      </div>

      {/* Add Guest Modal */}
      {isHost &&
        showAddGuest &&
        (() => {
          const allUsers = getUsers().filter((u) => u.id !== host.id && !participants.find((p) => p.id === u.id));
          const onlineUsers = allUsers.filter((u) => u.isOnline || u.isLive);
          const viewerNames = [...new Set(comments.map((c) => c.user).filter((n) => n !== 'You'))];
          const viewersOnLive = viewerNames
            .map((name) => allUsers.find((u) => name.toLowerCase().includes(u.name.toLowerCase())))
            .filter((u): u is User => !!u);
          const addableUsers = [...onlineUsers];
          viewersOnLive.forEach((v) => {
            if (!addableUsers.find((a) => a.id === v.id)) addableUsers.push(v);
          });
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
                  Add someone online or watching ({panes.length}/4)
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
                          <p className="text-[10px] text-zinc-500">
                            {user.isOnline ? '🟢 Online' : 'Watching'} · {user.location}
                          </p>
                        </div>
                        <span className="text-pink-500 text-sm font-bold">+ Add</span>
                      </button>
                    ))
                  ) : (
                    <p className="text-center text-zinc-500 py-8">No one available to add</p>
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
                  className="flex flex-col items-center gap-2 p-3 rounded-2xl bg-zinc-900/50 border border-zinc-800 hover:border-pink-500/50 hover:bg-zinc-800 transition-all active:scale-90"
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

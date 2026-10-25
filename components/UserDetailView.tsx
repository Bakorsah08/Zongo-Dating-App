import React, { useMemo, useRef, useState } from 'react';
import { User } from '../types';
import { getBadges, getMonetizationSettings } from '../data';
import { getUserMoodDisplay } from '../userMoods';
import BackButton from './BackButton';

interface UserDetailViewProps {
  user: User;
  onBack: () => void;
  onChat: (user: User) => void;
  onLive: (user: User) => void;
  deductTokens?: (amount: number) => boolean;
  onGoToTokenShop?: () => void;
  isFollowing?: boolean;
  onFollowToggle?: () => void;
  /** Called when a Super Like succeeds so the profile is added to following. */
  onFollowUser?: (userId: string) => void;
  /** Recipient should be notified (e.g. in-app notification on their profile). */
  onSuperLikeSuccess?: (recipient: User) => void;
  onReport?: (user: User) => void;
  onBlock?: (user: User) => void;
}

const UserDetailView: React.FC<UserDetailViewProps> = ({
  user,
  onBack,
  onChat,
  onLive,
  deductTokens,
  onGoToTokenShop,
  isFollowing = false,
  onFollowToggle,
  onFollowUser,
  onSuperLikeSuccess,
  onReport,
  onBlock,
}) => {
  const [viewingIndex, setViewingIndex] = useState<number | null>(null);
  const [superLiked, setSuperLiked] = useState(false);
  const [overflowMenuOpen, setOverflowMenuOpen] = useState(false);
  const albumScrollRef = useRef<HTMLDivElement>(null);
  const { superLikeTokens } = getMonetizationSettings();

  /** Main profile photo first, then album URLs (no duplicates). */
  const galleryImages = useMemo(() => {
    const seen = new Set<string>();
    const list: string[] = [];
    if (user.avatar) {
      list.push(user.avatar);
      seen.add(user.avatar);
    }
    for (const url of user.album) {
      if (!seen.has(url)) {
        list.push(url);
        seen.add(url);
      }
    }
    return list;
  }, [user.avatar, user.album]);

  const scrollAlbumThumbs = (direction: -1 | 1) => {
    const el = albumScrollRef.current;
    if (!el) return;
    const step = Math.max(120, Math.floor(el.clientWidth * 0.35));
    el.scrollBy({ left: direction * step, behavior: 'smooth' });
  };

  const handleSuperLike = () => {
    if (superLiked) return;
    const markSuperLikedAndFollow = () => {
      setSuperLiked(true);
      onFollowUser?.(user.id);
      onSuperLikeSuccess?.(user);
    };
    if (deductTokens && superLikeTokens > 0) {
      if (deductTokens(superLikeTokens)) {
        markSuperLikedAndFollow();
      } else {
        onGoToTokenShop?.();
      }
    } else {
      markSuperLikedAndFollow();
    }
  };

  const nextImage = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (viewingIndex !== null && galleryImages.length > 0) {
      setViewingIndex((viewingIndex + 1) % galleryImages.length);
    }
  };

  const prevImage = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (viewingIndex !== null && galleryImages.length > 0) {
      setViewingIndex((viewingIndex - 1 + galleryImages.length) % galleryImages.length);
    }
  };

  return (
    <div className="relative min-h-screen bg-white flex flex-col">
      {/* Header Image */}
      <div className="relative h-[450px] w-full">
        <img src={user.avatar} className="w-full h-full object-cover" />
        <div className="absolute inset-0 bg-gradient-to-t from-black via-black/20 to-transparent"></div>
        <BackButton onClick={onBack} className="absolute top-6 left-6 z-10" />
        <div className="absolute top-6 right-6 flex items-center gap-2">
          {user.isLive && (
            <div className="bg-red-600 px-3 py-1 rounded-full text-xs font-black animate-pulse shadow-lg">
              LIVE
            </div>
          )}
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              setOverflowMenuOpen(true);
            }}
            className="w-10 h-10 rounded-full bg-black/40 backdrop-blur-md flex items-center justify-center border border-white/10 text-white hover:bg-black/60 transition-colors"
            aria-label="More options"
            aria-expanded={overflowMenuOpen}
            aria-haspopup="dialog"
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor" aria-hidden className="text-white">
              <circle cx="12" cy="5" r="2" />
              <circle cx="12" cy="12" r="2" />
              <circle cx="12" cy="19" r="2" />
            </svg>
          </button>
        </div>

        {galleryImages.length > 1 && (
          <div className="absolute bottom-14 left-0 right-0 z-10 flex items-center gap-2 px-3 sm:px-4">
            <button
              type="button"
              onClick={() => scrollAlbumThumbs(-1)}
              className="shrink-0 flex h-10 w-10 items-center justify-center text-white transition-opacity hover:opacity-90 active:scale-95"
              aria-label="Scroll photos left"
            >
              <svg xmlns="http://www.w3.org/2000/svg" width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden className="drop-shadow-[0_1px_3px_rgba(0,0,0,0.85)]">
                <path d="M15 18l-6-6 6-6" />
              </svg>
            </button>
            <div
              ref={albumScrollRef}
              className="min-w-0 flex-1 overflow-x-auto overscroll-x-contain [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
            >
              <div className="flex gap-2 py-0.5">
                {galleryImages.map((img, idx) => (
                  <button
                    key={`${img}-${idx}`}
                    type="button"
                    onClick={() => setViewingIndex(idx)}
                    className="relative h-[54px] w-[54px] shrink-0 overflow-hidden rounded-lg bg-black/20 transition-transform active:scale-95"
                  >
                    <img
                      src={img}
                      alt={idx === 0 ? `${user.name} profile photo` : `${user.name} photo ${idx + 1}`}
                      className="h-full w-full object-cover"
                    />
                  </button>
                ))}
              </div>
            </div>
            <button
              type="button"
              onClick={() => scrollAlbumThumbs(1)}
              className="shrink-0 flex h-10 w-10 items-center justify-center text-white transition-opacity hover:opacity-90 active:scale-95"
              aria-label="Scroll photos right"
            >
              <svg xmlns="http://www.w3.org/2000/svg" width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden className="drop-shadow-[0_1px_3px_rgba(0,0,0,0.85)]">
                <path d="M9 18l6-6-6-6" />
              </svg>
            </button>
          </div>
        )}
      </div>

      {/* Profile Content */}
      <div className="flex-1 -mt-10 relative z-10 bg-white rounded-t-[32px] px-6 pt-8 pb-32">
        <div className="mb-6">
          <div className="flex items-center justify-between gap-3">
            <div className="flex min-w-0 flex-1 items-center gap-2">
              <h1 className="text-3xl font-black text-zinc-900">{user.name}, {user.age}</h1>
              {user.isAI && <span className="text-xs font-bold bg-pink-600 text-white px-2 py-1 rounded-full">🤖 AI</span>}
            </div>
            {!user.isLive && !user.isAI && (
              <button
                type="button"
                onClick={handleSuperLike}
                className={`shrink-0 rounded-2xl px-3 py-2.5 text-center text-xs font-black shadow-md transition-all active:scale-95 sm:px-4 sm:text-sm ${
                  superLiked
                    ? 'bg-pink-100 text-pink-800'
                    : 'bg-zinc-100 text-zinc-800 hover:bg-zinc-200'
                }`}
              >
                ⭐ {superLiked ? 'Super Liked!' : `Super Like${superLikeTokens > 0 ? ` (💎 ${superLikeTokens})` : ''}`}
              </button>
            )}
          </div>
          <p className="text-zinc-600 mt-1 text-sm">📍 {user.location}</p>
          <div className="mt-2 flex flex-wrap gap-2">
            <span className="inline-flex items-center gap-1 rounded-full border border-zinc-200 bg-zinc-50 px-2.5 py-1 text-xs font-semibold text-zinc-800">
              <span aria-hidden>{getUserMoodDisplay(user.mood).icon}</span>
              {getUserMoodDisplay(user.mood).label}
            </span>
            {user.badgeTier && user.badgeTier !== 'none' && (
              <span
                className="inline-flex items-center gap-1 rounded-full border border-amber-200 bg-amber-50 px-2.5 py-1 text-xs font-black uppercase tracking-wide text-amber-900"
                title={getBadges().find((b) => b.id === user.badgeTier)?.name}
              >
                <span aria-hidden>{getBadges().find((b) => b.id === user.badgeTier)?.icon}</span>
                VIP
              </span>
            )}
          </div>
        </div>

        {/* Bio */}
        <section className="mb-8">
          <h4 className="text-xs font-bold text-zinc-500 uppercase tracking-widest mb-3">About</h4>
          <p className="text-zinc-700 leading-relaxed italic">
            "{user.bio}"
          </p>
        </section>

        {/* Interests */}
        <section className="mb-10">
          <h4 className="text-xs font-bold text-zinc-500 uppercase tracking-widest mb-3">{user.isAI ? 'Personality' : 'Interests'}</h4>
          <div className="flex flex-wrap gap-2">
            {(user.isAI ? user.personality : user.interests)?.map(i => (
              <span key={i} className="px-4 py-2 bg-zinc-100 rounded-full text-xs font-medium text-zinc-800">
                {i}
              </span>
            ))}
            {user.isAI && user.style && (
              <span className="px-4 py-2 bg-zinc-100 rounded-full text-xs font-medium text-zinc-800">
                {user.style} Style
              </span>
            )}
          </div>
        </section>

        {/* Action Buttons */}
        <div className="flex gap-3 sm:gap-4 mb-10 items-stretch">
          <button 
            type="button"
            onClick={() => onChat(user)}
            className="flex-1 min-w-0 rounded-full bg-black py-4 font-black text-white shadow-lg transition-colors hover:bg-zinc-900 active:scale-95 flex items-center justify-center gap-2"
          >
            {user.isAI ? "💬 AI Chat" : "💬 Send Message"}
          </button>
          {user.isLive ? (
            <button 
              type="button"
              onClick={() => onLive(user)}
              className="flex-1 min-w-0 bg-zinc-900 text-white py-4 rounded-2xl font-black shadow-lg active:scale-95 transition-all flex items-center justify-center gap-2"
            >
              <span>📺 Watch Live</span>
              {user.viewerCount && (
                <span className="flex items-center gap-1 text-xs bg-white/15 px-2 py-1 rounded-full">
                  <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"></path><circle cx="12" cy="12" r="3"></circle></svg>
                  {user.viewerCount.toLocaleString()}
                </span>
              )}
            </button>
          ) : user.isAI ? (
            <button 
              type="button"
              onClick={() => onChat(user)} // Should probably lead to video call initiation
              className="flex-1 min-w-0 bg-zinc-900 text-white py-4 rounded-2xl font-black shadow-lg active:scale-95 transition-all flex items-center justify-center gap-2"
            >
              📹 AI Video Call
            </button>
          ) : null}
          {onFollowToggle && (
            <button
              type="button"
              onClick={() => onFollowToggle()}
              className="flex h-14 w-14 shrink-0 items-center justify-center self-center rounded-full border-0 bg-white shadow-[0_4px_14px_rgba(0,0,0,0.12),0_2px_4px_rgba(0,0,0,0.06)] ring-0 outline-none transition-colors hover:bg-zinc-50 active:scale-95 focus-visible:ring-2 focus-visible:ring-pink-400 focus-visible:ring-offset-2"
              aria-label={isFollowing ? 'Unfollow' : 'Follow'}
            >
              <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" aria-hidden>
                {isFollowing ? (
                  <path
                    fill="#ec4899"
                    stroke="none"
                    d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"
                  />
                ) : (
                  <path
                    fill="#ffffff"
                    stroke="#000000"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"
                  />
                )}
              </svg>
            </button>
          )}
        </div>
      </div>

      {/* Profile overflow: Report / Block / Cancel */}
      {overflowMenuOpen && (
        <div
          className="fixed inset-0 z-[90] flex flex-col justify-end bg-black/50 backdrop-blur-[2px] animate-in fade-in duration-200"
          role="presentation"
        >
          <button
            type="button"
            className="absolute inset-0 cursor-default"
            aria-label="Close menu"
            onClick={() => setOverflowMenuOpen(false)}
          />
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="profile-overflow-title"
            className="relative mx-auto w-full max-w-md rounded-t-[28px] bg-white px-4 pt-3 pb-[max(1.25rem,env(safe-area-inset-bottom))] shadow-[0_-12px_40px_rgba(0,0,0,0.12)] animate-in slide-in-from-bottom duration-300"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="mx-auto mb-4 h-1 w-12 rounded-full bg-zinc-300" aria-hidden />
            <p id="profile-overflow-title" className="sr-only">
              Profile actions for {user.name}
            </p>
            <div className="flex flex-col gap-2">
              <button
                type="button"
                className="w-full rounded-full border-0 bg-yellow-400 py-3.5 text-center text-sm font-bold text-zinc-900 transition-colors hover:bg-yellow-300 active:scale-[0.99]"
                onClick={() => {
                  setOverflowMenuOpen(false);
                  if (onReport) onReport(user);
                  else window.alert("Thanks — we'll review your report.");
                }}
              >
                Report
              </button>
              <button
                type="button"
                className="w-full rounded-full border-0 bg-yellow-400 py-3.5 text-center text-sm font-bold text-red-600 transition-colors hover:bg-yellow-300 active:scale-[0.99]"
                onClick={() => {
                  if (!window.confirm(`Block ${user.name}? You won't see them in matches or chats.`)) return;
                  setOverflowMenuOpen(false);
                  if (onBlock) onBlock(user);
                  else window.alert(`${user.name} has been blocked.`);
                }}
              >
                Block
              </button>
              <button
                type="button"
                className="mt-1 w-full rounded-full border border-black/60 bg-white py-3.5 text-center text-sm font-bold text-zinc-700 transition-colors hover:bg-zinc-50 active:scale-[0.99]"
                onClick={() => setOverflowMenuOpen(false)}
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Full Screen Image Viewer */}
      {viewingIndex !== null && galleryImages[viewingIndex] && (
        <div 
          className="fixed inset-0 z-[100] bg-black/95 flex flex-col items-center justify-center animate-in fade-in duration-200"
          onClick={() => setViewingIndex(null)}
        >
          <button 
            className="absolute top-6 right-6 w-12 h-12 bg-zinc-800/50 rounded-full flex items-center justify-center text-white text-2xl z-10"
            onClick={() => setViewingIndex(null)}
          >
            ✕
          </button>
          
          <div className="relative w-full h-full flex items-center justify-center p-4">
            <button 
              className="absolute left-4 w-12 h-12 bg-white/10 rounded-full flex items-center justify-center text-white text-2xl backdrop-blur-md"
              onClick={prevImage}
            >
              ‹
            </button>
            
            <img 
              src={galleryImages[viewingIndex]} 
              alt=""
              className="max-w-full max-h-full object-contain shadow-2xl rounded-lg"
              onClick={(e) => e.stopPropagation()}
            />
            
            <button 
              className="absolute right-4 w-12 h-12 bg-white/10 rounded-full flex items-center justify-center text-white text-2xl backdrop-blur-md"
              onClick={nextImage}
            >
              ›
            </button>
          </div>
          
          <div className="absolute bottom-8 text-white/50 text-xs font-bold tracking-widest">
            {viewingIndex + 1} / {galleryImages.length}
          </div>
        </div>
      )}
    </div>
  );
};

export default UserDetailView;
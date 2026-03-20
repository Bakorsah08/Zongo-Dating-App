import React, { useState } from 'react';
import { User } from '../types';
import { getBadges, getMonetizationSettings } from '../data';
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
  onReport,
  onBlock,
}) => {
  const [viewingIndex, setViewingIndex] = useState<number | null>(null);
  const [superLiked, setSuperLiked] = useState(false);
  const [overflowMenuOpen, setOverflowMenuOpen] = useState(false);
  const { superLikeTokens } = getMonetizationSettings();

  const handleSuperLike = () => {
    if (superLiked) return;
    if (deductTokens && superLikeTokens > 0) {
      if (deductTokens(superLikeTokens)) {
        setSuperLiked(true);
      } else {
        onGoToTokenShop?.();
      }
    } else {
      setSuperLiked(true);
    }
  };

  const nextImage = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (viewingIndex !== null) {
      setViewingIndex((viewingIndex + 1) % user.album.length);
    }
  };

  const prevImage = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (viewingIndex !== null) {
      setViewingIndex((viewingIndex - 1 + user.album.length) % user.album.length);
    }
  };

  return (
    <div className="relative min-h-screen bg-black flex flex-col">
      {/* Header Image */}
      <div className="relative h-[450px] w-full">
        <img src={user.avatar} className="w-full h-full object-cover" />
        <div className="absolute inset-0 bg-gradient-to-t from-black via-black/20 to-transparent"></div>
        <BackButton onClick={onBack} className="absolute top-6 left-6 z-10" />
        <div className="absolute top-6 right-6 flex items-center gap-2">
          {onFollowToggle && (
            <button
              type="button"
              onClick={(e) => { e.stopPropagation(); onFollowToggle(); }}
              className="w-10 h-10 rounded-full bg-black/40 backdrop-blur-md flex items-center justify-center border border-white/10 text-white hover:bg-black/60 transition-colors"
              aria-label={isFollowing ? 'Unfollow' : 'Follow'}
            >
              {isFollowing ? (
                <svg xmlns="http://www.w3.org/2000/svg" width="22" height="22" viewBox="0 0 24 24" fill="currentColor" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-pink-400">
                  <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"/>
                </svg>
              ) : (
                <svg xmlns="http://www.w3.org/2000/svg" width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-white">
                  <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"/>
                </svg>
              )}
            </button>
          )}
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
      </div>

      {/* Profile Content */}
      <div className="flex-1 -mt-10 relative z-10 bg-black rounded-t-[40px] px-6 pt-8 pb-32">
        <div className="flex items-center justify-between mb-6">
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-3xl font-black text-white">{user.name}, {user.age}</h1>
              {user.isAI && <span className="text-xs font-bold bg-pink-600/80 text-white px-2 py-1 rounded-full border border-white/20">🤖 AI</span>}
              {user.badgeTier && user.badgeTier !== 'none' && (
                <span className="text-2xl" title={getBadges().find(b => b.id === user.badgeTier)?.name}>
                  {getBadges().find(b => b.id === user.badgeTier)?.icon}
                </span>
              )}
            </div>
            <p className="text-zinc-400 text-sm mt-1">📍 {user.location}</p>
          </div>
          <div className="flex gap-2"></div>
        </div>

        {/* Action Buttons */}
        <div className="grid grid-cols-2 gap-4 mb-10">
          <button 
            onClick={() => onChat(user)}
            className="gradient-pink py-4 rounded-2xl font-black text-white shadow-lg active:scale-95 transition-all flex items-center justify-center gap-2"
          >
            {user.isAI ? "💬 AI Chat" : "💬 Chat Now"}
          </button>
          {user.isLive ? (
            <button 
              onClick={() => onLive(user)}
              className="bg-white text-black py-4 rounded-2xl font-black shadow-lg active:scale-95 transition-all flex items-center justify-center gap-2"
            >
              <span>📺 Watch Live</span>
              {user.viewerCount && (
                <span className="flex items-center gap-1 text-xs bg-black/10 px-2 py-1 rounded-full">
                  <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"></path><circle cx="12" cy="12" r="3"></circle></svg>
                  {user.viewerCount.toLocaleString()}
                </span>
              )}
            </button>
          ) : user.isAI ? (
            <button 
              onClick={() => onChat(user)} // Should probably lead to video call initiation
              className="bg-white text-black py-4 rounded-2xl font-black shadow-lg active:scale-95 transition-all flex items-center justify-center gap-2"
            >
              📹 AI Video Call
            </button>
          ) : (
            <button 
              onClick={handleSuperLike}
              className={`py-4 rounded-2xl font-black active:scale-95 transition-all flex items-center justify-center gap-2 ${
                superLiked 
                  ? 'bg-pink-600/30 border border-pink-500/50 text-pink-300' 
                  : 'bg-zinc-900 border border-zinc-800 text-zinc-300 hover:border-pink-500/50'
              }`}
            >
              ⭐ {superLiked ? 'Super Liked!' : `Super Like${superLikeTokens > 0 ? ` (💎 ${superLikeTokens})` : ''}`}
            </button>
          )}
        </div>

        {/* Bio */}
        <section className="mb-8">
          <h4 className="text-xs font-bold text-zinc-500 uppercase tracking-widest mb-3">About</h4>
          <p className="text-zinc-300 leading-relaxed italic">
            "{user.bio}"
          </p>
        </section>

        {/* Interests */}
        <section className="mb-8">
          <h4 className="text-xs font-bold text-zinc-500 uppercase tracking-widest mb-3">{user.isAI ? 'Personality' : 'Interests'}</h4>
          <div className="flex flex-wrap gap-2">
            {(user.isAI ? user.personality : user.interests)?.map(i => (
              <span key={i} className="px-4 py-2 bg-zinc-900 border border-zinc-800 rounded-full text-xs font-medium text-zinc-300">
                {i}
              </span>
            ))}
            {user.isAI && user.style && (
              <span className="px-4 py-2 bg-zinc-900 border border-zinc-800 rounded-full text-xs font-medium text-zinc-300">
                {user.style} Style
              </span>
            )}
          </div>
        </section>

        {/* Album */}
        {user.album.length > 0 && (
          <section>
            <h4 className="text-xs font-bold text-zinc-500 uppercase tracking-widest mb-3">Photo Album</h4>
            <div className="grid grid-cols-2 gap-3">
              {user.album.map((img, idx) => (
                <div 
                  key={idx} 
                  onClick={() => setViewingIndex(idx)}
                  className="aspect-square rounded-2xl overflow-hidden border border-zinc-800 bg-zinc-900 group cursor-pointer active:scale-95 transition-transform"
                >
                  <img 
                    src={img} 
                    className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-500" 
                  />
                </div>
              ))}
            </div>
          </section>
        )}
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
      {viewingIndex !== null && (
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
              src={user.album[viewingIndex]} 
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
            {viewingIndex + 1} / {user.album.length}
          </div>
        </div>
      )}
    </div>
  );
};

export default UserDetailView;
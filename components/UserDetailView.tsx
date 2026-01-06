
import React, { useState } from 'react';
import { User } from '../types';

interface UserDetailViewProps {
  user: User;
  onBack: () => void;
  onChat: (user: User) => void;
  onLive: (user: User) => void;
}

const UserDetailView: React.FC<UserDetailViewProps> = ({ user, onBack, onChat, onLive }) => {
  const [viewingIndex, setViewingIndex] = useState<number | null>(null);

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
        <button 
          onClick={onBack}
          className="absolute top-6 left-6 w-10 h-10 rounded-full bg-black/40 backdrop-blur-md flex items-center justify-center text-white text-xl border border-white/10"
        >
          ←
        </button>
        {user.isLive && (
          <div className="absolute top-6 right-6 bg-red-600 px-3 py-1 rounded-full text-xs font-black animate-pulse shadow-lg">
            LIVE
          </div>
        )}
      </div>

      {/* Profile Content */}
      <div className="flex-1 -mt-10 relative z-10 bg-black rounded-t-[40px] px-6 pt-8 pb-32">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-3xl font-black">{user.name}, {user.age}</h1>
            <p className="text-zinc-400 text-sm mt-1">📍 {user.location}</p>
          </div>
          <div className="flex gap-2">
            <div className="w-12 h-12 rounded-full bg-zinc-900 border border-zinc-800 flex items-center justify-center text-xl">✨</div>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="grid grid-cols-2 gap-4 mb-10">
          <button 
            onClick={() => onChat(user)}
            className="gradient-pink py-4 rounded-2xl font-black text-white shadow-lg active:scale-95 transition-all flex items-center justify-center gap-2"
          >
            💬 Chat Now
          </button>
          {user.isLive ? (
            <button 
              onClick={() => onLive(user)}
              className="bg-white text-black py-4 rounded-2xl font-black shadow-lg active:scale-95 transition-all flex items-center justify-center gap-2"
            >
              📺 Watch Live
            </button>
          ) : (
            <button 
              className="bg-zinc-900 border border-zinc-800 text-zinc-300 py-4 rounded-2xl font-black active:scale-95 transition-all"
            >
              ⭐ Super Like
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
          <h4 className="text-xs font-bold text-zinc-500 uppercase tracking-widest mb-3">Interests</h4>
          <div className="flex flex-wrap gap-2">
            {user.interests.map(i => (
              <span key={i} className="px-4 py-2 bg-zinc-900 border border-zinc-800 rounded-full text-xs font-medium text-zinc-300">
                {i}
              </span>
            ))}
          </div>
        </section>

        {/* Album */}
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
      </div>

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

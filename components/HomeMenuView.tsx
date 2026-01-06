import React from 'react';
import { User } from '../types';

interface HomeMenuViewProps {
  isOpen: boolean;
  onClose: () => void;
  user: User;
  onGoLive: () => void;
  onGoShop: () => void;
  onGoProfile: () => void;
  onGoCashOut: () => void;
}

const HomeMenuView: React.FC<HomeMenuViewProps> = ({ isOpen, onClose, user, onGoLive, onGoShop, onGoProfile, onGoCashOut }) => {
  if (!isOpen) return null;

  return (
    <>
      {/* Backdrop covers content area, but not navbar */}
      <div 
        className="fixed top-0 bottom-24 left-0 right-0 max-w-md mx-auto z-40 bg-black/60 backdrop-blur-sm animate-in fade-in duration-300"
        onClick={onClose}
      />
      {/* Menu sheet sits above navbar */}
      <div 
        className="fixed bottom-24 left-0 right-0 max-w-md mx-auto bg-zinc-950 border-t border-zinc-800 rounded-t-[32px] p-6 pb-8 z-50 animate-in slide-in-from-bottom duration-300"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="w-12 h-1.5 bg-zinc-800 rounded-full mx-auto mb-6"></div>

        {/* User Greeting */}
        <div className="flex items-center gap-4 mb-8">
          <img src={user.avatar} className="w-16 h-16 rounded-full border-2 border-zinc-800" />
          <div>
            <p className="text-zinc-500 text-sm">Welcome back,</p>
            <h2 className="text-xl font-bold text-white">{user.name}</h2>
          </div>
        </div>

        {/* Earnings Card */}
        <div className="bg-gradient-to-br from-pink-500/10 to-transparent border border-pink-500/20 rounded-2xl p-5 mb-8">
            <p className="text-xs font-bold uppercase tracking-widest text-pink-400/80 mb-2">My Earnings</p>
            <div className="flex items-end justify-between">
                <span className="text-4xl font-black text-white">${((user.earnings || 0) / 100).toFixed(2)}</span>
                <button 
                  onClick={onGoCashOut}
                  className="text-xs font-bold text-white bg-white/10 px-4 py-2 rounded-full hover:bg-white/20 transition-colors"
                >
                    Cash Out
                </button>
            </div>
        </div>

        {/* Features Grid */}
        <div className="grid grid-cols-3 gap-4 text-center">
            <FeatureButton icon="🔴" label="Go Live" onClick={onGoLive} />
            <FeatureButton icon="💎" label="Get Tokens" onClick={onGoShop} />
            <FeatureButton icon="✏️" label="Edit Profile" onClick={onGoProfile} />
            <FeatureButton icon="🚀" label="Boost" onClick={() => {}} disabled />
            <FeatureButton icon="⚙️" label="Settings" onClick={() => {}} disabled />
            <FeatureButton icon="❓" label="Help" onClick={() => {}} disabled />
        </div>
      </div>
    </>
  );
};

interface FeatureButtonProps {
    icon: string;
    label: string;
    onClick: () => void;
    disabled?: boolean;
}

const FeatureButton: React.FC<FeatureButtonProps> = ({ icon, label, onClick, disabled }) => (
    <button 
        onClick={onClick}
        disabled={disabled}
        className="flex flex-col items-center justify-center gap-2 p-3 aspect-square bg-zinc-900 rounded-2xl border border-zinc-800 active:scale-95 transition-all hover:bg-zinc-800 disabled:opacity-50 disabled:cursor-not-allowed"
    >
        <span className="text-3xl">{icon}</span>
        <span className="text-xs font-bold text-zinc-300">{label}</span>
    </button>
);


export default HomeMenuView;
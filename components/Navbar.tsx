import React from 'react';
import { View } from '../types';

interface NavbarProps {
  currentView: View;
  setView: (view: View) => void;
  tokenCount: number;
  liveStreamingEnabled?: boolean;
}

const Navbar: React.FC<NavbarProps> = ({ currentView, setView, tokenCount, liveStreamingEnabled = true }) => {
  const allTabs: { view: View; icon: string; label: string; highlight?: boolean }[] = [
    { view: View.EXPLORE, icon: '✨', label: 'Explore' },
    { view: View.CHATS, icon: '💬', label: 'Chat' },
    ...(liveStreamingEnabled ? [{ view: View.HOST_LIVE, icon: '📹', label: 'Go Live', highlight: true }] : []),
    { view: View.PROFILE, icon: '👤', label: 'Profile' },
  ];

  return (
    <nav className="fixed bottom-0 left-0 right-0 max-w-md mx-auto glass-effect border-t border-zinc-800 flex justify-around items-center py-3 z-50">
      {allTabs.map((tab) => (
        <button
          key={tab.view}
          onClick={() => setView(tab.view)}
          className={`flex flex-col items-center gap-1 transition-all ${
            tab.highlight
              ? 'text-red-500 hover:text-red-400'
              : currentView === tab.view
              ? 'text-pink-500 scale-110'
              : 'text-zinc-500'
          }`}
        >
          <span className={`text-2xl ${tab.highlight ? 'drop-shadow-[0_0_8px_rgba(239,68,68,0.5)]' : ''}`}>
            {tab.icon}
          </span>
          <span className="text-[10px] font-medium uppercase tracking-wider">{tab.label}</span>
        </button>
      ))}
    </nav>
  );
};

export default Navbar;
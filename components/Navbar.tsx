
import React from 'react';
import { View } from '../types';

interface NavbarProps {
  currentView: View;
  setView: (view: View) => void;
  tokenCount: number;
}

const Navbar: React.FC<NavbarProps> = ({ currentView, setView, tokenCount }) => {
  const tabs = [
    { view: View.EXPLORE, icon: '✨', label: 'Explore' },
    { view: View.CHATS, icon: '💬', label: 'Chat' },
    { view: View.PROFILE, icon: '👤', label: 'Profile' },
  ];

  return (
    <nav className="fixed bottom-0 left-0 right-0 max-w-md mx-auto glass-effect border-t border-zinc-800 flex justify-around items-center py-3 z-50">
      {tabs.map((tab) => (
        <button
          key={tab.view}
          onClick={() => setView(tab.view)}
          className={`flex flex-col items-center gap-1 transition-all ${
            currentView === tab.view ? 'text-pink-500 scale-110' : 'text-zinc-500'
          }`}
        >
          <span className="text-2xl">{tab.icon}</span>
          <span className="text-[10px] font-medium uppercase tracking-wider">{tab.label}</span>
        </button>
      ))}
    </nav>
  );
};

export default Navbar;

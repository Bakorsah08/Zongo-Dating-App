import React from 'react';
import { View } from '../types';

interface NavbarProps {
  currentView: View;
  setView: (view: View) => void;
  tokenCount: number;
}

const Navbar: React.FC<NavbarProps> = ({ currentView, setView, tokenCount }) => {
  const tabs = [
    {
      view: View.HOME,
      icon: (
        <svg xmlns="http://www.w3.org/2000/svg" className="w-7 h-7" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <rect x="3" y="3" width="7" height="7"></rect>
          <rect x="14" y="3" width="7" height="7"></rect>
          <rect x="14" y="14" width="7" height="7"></rect>
          <rect x="3" y="14" width="7" height="7"></rect>
        </svg>
      ),
      label: 'Home',
    },
    {
      view: View.EXPLORE,
      icon: (
        <svg xmlns="http://www.w3.org/2000/svg" className="w-7 h-7" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <circle cx="12" cy="12" r="10"></circle>
          <polygon points="16.24 7.76 14.12 14.12 7.76 16.24 9.88 9.88 16.24 7.76"></polygon>
          <circle cx="12" cy="12" r="3"></circle>
        </svg>
      ),
      label: 'Explore',
    },
    {
      view: View.HOST_LIVE,
      icon: (
        <svg xmlns="http://www.w3.org/2000/svg" width="38" height="38" viewBox="0 0 24 24" fill="currentColor" stroke="currentColor" strokeWidth="1" strokeLinecap="round" strokeLinejoin="round"><path d="m22 8-6 4 6 4V8Z"/><rect width="14" height="12" x="2" y="6" rx="2" ry="2"/></svg>
      ),
      label: 'Go Live',
      isPrimary: true,
    },
    {
      view: View.CHATS,
      icon: (
        <svg xmlns="http://www.w3.org/2000/svg" className="w-7 h-7" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"></path>
        </svg>
      ),
      label: 'Chat',
    },
    {
      view: View.PROFILE,
      icon: (
        <svg xmlns="http://www.w3.org/2000/svg" className="w-7 h-7" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"></path>
          <circle cx="12" cy="7" r="4"></circle>
        </svg>
      ),
      label: 'Profile',
    },
  ];

  return (
    <nav className="fixed bottom-0 left-0 right-0 max-w-md mx-auto glass-effect border-t border-zinc-800 flex justify-around items-end py-1 z-50">
      {tabs.map((tab: any) => (
        <button
          key={tab.view}
          onClick={() => setView(tab.view)}
          className={
            tab.isPrimary
            ? 'w-16 h-16 -translate-y-6 gradient-pink rounded-full flex items-center justify-center text-white shadow-[0_0_20px_rgba(219,39,119,0.5)] active:scale-90 transition-all'
            : `flex flex-col items-center gap-1 transition-all w-16 ${
                currentView === tab.view ? 'text-pink-500 scale-110' : 'text-white'
              }`
          }
        >
          {tab.icon}
          {!tab.isPrimary && (
            <span className="text-[9px] font-medium capitalize tracking-wider">{tab.label}</span>
          )}
        </button>
      ))}
    </nav>
  );
};

export default Navbar;
import React from 'react';
import { View } from '../types';

interface NavbarProps {
  currentView: View;
  setView: (view: View) => void;
  tokenCount: number;
  liveStreamingEnabled?: boolean;
}

const iconClass = (active: boolean, highlight?: boolean) =>
  active ? 'text-pink-500' : highlight ? 'text-zinc-600' : 'text-zinc-600';

const Navbar: React.FC<NavbarProps> = ({ currentView, setView, liveStreamingEnabled = true }) => {
  const tabs: { view: View; label: string; highlight?: boolean; icon: React.ReactNode }[] = [
    {
      view: View.EXPLORE,
      label: 'Explore',
      icon: (
        <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-[1.8rem] h-[1.8rem]">
          <circle cx="12" cy="12" r="10" />
          <line x1="2" y1="12" x2="22" y2="12" />
          <path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z" />
        </svg>
      ),
    },
    {
      view: View.FOLLOWING,
      label: 'Following',
      icon: (
        <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-[1.8rem] h-[1.8rem]">
          <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
          <circle cx="9" cy="7" r="4" />
          <path d="M23 21v-2a4 4 0 0 0-3-3.87" />
          <path d="M16 3.13a4 4 0 0 1 0 7.75" />
        </svg>
      ),
    },
    ...(liveStreamingEnabled
      ? [
          {
            view: View.HOST_LIVE as View,
            label: 'Go Live',
            highlight: true,
            icon: (
              <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-[1.8rem] h-[1.8rem]">
                <path d="m22 8-6 4 6 4V8Z" />
                <rect width="14" height="12" x="2" y="6" rx="2" ry="2" />
              </svg>
            ),
          },
        ]
      : []),
    {
      view: View.CHATS,
      label: 'Chat',
      icon: (
        <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-[1.8rem] h-[1.8rem]">
          <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
        </svg>
      ),
    },
    {
      view: View.PROFILE,
      label: 'Profile',
      icon: (
        <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-[1.8rem] h-[1.8rem]">
          <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
          <circle cx="12" cy="7" r="4" />
        </svg>
      ),
    },
  ];

  return (
    <nav className="fixed bottom-0 left-0 right-0 max-w-md mx-auto bg-white border-t border-zinc-200 flex justify-around items-center py-3 z-[60] pointer-events-auto">
      {tabs.map((tab) => {
        const isActive = currentView === tab.view;
        return (
          <button
            type="button"
            key={tab.view}
            onClick={() => setView(tab.view)}
            className={`flex flex-col items-center justify-center transition-colors ${iconClass(isActive, tab.highlight)}`}
            aria-label={tab.label}
          >
            {tab.icon}
          </button>
        );
      })}
    </nav>
  );
};

export default Navbar;

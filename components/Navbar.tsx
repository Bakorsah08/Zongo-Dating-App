import React from 'react';
import { View } from '../types';

interface NavbarProps {
  currentView: View;
  setView: (view: View) => void;
  tokenCount: number;
  liveStreamingEnabled?: boolean;
  hidden?: boolean;
  /** Pink dot on Profile when the current user has unread in-app notifications. */
  profileUnreadDot?: boolean;
}

const iconSize = 'w-[1.9rem] h-[1.9rem]';

const GlobeIcon = ({ className }: { className?: string }) => (
  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" className={className}>
    <circle cx="12" cy="12" r="10" />
    <line x1="2" y1="12" x2="22" y2="12" />
    <path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z" />
  </svg>
);

/** Three nodes connected — “network / following” inspo */
const NetworkIcon = ({ className }: { className?: string }) => (
  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" className={className}>
    <circle cx="12" cy="5.5" r="3.4" />
    <circle cx="6.2" cy="17.2" r="3.4" />
    <circle cx="17.8" cy="17.2" r="3.4" />
    <path d="M10.2 8.2 7.9 13.1M13.8 8.2 16.1 13.1M9.9 17.2h4.2" />
    <circle cx="12" cy="4.7" r="0.9" />
    <path d="M10.8 6.7a1.2 1.2 0 0 1 2.4 0" />
    <circle cx="6.2" cy="16.4" r="0.9" />
    <path d="M5 18.4a1.2 1.2 0 0 1 2.4 0" />
    <circle cx="17.8" cy="16.4" r="0.9" />
    <path d="M16.6 18.4a1.2 1.2 0 0 1 2.4 0" />
  </svg>
);

const WebcamIcon = ({ className }: { className?: string }) => (
  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" className={className}>
    <rect x="3" y="7" width="13" height="10" rx="2" />
    <circle cx="9.5" cy="12" r="2" />
    <path d="M16 10l4-2v8l-4-2" />
  </svg>
);

const ChatIcon = ({ className }: { className?: string }) => (
  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" className={className}>
    <path d="M3.5 4.5h8.5a1.5 1.5 0 0 1 1.5 1.5v5a1.5 1.5 0 0 1-1.5 1.5H8.8L5.7 15v-2.5H3.5A1.5 1.5 0 0 1 2 11V6a1.5 1.5 0 0 1 1.5-1.5Z" />
    <path d="M11 8h9.5A1.5 1.5 0 0 1 22 9.5v5a1.5 1.5 0 0 1-1.5 1.5h-2.2V18l-3.1-2.5H12.5a1.5 1.5 0 0 1-1.5-1.5V9.5A1.5 1.5 0 0 1 11 8Z" />
  </svg>
);

/** Solid silhouette profile — inspo */
const ProfileSolidIcon = ({ className }: { className?: string }) => (
  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className={className}>
    <circle cx="12" cy="8" r="4" />
    <path d="M4 20v-1a4 4 0 0 1 4-4h8a4 4 0 0 1 4 4v1" />
  </svg>
);

const Navbar: React.FC<NavbarProps> = ({
  currentView,
  setView,
  liveStreamingEnabled = true,
  hidden = false,
  profileUnreadDot = false,
}) => {
  const inactive = 'text-white/55 hover:text-white/90';
  const active = 'text-pink-400';

  return (
    <nav className={`fixed bottom-0 left-0 right-0 max-w-md mx-auto z-[60] transition-all duration-200 ${hidden ? 'translate-y-full opacity-0 pointer-events-none' : 'translate-y-0 opacity-100 pointer-events-auto'}`}>
      {/* Black bar — extra bottom padding for home indicator */}
      <div className="bg-black border-t border-white/10 flex items-end justify-between px-1 pb-[max(0.75rem,env(safe-area-inset-bottom))] pt-2 min-h-[3.75rem]">
        {/* Explore */}
        <button
          type="button"
          onClick={() => setView(View.EXPLORE)}
          className={`flex flex-1 flex-col items-center justify-center py-2 transition-colors ${currentView === View.EXPLORE ? active : inactive}`}
          aria-label="Explore"
        >
          <GlobeIcon className={iconSize} />
        </button>

        {/* Following */}
        <button
          type="button"
          onClick={() => setView(View.FOLLOWING)}
          className={`flex flex-1 flex-col items-center justify-center py-2 transition-colors ${currentView === View.FOLLOWING ? active : inactive}`}
          aria-label="Following"
        >
          <NetworkIcon className={iconSize} />
        </button>

        {/* Center: Go Live — purple circle, pops above bar, white ring */}
        {liveStreamingEnabled ? (
          <div className="flex flex-1 justify-center items-end relative min-w-0">
            <button
              type="button"
              onClick={() => setView(View.HOST_LIVE)}
              className="relative -top-7 flex h-[3.75rem] w-[3.75rem] shrink-0 items-center justify-center rounded-full bg-pink-500 text-white shadow-[0_4px_20px_rgba(236,72,153,0.45)] ring-[5px] ring-white transition-transform active:scale-95"
              aria-label="Start live stream"
            >
              <WebcamIcon className="h-7 w-7" />
            </button>
          </div>
        ) : (
          <div className="flex-1 min-w-[2.5rem]" aria-hidden />
        )}

        {/* Chat */}
        <button
          type="button"
          onClick={() => setView(View.CHATS)}
          className={`flex flex-1 flex-col items-center justify-center py-2 transition-colors ${currentView === View.CHATS ? active : inactive}`}
          aria-label="Chat"
        >
          <ChatIcon className={iconSize} />
        </button>

        {/* Profile — solid */}
        <button
          type="button"
          onClick={() => setView(View.PROFILE)}
          className={`relative flex flex-1 flex-col items-center justify-center py-2 transition-colors ${currentView === View.PROFILE ? active : inactive}`}
          aria-label="Profile"
        >
          <ProfileSolidIcon className={iconSize} />
          {profileUnreadDot ? (
            <span
              className="absolute top-1.5 right-[calc(50%-1.1rem)] h-2 min-w-2 rounded-full bg-pink-500 ring-2 ring-black"
              aria-hidden
            />
          ) : null}
        </button>
      </div>
    </nav>
  );
};

export default Navbar;

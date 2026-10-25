import React from 'react';
import { View, type UserGender } from '../types';

interface NavbarProps {
  currentView: View;
  setView: (view: View) => void;
  tokenCount: number;
  liveStreamingEnabled?: boolean;
  hidden?: boolean;
  /** Pink outer glow on the live button — only when the logged-in user is female. */
  viewerGender?: UserGender;
}

const iconSize = 'w-[1.9rem] h-[1.9rem]';

/** Outline home (discover tab) — rounded peak, doorway opening */
const HomeIcon = ({ className }: { className?: string }) => (
  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className={className}>
    <path d="M4.5 10.05 11.47 4.38a1.35 1.35 0 0 1 1.06 0L19.5 10.05V19a1.75 1.75 0 0 1-1.75 1.75H15.25v-5.1a2.25 2.25 0 0 0-4.5 0v5.1H6.25A1.75 1.75 0 0 1 4.5 19v-8.95z" />
  </svg>
);

/** Outline heart — Following tab */
const HeartIcon = ({ className }: { className?: string }) => (
  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" className={className}>
    <path d="M19 14c1.49-1.46 3-3.21 3-5.5A5.5 5.5 0 0 0 16.5 3c-1.76 0-3 .5-4.5 2-1.5-1.5-2.74-2-4.5-2A5.5 5.5 0 0 0 2 8.5c0 2.29 1.51 4.04 3 5.5l7 7Z" />
  </svg>
);

const WebcamIcon = ({ className }: { className?: string }) => (
  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" className={className}>
    <rect x="3" y="7" width="13" height="10" rx="2" />
    <circle cx="9.5" cy="12" r="2" />
    <path d="M16 10l4-2v8l-4-2" />
  </svg>
);

/** Round bubble + bottom-left tail + ellipsis (messenger-style) */
const ChatIcon = ({ className }: { className?: string }) => (
  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" className={className}>
    <path
      d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 1 1 17 0z"
      stroke="currentColor"
      strokeWidth="1.75"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
    <circle cx="9" cy="11.5" r="1.05" fill="currentColor" />
    <circle cx="12" cy="11.5" r="1.05" fill="currentColor" />
    <circle cx="15" cy="11.5" r="1.05" fill="currentColor" />
  </svg>
);

/** Outline user — round head + rounded shoulder arc */
const ProfileOutlineIcon = ({ className }: { className?: string }) => (
  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" className={className}>
    <circle cx="12" cy="8.25" r="3.75" />
    <path d="M5.15 19.9a6.85 6.85 0 0 1 13.7 0" />
  </svg>
);

const LIVE_BTN_SHADOW_FEMALE =
  'shadow-[inset_0_2px_6px_rgba(0,0,0,0.2),inset_0_-1px_4px_rgba(255,255,255,0.22),0_0_0_2px_rgba(24,24,27,0.18),0_4px_15px_rgba(236,72,153,0.38),0_0_14px_6px_rgba(236,72,153,0.5),0_0_27px_11px_rgba(244,114,182,0.35)]';
const LIVE_BTN_SHADOW_OTHER =
  'shadow-[inset_0_2px_6px_rgba(0,0,0,0.2),inset_0_-1px_4px_rgba(255,255,255,0.22),0_0_0_2px_rgba(24,24,27,0.18),0_2px_10px_rgba(0,0,0,0.18)]';

const Navbar: React.FC<NavbarProps> = ({
  currentView,
  setView,
  liveStreamingEnabled = true,
  hidden = false,
  viewerGender,
}) => {
  const inactive = 'text-black/55 hover:text-black/90';
  const active = 'text-pink-400';
  const liveButtonShadow = viewerGender === 'female' ? LIVE_BTN_SHADOW_FEMALE : LIVE_BTN_SHADOW_OTHER;

  return (
    <nav className={`fixed bottom-0 left-0 right-0 max-w-md mx-auto z-[60] transition-all duration-200 ${hidden ? 'translate-y-full opacity-0 pointer-events-none' : 'translate-y-0 opacity-100 pointer-events-auto'}`}>
      <div className="relative flex min-h-[3rem] items-center bg-white border-t border-black/10 px-0.5 pb-[max(0.5rem,env(safe-area-inset-bottom))] pt-0.5">
        {/* Side icons: vertically centered in bar; live column stays bottom-anchored + pops up */}
        <div className="flex w-full min-h-[3.5rem] items-stretch justify-between">
          {/* Home → Explore (discover) */}
          <div className="flex min-w-0 flex-1 items-center justify-center">
            <button
              type="button"
              onClick={() => setView(View.EXPLORE)}
              className={`flex flex-col items-center justify-center py-1 transition-colors ${currentView === View.EXPLORE ? active : inactive}`}
              aria-label="Home"
            >
              <HomeIcon className={iconSize} />
            </button>
          </div>

          {/* Following */}
          <div className="flex min-w-0 flex-1 items-center justify-center">
            <button
              type="button"
              onClick={() => setView(View.FOLLOWING)}
              className={`flex flex-col items-center justify-center py-1 transition-colors ${currentView === View.FOLLOWING ? active : inactive}`}
              aria-label="Following"
            >
              <HeartIcon className={iconSize} />
            </button>
          </div>

          {/* Center: Go Live — purple circle, pops above bar, white ring */}
          {liveStreamingEnabled ? (
            <div className="relative flex min-w-0 flex-1 items-end justify-center">
              <button
                type="button"
                onClick={() => setView(View.HOST_LIVE)}
                className={`relative -top-6 flex h-[3.5rem] w-[3.5rem] shrink-0 items-center justify-center rounded-full bg-pink-500 text-white ring-[5px] ring-white shadow-[0_4px_14px_rgba(0,0,0,0.12)] transition-transform active:scale-95 ${liveButtonShadow}`}
                aria-label="Start live stream"
              >
                <WebcamIcon className="h-[2.1rem] w-[2.1rem]" />
              </button>
            </div>
          ) : (
            <div className="flex-1 min-w-[2.5rem]" aria-hidden />
          )}

          {/* Chat */}
          <div className="flex min-w-0 flex-1 items-center justify-center">
            <button
              type="button"
              onClick={() => setView(View.CHATS)}
              className={`flex flex-col items-center justify-center py-1 transition-colors ${currentView === View.CHATS ? active : inactive}`}
              aria-label="Chat"
            >
              <ChatIcon className={iconSize} />
            </button>
          </div>

          {/* Profile */}
          <div className="flex min-w-0 flex-1 items-center justify-center">
            <button
              type="button"
              onClick={() => setView(View.PROFILE)}
              className={`flex flex-col items-center justify-center py-1 transition-colors ${currentView === View.PROFILE ? active : inactive}`}
              aria-label="Profile"
            >
              <ProfileOutlineIcon className={iconSize} />
            </button>
          </div>
        </div>
      </div>
    </nav>
  );
};

export default Navbar;

import React, { useState } from 'react';
import type { AppUserGender } from '../appSession';

interface GenderSelectPageProps {
  onSelect: (gender: AppUserGender) => void;
}

const GENDER_PAGE_BG = '/gender/background.jpg';

const GenderSelectPage: React.FC<GenderSelectPageProps> = ({ onSelect }) => {
  const [active, setActive] = useState<AppUserGender | null>(null);

  const handlePick = (gender: AppUserGender) => {
    setActive(gender);
    onSelect(gender);
  };

  return (
    <div
      className="min-h-[100dvh] w-full bg-black text-white flex flex-col items-center justify-end p-6 relative overflow-hidden"
      style={{ paddingBottom: 'max(4rem, env(safe-area-inset-bottom, 1rem))' }}
    >
      <div className="absolute inset-0 bg-black">
        <img
          src={GENDER_PAGE_BG}
          alt=""
          className="absolute inset-0 w-full h-full object-cover object-center"
          onError={(e) => {
            e.currentTarget.style.display = 'none';
          }}
        />
        <div className="absolute inset-0 bg-black/60" />
      </div>

      <div className="relative z-10 w-full max-w-sm text-center flex flex-col items-center px-1">
        <h1 className="text-2xl font-bold mb-1 tracking-tight">I am</h1>
        <p className="text-white/70 text-sm mb-[30px] max-w-[280px]">
          Choose your gender to personalize your experience
        </p>

        {/* Sliding segmented control — Dribbble-inspired binary selector */}
        <div
          className="w-full relative rounded-full p-[4.5px] bg-zinc-900/85 backdrop-blur-md border border-white/12 shadow-[0_8px_32px_rgba(0,0,0,0.45)]"
          role="group"
          aria-label="Gender"
        >
          {/* Pill inset matches p-[4.5px]; width stays half of inner row minus one horizontal inset */}
          <div
            className="absolute top-[4.5px] bottom-[4.5px] left-[4.5px] w-[calc(50%-4.5px)] rounded-full shadow-md transition-[transform,background] duration-300 ease-[cubic-bezier(0.34,1.2,0.64,1)] pointer-events-none will-change-transform"
            style={{
              transform: active === 'female' ? 'translateX(100%)' : 'translateX(0)',
              background:
                active === 'female'
                  ? 'linear-gradient(145deg, rgba(236,72,153,0.95), rgba(219,39,119,0.88))'
                  : active === 'male'
                    ? 'linear-gradient(145deg, rgba(37,99,235,0.95), rgba(29,78,216,0.88))'
                    : 'linear-gradient(145deg, rgba(255,255,255,0.12), rgba(255,255,255,0.06))',
            }}
            aria-hidden
          />
          <div className="relative flex">
            <button
              type="button"
              onClick={() => handlePick('male')}
              aria-pressed={active === 'male'}
              className={`flex-1 flex flex-col items-center justify-center gap-[3px] py-[15px] rounded-full z-10 outline-none focus-visible:ring-2 focus-visible:ring-white/50 focus-visible:ring-offset-2 focus-visible:ring-offset-zinc-900 transition-colors ${
                active === 'male' ? 'text-white' : active === null ? 'text-white/70' : 'text-white/45'
              }`}
            >
              <span className="text-[22px] leading-none" aria-hidden>
                👨
              </span>
              <span className="text-[11px] font-semibold tracking-wide">Male</span>
            </button>
            <button
              type="button"
              onClick={() => handlePick('female')}
              aria-pressed={active === 'female'}
              className={`flex-1 flex flex-col items-center justify-center gap-[3px] py-[15px] rounded-full z-10 outline-none focus-visible:ring-2 focus-visible:ring-white/50 focus-visible:ring-offset-2 focus-visible:ring-offset-zinc-900 transition-colors ${
                active === 'female' ? 'text-white' : active === null ? 'text-white/70' : 'text-white/45'
              }`}
            >
              <span className="text-[22px] leading-none" aria-hidden>
                👩
              </span>
              <span className="text-[11px] font-semibold tracking-wide">Female</span>
            </button>
          </div>
        </div>

        <p className="mt-[13px] text-xs text-white/40">Tap an option to continue</p>
      </div>
    </div>
  );
};

export default GenderSelectPage;

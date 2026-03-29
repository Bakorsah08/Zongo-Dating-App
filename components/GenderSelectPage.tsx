import React from 'react';
import type { AppUserGender } from '../appSession';

interface GenderSelectPageProps {
  onSelect: (gender: AppUserGender) => void;
}

const GENDER_PAGE_BG = '/gender/background.jpg';

const GenderSelectPage: React.FC<GenderSelectPageProps> = ({ onSelect }) => {
  return (
    <div
      className="min-h-[100dvh] w-full bg-black text-white flex flex-col items-center justify-end p-6 relative overflow-hidden"
      style={{ paddingBottom: 'max(4rem, env(safe-area-inset-bottom, 1rem))' }}
    >
      {/* Background image - fills phone viewport, no stretch (object-cover) */}
      <div className="absolute inset-0 bg-black">
        <img
          src={GENDER_PAGE_BG}
          alt=""
          className="absolute inset-0 w-full h-full object-cover object-center"
          onError={(e) => { e.currentTarget.style.display = 'none'; }}
        />
        <div className="absolute inset-0 bg-black/60" />
      </div>
      <div className="relative z-10 w-full max-w-sm text-center flex flex-col items-center">
        <h1 className="text-2xl font-bold mb-1">I am</h1>
        <p className="text-white/70 text-sm mb-8">Choose your gender to personalize your experience</p>

        {/* Two-option card style (Dribbble-style gender selection) - 70% size */}
        <div className="w-full flex gap-4 justify-center scale-[0.7] origin-center">
          <button
            type="button"
            onClick={() => onSelect('male')}
            className="flex-1 max-w-[140px] flex flex-col items-center justify-center gap-3 bg-blue-950/90 hover:bg-blue-900/95 backdrop-blur-sm border-2 border-blue-700/80 hover:border-blue-500 rounded-3xl py-8 font-bold text-white transition-all active:scale-[0.96] shadow-lg shadow-blue-950/50 min-h-[160px]"
          >
            <span className="text-5xl" aria-hidden>👨</span>
            <span className="text-lg">Male</span>
          </button>
          <button
            type="button"
            onClick={() => onSelect('female')}
            className="flex-1 max-w-[140px] flex flex-col items-center justify-center gap-3 bg-pink-500/90 hover:bg-pink-600/95 backdrop-blur-sm border-2 border-pink-400/80 hover:border-pink-300 rounded-3xl py-8 font-bold text-white transition-all active:scale-[0.96] shadow-lg shadow-pink-950/30 min-h-[160px]"
          >
            <span className="text-5xl" aria-hidden>👩</span>
            <span className="text-lg">Female</span>
          </button>
        </div>
      </div>
    </div>
  );
};

export default GenderSelectPage;

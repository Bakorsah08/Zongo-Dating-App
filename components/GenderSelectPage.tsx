import React from 'react';
import type { AppUserGender } from '../appSession';

interface GenderSelectPageProps {
  onSelect: (gender: AppUserGender) => void;
}

const GenderSelectPage: React.FC<GenderSelectPageProps> = ({ onSelect }) => {
  return (
    <div className="min-h-screen bg-black text-white flex flex-col items-center justify-center p-6">
      <div className="w-full max-w-sm text-center">
        <h1 className="text-2xl font-bold mb-2">I am</h1>
        <p className="text-zinc-500 text-sm mb-8">Choose your gender to personalize your experience</p>

        <div className="space-y-4">
          <button
            onClick={() => onSelect('male')}
            className="w-full flex items-center justify-center gap-4 bg-zinc-900 hover:bg-zinc-800 border-2 border-zinc-800 hover:border-pink-500/50 py-6 rounded-2xl font-bold text-lg transition-all active:scale-[0.98]"
          >
            <span className="text-4xl">👨</span>
            <span>Male</span>
          </button>
          <button
            onClick={() => onSelect('female')}
            className="w-full flex items-center justify-center gap-4 bg-zinc-900 hover:bg-zinc-800 border-2 border-zinc-800 hover:border-pink-500/50 py-6 rounded-2xl font-bold text-lg transition-all active:scale-[0.98]"
          >
            <span className="text-4xl">👩</span>
            <span>Female</span>
          </button>
        </div>
      </div>
    </div>
  );
};

export default GenderSelectPage;

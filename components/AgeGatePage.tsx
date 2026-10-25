import React, { useState } from 'react';
import { MINIMUM_AGE, ageFromBirthdate } from '../services/supabaseSafety';

interface AgeGatePageProps {
  /** Resolves with an error message to show, or nothing on success. */
  onSubmit: (birthdate: string) => Promise<string | void>;
  /** Under-18 entry: the parent signs the user out. */
  onUnderage: () => void;
  /** Set when this device already entered an under-18 birthdate. */
  blocked?: boolean;
  onSignOut: () => void;
}

function todayIso(): string {
  const d = new Date();
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  return `${d.getFullYear()}-${mm}-${dd}`;
}

/**
 * Neutral age screen: asks for a date of birth rather than "Are you 18?", and doesn't
 * reveal the cut-off date, so it can't be passed by just tapping Yes.
 */
const AgeGatePage: React.FC<AgeGatePageProps> = ({ onSubmit, onUnderage, blocked = false, onSignOut }) => {
  const [birthdate, setBirthdate] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [underage, setUnderage] = useState(blocked);

  const handleContinue = async () => {
    setError('');
    if (!/^\d{4}-\d{2}-\d{2}$/.test(birthdate)) {
      setError('Enter your date of birth.');
      return;
    }
    const age = ageFromBirthdate(birthdate);
    if (age < 0 || age > 120) {
      setError('Enter a valid date of birth.');
      return;
    }
    if (age < MINIMUM_AGE) {
      setUnderage(true);
      onUnderage();
      return;
    }
    setBusy(true);
    const message = await onSubmit(birthdate);
    setBusy(false);
    if (message) setError(message);
  };

  return (
    <div
      className="min-h-[100dvh] w-full bg-zinc-950 text-white flex flex-col items-center justify-center p-6"
      style={{ paddingBottom: 'max(2rem, env(safe-area-inset-bottom, 1rem))' }}
    >
      <div className="w-full max-w-sm">
        {underage ? (
          <div className="text-center" role="alert">
            <h1 className="text-2xl font-bold mb-3">Zongo is for adults only</h1>
            <p className="text-white/70 text-sm leading-relaxed mb-8">
              You need to be {MINIMUM_AGE} or older to use Zongo. We&apos;ve signed you out of this account.
            </p>
            <button
              type="button"
              onClick={onSignOut}
              className="w-full min-h-[48px] rounded-2xl border border-white/20 text-sm font-semibold text-white/90"
            >
              Close
            </button>
          </div>
        ) : (
          <form
            onSubmit={(e) => {
              e.preventDefault();
              void handleContinue();
            }}
          >
            <h1 className="text-2xl font-bold mb-2 text-center">When&apos;s your birthday?</h1>
            <p className="text-white/70 text-sm text-center mb-8">
              Your age is shown on your profile. Your date of birth stays private and can&apos;t be changed later.
            </p>

            <label htmlFor="age-gate-birthdate" className="block text-xs font-bold text-white/60 uppercase tracking-wider mb-2">
              Date of birth
            </label>
            <input
              id="age-gate-birthdate"
              type="date"
              required
              max={todayIso()}
              value={birthdate}
              onChange={(e) => setBirthdate(e.target.value)}
              aria-invalid={Boolean(error)}
              aria-describedby={error ? 'age-gate-error' : undefined}
              className="w-full min-h-[48px] rounded-2xl bg-zinc-900 border border-white/15 px-4 text-base text-white [color-scheme:dark] focus:outline-none focus:ring-2 focus:ring-pink-500"
            />
            {error ? (
              <p id="age-gate-error" className="mt-2 text-sm text-red-400" role="alert">
                {error}
              </p>
            ) : null}

            <button
              type="submit"
              disabled={busy}
              className="mt-6 w-full min-h-[48px] rounded-2xl bg-gradient-to-r from-pink-600 to-rose-600 text-sm font-bold text-white shadow-md disabled:opacity-60"
            >
              {busy ? 'Saving…' : 'Continue'}
            </button>
            <button
              type="button"
              onClick={onSignOut}
              className="mt-3 w-full min-h-[44px] text-sm text-white/60"
            >
              Sign out
            </button>
          </form>
        )}
      </div>
    </div>
  );
};

export default AgeGatePage;

import React, { useState, useEffect, useCallback } from 'react';

export type LandingAuthMode = 'signIn' | 'signUp';

interface LandingPageProps {
  onEmailAuth: (
    email: string,
    password: string,
    mode: LandingAuthMode
  ) => Promise<{ error?: string; info?: string } | void>;
  onAnonymousAuth: () => Promise<{ error?: string } | void>;
}

const CAROUSEL_IMAGES = [
  '/carousel/slide1.jpg',
  '/carousel/slide2.jpg',
  '/carousel/slide3.jpg',
  '/carousel/slide4.jpg',
  '/carousel/slide5.jpg',
];

const CAROUSEL_INTERVAL_MS = 4500;
const SIGNUP_ATTEMPT_KEY = 'zongo_signup_attempts_v1';

function envBool(value: string | undefined, fallback: boolean): boolean {
  if (!value) return fallback;
  const v = value.trim().toLowerCase();
  return v === '1' || v === 'true' || v === 'yes' || v === 'on';
}

function envNumber(value: string | undefined, fallback: number): number {
  if (!value) return fallback;
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return fallback;
  return parsed;
}

function readSignupAttemptsMs(nowMs: number, windowMs: number): number[] {
  try {
    const raw = localStorage.getItem(SIGNUP_ATTEMPT_KEY);
    const parsed = raw ? (JSON.parse(raw) as number[]) : [];
    if (!Array.isArray(parsed)) return [];
    const filtered = parsed.filter((ts) => Number.isFinite(ts) && nowMs - Number(ts) <= windowMs);
    if (filtered.length !== parsed.length) {
      localStorage.setItem(SIGNUP_ATTEMPT_KEY, JSON.stringify(filtered));
    }
    return filtered;
  } catch {
    return [];
  }
}

function pushSignupAttempt(nowMs: number, windowMs: number) {
  const existing = readSignupAttemptsMs(nowMs, windowMs);
  existing.push(nowMs);
  try {
    localStorage.setItem(SIGNUP_ATTEMPT_KEY, JSON.stringify(existing.slice(-50)));
  } catch {
    // Ignore storage write issues in private mode.
  }
}

function isDisposableDomain(email: string): boolean {
  const domain = (email.split('@')[1] ?? '').trim().toLowerCase();
  if (!domain) return false;
  return (
    domain.endsWith('mailinator.com') ||
    domain.endsWith('10minutemail.com') ||
    domain.endsWith('guerrillamail.com') ||
    domain.endsWith('tempmail.com') ||
    domain.endsWith('trashmail.com')
  );
}

const LandingPage: React.FC<LandingPageProps> = ({ onEmailAuth, onAnonymousAuth }) => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [info, setInfo] = useState('');
  const [showForm, setShowForm] = useState(false);
  const [carouselIndex, setCarouselIndex] = useState(0);
  const [authMode, setAuthMode] = useState<LandingAuthMode>('signIn');
  const [busy, setBusy] = useState(false);
  const [challengeQuestion, setChallengeQuestion] = useState('');
  const [challengeAnswer, setChallengeAnswer] = useState('');
  const [challengeExpected, setChallengeExpected] = useState('');

  const signupChallengeEnabled = envBool(import.meta.env.VITE_SIGNUP_CHALLENGE_ENABLED, true);
  const signupChallengeAlways = envBool(import.meta.env.VITE_SIGNUP_CHALLENGE_ALWAYS, false);
  const signupRiskThreshold = Math.max(1, Math.round(envNumber(import.meta.env.VITE_SIGNUP_RISK_ATTEMPTS_THRESHOLD, 3)));
  const signupRiskWindowMin = Math.max(1, Math.round(envNumber(import.meta.env.VITE_SIGNUP_RISK_WINDOW_MINUTES, 10)));

  const needsSignupChallenge = (() => {
    if (!signupChallengeEnabled || authMode !== 'signUp') return false;
    if (signupChallengeAlways) return true;
    const now = Date.now();
    const attempts = readSignupAttemptsMs(now, signupRiskWindowMin * 60_000);
    if (attempts.length >= signupRiskThreshold) return true;
    if (isDisposableDomain(email)) return true;
    return false;
  })();

  const regenerateChallenge = useCallback(() => {
    const left = Math.floor(Math.random() * 9) + 1;
    const right = Math.floor(Math.random() * 9) + 1;
    setChallengeQuestion(`${left} + ${right}`);
    setChallengeExpected(String(left + right));
    setChallengeAnswer('');
  }, []);

  useEffect(() => {
    const id = setInterval(() => {
      setCarouselIndex((i) => (i + 1) % CAROUSEL_IMAGES.length);
    }, CAROUSEL_INTERVAL_MS);
    return () => clearInterval(id);
  }, []);

  useEffect(() => {
    if (needsSignupChallenge) {
      if (!challengeExpected) regenerateChallenge();
      return;
    }
    setChallengeQuestion('');
    setChallengeExpected('');
    setChallengeAnswer('');
  }, [needsSignupChallenge, challengeExpected, regenerateChallenge]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setInfo('');
    if (!email.trim()) {
      setError('Please enter your email');
      return;
    }
    if (!password || password.length < 6) {
      setError('Password must be at least 6 characters');
      return;
    }
    if (needsSignupChallenge) {
      if (!challengeAnswer.trim()) {
        setError('Please complete the signup challenge.');
        return;
      }
      if (challengeAnswer.trim() !== challengeExpected) {
        setError('Challenge answer is incorrect. Please try again.');
        regenerateChallenge();
        return;
      }
    }
    setBusy(true);
    try {
      if (authMode === 'signUp') {
        pushSignupAttempt(Date.now(), signupRiskWindowMin * 60_000);
      }
      const result = await onEmailAuth(email.trim(), password, authMode);
      if (result?.error) setError(result.error);
      if (result?.info) setInfo(result.info);
    } finally {
      setBusy(false);
    }
  };

  const handleAnonymous = async () => {
    setError('');
    setInfo('');
    setBusy(true);
    try {
      const result = await onAnonymousAuth();
      if (result?.error) setError(result.error);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div
      className="min-h-[100dvh] bg-black text-white flex flex-col overflow-hidden relative w-full"
      style={{ minHeight: '100dvh' }}
    >
      <div className="absolute inset-0">
        {CAROUSEL_IMAGES.map((src, i) => (
          <div
            key={src}
            className="absolute inset-0 transition-opacity duration-700 ease-out"
            style={{
              opacity: i === carouselIndex ? 1 : 0,
              zIndex: i === carouselIndex ? 1 : 0,
            }}
          >
            <img src={src} alt="" className="w-full h-full object-cover" />
            <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/30 to-transparent" />
          </div>
        ))}
        <div
          className="absolute left-0 right-0 z-10 flex justify-center gap-1"
          style={{ bottom: 'calc(5.5rem + env(safe-area-inset-bottom, 0px))' }}
        >
          {CAROUSEL_IMAGES.map((_, i) => (
            <button
              key={i}
              type="button"
              aria-label={`Slide ${i + 1}`}
              onClick={() => setCarouselIndex(i)}
              className="p-2 -m-2 touch-manipulation"
            >
              <span
                className={`block h-1.5 rounded-full transition-all duration-300 ${
                  i === carouselIndex ? 'w-5 bg-white' : 'w-1.5 bg-white/50'
                }`}
              />
            </button>
          ))}
        </div>
      </div>

      <div
        className="relative z-10 flex flex-1 flex-col items-center justify-end px-4 min-h-[100dvh] w-full"
        style={{
          paddingBottom: 'max(1.5rem, env(safe-area-inset-bottom))',
        }}
      >
        {!showForm ? (
          <>
            <div className="flex-1 flex flex-col items-center justify-center w-full text-center px-2">
              <h1 className="text-3xl sm:text-4xl font-black bg-gradient-to-r from-pink-500 to-rose-400 bg-clip-text text-transparent tracking-tighter drop-shadow-lg">
                HEARTSYNC
              </h1>
              <p className="text-white/90 text-sm mt-2 font-medium">Find your connection</p>
            </div>
            <button
              type="button"
              onClick={() => setShowForm(true)}
              className="w-2/3 bg-gradient-to-r from-pink-500 to-rose-500 py-4 rounded-full font-bold text-white text-lg shadow-lg shadow-pink-900/40 active:scale-[0.98] transition-all hover:from-pink-600 hover:to-rose-600 touch-manipulation min-h-[48px]"
            >
              Login
            </button>
          </>
        ) : (
          <div className="w-full bg-black/90 backdrop-blur-sm rounded-2xl p-5 shadow-2xl border border-white/10 animate-in fade-in duration-300 max-h-[85dvh] overflow-y-auto">
            <div className="flex items-center justify-between mb-5">
              <h2 className="text-xl font-bold text-white">
                {authMode === 'signIn' ? 'Welcome back' : 'Create account'}
              </h2>
              <button
                type="button"
                onClick={() => setShowForm(false)}
                className="text-zinc-400 hover:text-white text-sm font-medium py-2 pr-2 -mr-2 min-h-[44px] min-w-[44px] flex items-center justify-end touch-manipulation"
              >
                Back
              </button>
            </div>

            <div className="flex rounded-xl bg-zinc-900 p-1 mb-4 border border-zinc-800">
              <button
                type="button"
                onClick={() => {
                  setAuthMode('signIn');
                  setError('');
                  setInfo('');
                }}
                className={`flex-1 rounded-lg py-2 text-sm font-bold transition-colors touch-manipulation min-h-[44px] ${
                  authMode === 'signIn' ? 'bg-pink-600 text-white' : 'text-zinc-400'
                }`}
              >
                Log in
              </button>
              <button
                type="button"
                onClick={() => {
                  setAuthMode('signUp');
                  setError('');
                  setInfo('');
                }}
                className={`flex-1 rounded-lg py-2 text-sm font-bold transition-colors touch-manipulation min-h-[44px] ${
                  authMode === 'signUp' ? 'bg-pink-600 text-white' : 'text-zinc-400'
                }`}
              >
                Sign up
              </button>
            </div>

            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-zinc-400 uppercase tracking-wider mb-2">Email</label>
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="you@example.com"
                  autoComplete="email"
                  className="w-full bg-zinc-900 border border-zinc-800 rounded-xl px-4 py-3 text-white placeholder-zinc-500 outline-none focus:border-pink-500 transition-colors"
                />
              </div>
              <div>
                <label className="block text-xs font-bold text-zinc-400 uppercase tracking-wider mb-2">Password</label>
                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Min 6 characters"
                  autoComplete={authMode === 'signIn' ? 'current-password' : 'new-password'}
                  className="w-full bg-zinc-900 border border-zinc-800 rounded-xl px-4 py-3 text-white placeholder-zinc-500 outline-none focus:border-pink-500 transition-colors"
                />
              </div>
              {needsSignupChallenge ? (
                <div className="rounded-xl border border-zinc-700/80 bg-zinc-900/70 p-3 space-y-2">
                  <div className="flex items-center justify-between gap-3">
                    <label className="text-xs font-bold text-zinc-300 uppercase tracking-wider">
                      Security challenge: {challengeQuestion}
                    </label>
                    <button
                      type="button"
                      onClick={regenerateChallenge}
                      className="text-[11px] text-pink-400 hover:text-pink-300"
                    >
                      New
                    </button>
                  </div>
                  <input
                    type="text"
                    inputMode="numeric"
                    value={challengeAnswer}
                    onChange={(e) => setChallengeAnswer(e.target.value.replace(/[^\d-]/g, '').slice(0, 6))}
                    placeholder="Type your answer"
                    autoComplete="off"
                    className="w-full bg-zinc-900 border border-zinc-800 rounded-xl px-4 py-3 text-white placeholder-zinc-500 outline-none focus:border-pink-500 transition-colors"
                  />
                  <p className="text-[11px] text-zinc-500">Shown when signup abuse risk is elevated.</p>
                </div>
              ) : null}
              {error && <p className="text-red-400 text-sm">{error}</p>}
              {info && <p className="text-emerald-400 text-sm">{info}</p>}
              <button
                type="submit"
                disabled={busy}
                className="w-full bg-gradient-to-r from-pink-500 to-rose-500 py-3 rounded-xl font-bold text-white shadow-lg shadow-pink-900/30 active:scale-[0.98] transition-all touch-manipulation min-h-[48px] disabled:opacity-60"
              >
                {busy ? 'Please wait…' : authMode === 'signIn' ? 'Log in' : 'Sign up'}
              </button>
            </form>

            <div className="flex items-center gap-4 my-5">
              <div className="flex-1 h-px bg-zinc-800" />
              <span className="text-zinc-500 text-xs font-medium">or</span>
              <div className="flex-1 h-px bg-zinc-800" />
            </div>

            <button
              type="button"
              disabled={busy}
              onClick={() => void handleAnonymous()}
              className="w-full flex items-center justify-center gap-3 bg-white text-zinc-900 py-3 rounded-xl font-bold border border-zinc-200 active:scale-[0.98] transition-all touch-manipulation min-h-[48px] disabled:opacity-60"
            >
              <svg className="w-5 h-5 text-zinc-700" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
                <path strokeLinecap="round" strokeLinejoin="round" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
              </svg>
              Continue as guest
            </button>
            <p className="text-center text-zinc-500 text-[11px] mt-2 px-1">
              Guest mode uses the same wallet, gifts, and payouts as other accounts. Use email above if you may switch devices—guest sessions are harder to recover.
            </p>

            <p className="text-center text-zinc-500 text-xs mt-6">
              By signing up, you agree to our Terms of Service and Privacy Policy
            </p>
          </div>
        )}
      </div>
    </div>
  );
};

export default LandingPage;

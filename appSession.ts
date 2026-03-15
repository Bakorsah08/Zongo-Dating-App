/**
 * App user session - separate from admin auth.
 * Persists signup state and gender selection for the dating app.
 */
const STORAGE_KEY = 'zongo_app_session';

export type AppUserGender = 'male' | 'female';

export interface AppSession {
  email: string;
  gender?: AppUserGender; // Set after signup
}

export function getAppSession(): AppSession | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    return JSON.parse(raw) as AppSession;
  } catch {
    return null;
  }
}

export function setAppSession(session: AppSession) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(session));
}

export function setAppSessionEmail(email: string) {
  setAppSession({ email });
}

export function setAppSessionGender(gender: AppUserGender) {
  const current = getAppSession();
  if (!current) return;
  setAppSession({ email: current.email, gender });
}

export function clearAppSession() {
  localStorage.removeItem(STORAGE_KEY);
}

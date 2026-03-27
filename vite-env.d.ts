/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_SUPABASE_URL?: string;
  readonly VITE_SUPABASE_ANON_KEY?: string;
  readonly VITE_APP_URL?: string;
  readonly VITE_MONITORING_ENDPOINT?: string;
  readonly VITE_MONITORING_INGEST_KEY?: string;
  readonly VITE_MONITORING_ALERT_THRESHOLD?: string;
  readonly VITE_MONITORING_ALERT_WINDOW_MS?: string;
  readonly VITE_SIGNUP_CHALLENGE_ENABLED?: string;
  readonly VITE_SIGNUP_CHALLENGE_ALWAYS?: string;
  readonly VITE_SIGNUP_RISK_ATTEMPTS_THRESHOLD?: string;
  readonly VITE_SIGNUP_RISK_WINDOW_MINUTES?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}

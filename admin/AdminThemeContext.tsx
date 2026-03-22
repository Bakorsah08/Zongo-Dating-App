import React, { createContext, useCallback, useContext, useMemo, useState } from 'react';

export type AdminTheme = 'light' | 'dark';

const STORAGE_KEY = 'zongo_admin_theme';

function readStoredTheme(): AdminTheme {
  try {
    const v = localStorage.getItem(STORAGE_KEY);
    if (v === 'light' || v === 'dark') return v;
  } catch {
    /* ignore */
  }
  return 'dark';
}

interface AdminThemeContextValue {
  theme: AdminTheme;
  setTheme: (t: AdminTheme) => void;
  toggleTheme: () => void;
}

const AdminThemeContext = createContext<AdminThemeContextValue | null>(null);

export function AdminThemeProvider({ children }: { children: React.ReactNode }) {
  const [theme, setThemeState] = useState<AdminTheme>(() => readStoredTheme());

  const setTheme = useCallback((t: AdminTheme) => {
    setThemeState(t);
    try {
      localStorage.setItem(STORAGE_KEY, t);
    } catch {
      /* ignore */
    }
  }, []);

  const toggleTheme = useCallback(() => {
    setTheme(theme === 'dark' ? 'light' : 'dark');
  }, [theme, setTheme]);

  const value = useMemo(
    () => ({ theme, setTheme, toggleTheme }),
    [theme, setTheme, toggleTheme]
  );

  return (
    <AdminThemeContext.Provider value={value}>
      <div className={theme === 'dark' ? 'dark min-h-screen' : 'min-h-screen'}>{children}</div>
    </AdminThemeContext.Provider>
  );
}

export function useAdminTheme(): AdminThemeContextValue {
  const ctx = useContext(AdminThemeContext);
  if (!ctx) {
    throw new Error('useAdminTheme must be used within AdminThemeProvider');
  }
  return ctx;
}

/** Theme toggle for sidebar / login — does not require throwing if used outside provider. */
export function AdminThemeToggle() {
  const ctx = useContext(AdminThemeContext);
  if (!ctx) return null;
  const { theme, setTheme } = ctx;
  return (
    <div className="rounded-xl border border-zinc-200 bg-zinc-50 p-1 dark:border-zinc-700 dark:bg-zinc-800/50">
      <div className="grid grid-cols-2 gap-0.5">
        <button
          type="button"
          onClick={() => setTheme('light')}
          className={`rounded-lg px-3 py-2 text-xs font-bold transition-colors ${
            theme === 'light'
              ? 'bg-white text-zinc-900 shadow-sm dark:bg-zinc-700 dark:text-white'
              : 'text-zinc-600 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-white'
          }`}
        >
          Light
        </button>
        <button
          type="button"
          onClick={() => setTheme('dark')}
          className={`rounded-lg px-3 py-2 text-xs font-bold transition-colors ${
            theme === 'dark'
              ? 'bg-zinc-700 text-white dark:bg-zinc-600'
              : 'text-zinc-600 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-white'
          }`}
        >
          Dark
        </button>
      </div>
    </div>
  );
}

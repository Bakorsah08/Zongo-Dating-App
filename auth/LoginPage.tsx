import React, { useState } from 'react';
import { Link, Navigate, useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from './useAuth';
import { backButtonClassName, backButtonLightClassName, BackChevron } from '../components/BackButton';
import { AdminThemeToggle, useAdminTheme } from '../admin/AdminThemeContext';

const LoginPage: React.FC = () => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const { login, isAuthenticated } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const { theme } = useAdminTheme();

  const from = (location.state as { from?: { pathname: string } })?.from?.pathname ?? '/admin';

  if (isAuthenticated) {
    return <Navigate to={from} replace />;
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    const result = await login(email, password);
    setLoading(false);
    if (result.success) {
      navigate(from, { replace: true });
    } else {
      setError(result.error ?? 'Login failed');
    }
  };

  return (
    <div className="min-h-screen bg-zinc-100 dark:bg-zinc-950 flex items-center justify-center p-6">
      <div className="w-full max-w-sm">
        <div className="mb-8 space-y-4">
          <div className="flex justify-center">
            <div className="w-full max-w-[200px]">
              <AdminThemeToggle />
            </div>
          </div>
          <div className="text-center">
            <h1 className="text-2xl font-black bg-gradient-to-r from-rose-500 to-pink-500 bg-clip-text text-transparent">
              Zongo Admin
            </h1>
            <p className="text-zinc-500 text-sm mt-1">Sign in to manage your dating app</p>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-2xl p-6 space-y-4">
          {error && (
            <div className="p-3 rounded-xl bg-red-500/10 border border-red-500/30 text-red-400 text-sm">
              {error}
            </div>
          )}
          <div>
            <label className="block text-zinc-500 text-sm mb-1.5 font-medium">Email</label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="admin@zongo.com"
              required
              autoComplete="email"
              className="w-full px-4 py-3 bg-zinc-200 dark:bg-zinc-800 border border-zinc-300 dark:border-zinc-700 rounded-xl text-zinc-900 dark:text-white placeholder-zinc-400 dark:placeholder-zinc-500 focus:outline-none focus:border-rose-500"
            />
          </div>
          <div>
            <label className="block text-zinc-500 text-sm mb-1.5 font-medium">Password</label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
              required
              autoComplete="current-password"
              className="w-full px-4 py-3 bg-zinc-200 dark:bg-zinc-800 border border-zinc-300 dark:border-zinc-700 rounded-xl text-zinc-900 dark:text-white placeholder-zinc-400 dark:placeholder-zinc-500 focus:outline-none focus:border-rose-500"
            />
          </div>
          <button
            type="submit"
            disabled={loading}
            className="w-full py-3 bg-rose-600 hover:bg-rose-500 disabled:opacity-50 disabled:cursor-not-allowed text-white font-bold rounded-xl transition-colors"
          >
            {loading ? 'Signing in...' : 'Sign in'}
          </button>
        </form>

        <p className="text-center text-zinc-600 text-xs mt-6">
          Use a Supabase Auth user that has a row in <code>admin_roles</code>.
        </p>
        <div className="flex justify-center mt-6">
          <Link
            to="/"
            aria-label="Back to app"
            className={theme === 'light' ? backButtonLightClassName : backButtonClassName}
          >
            <BackChevron className={theme === 'light' ? 'text-zinc-900' : undefined} />
          </Link>
        </div>
      </div>
    </div>
  );
};

export default LoginPage;

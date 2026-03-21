import React from 'react';
import { Link, Outlet, useLocation, useNavigate } from 'react-router-dom';
import { adminStore } from './store';
import { useAuthContext } from '../auth/AuthContext';
import type { Permission } from '../auth/types';
import { backButtonClassName, BackChevron } from '../components/BackButton';

const navItems: { path: string; label: string; icon: string; permission: Permission }[] = [
  { path: '/admin', label: 'Dashboard', icon: '📊', permission: 'view_dashboard' },
  { path: '/admin/ads', label: 'Ad centre', icon: '📣', permission: 'manage_explore_ads' },
  { path: '/admin/monetization', label: 'Monetization', icon: '💰', permission: 'manage_monetization' },
  { path: '/admin/payout', label: 'Payout', icon: '🏦', permission: 'manage_monetization' },
  { path: '/admin/users', label: 'Users', icon: '👥', permission: 'manage_users' },
  { path: '/admin/badges', label: 'Badges', icon: '🏅', permission: 'manage_badges' },
  { path: '/admin/tokens', label: 'Token Packages', icon: '💎', permission: 'manage_tokens' },
  { path: '/admin/gifts', label: 'Gifts', icon: '🎁', permission: 'manage_gifts' },
  { path: '/admin/admins', label: 'Admins', icon: '🔐', permission: 'manage_admins' },
];

const AdminLayout: React.FC = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const { session, logout, hasPermission } = useAuthContext();

  const filteredNavItems = navItems.filter((item) => hasPermission(item.permission));

  const handleLogout = () => {
    logout();
    navigate('/admin/login', { replace: true });
  };

  return (
    <div className="min-h-screen bg-zinc-950 text-white flex">
      {/* Sidebar */}
      <aside className="w-64 bg-zinc-900 border-r border-zinc-800 flex flex-col">
        <div className="p-6 border-b border-zinc-800">
          <Link to="/" aria-label="Back to app" className={`${backButtonClassName} mb-3`}>
            <BackChevron />
          </Link>
          <h1 className="text-xl font-black bg-gradient-to-r from-rose-500 to-pink-500 bg-clip-text text-transparent">
            Zongo Admin
          </h1>
          <p className="text-[10px] text-zinc-500 uppercase tracking-wider mt-1">Super Admin Dashboard</p>
          {session && (
            <div className="mt-3 pt-3 border-t border-zinc-800">
              <p className="text-xs text-zinc-400 truncate">{session.user.email}</p>
              <p className="text-[10px] text-zinc-600 capitalize">{session.user.role.replace('_', ' ')}</p>
            </div>
          )}
        </div>
        <nav className="flex-1 p-4 space-y-1">
          {filteredNavItems.map((item) => {
            const isActive = location.pathname === item.path || (item.path !== '/admin' && location.pathname.startsWith(item.path));
            return (
              <Link
                key={item.path}
                to={item.path}
                className={`flex items-center gap-3 px-4 py-3 rounded-xl transition-all ${
                  isActive ? 'bg-rose-600/20 text-rose-400 border border-rose-500/30' : 'text-zinc-400 hover:bg-zinc-800 hover:text-white'
                }`}
              >
                <span className="text-lg">{item.icon}</span>
                <span className="font-medium">{item.label}</span>
              </Link>
            );
          })}
        </nav>
        <div className="p-4 border-t border-zinc-800 space-y-2">
          {hasPermission('reset_data') && (
            <button
              onClick={() => { if (confirm('Reset all data to defaults?')) adminStore.resetToDefaults(); window.location.reload(); }}
              className="w-full text-left px-4 py-2 text-xs text-zinc-500 hover:text-amber-400 rounded-lg hover:bg-zinc-800 transition-colors"
            >
              Reset to defaults
            </button>
          )}
          <button
            onClick={handleLogout}
            className="w-full text-left px-4 py-2 text-xs text-zinc-500 hover:text-red-400 rounded-lg hover:bg-zinc-800 transition-colors"
          >
            Sign out
          </button>
          <p className="text-[10px] text-zinc-600">Powered by Zongo</p>
        </div>
      </aside>

      {/* Main content */}
      <main className="flex-1 overflow-auto">
        <Outlet />
      </main>
    </div>
  );
};

export default AdminLayout;

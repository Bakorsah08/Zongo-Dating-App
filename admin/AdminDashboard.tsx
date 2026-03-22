import React from 'react';
import { Link } from 'react-router-dom';
import { adminStore } from './store';

const AdminDashboard: React.FC = () => {
  const users = adminStore.getUsers();
  const badges = adminStore.getBadges();
  const tokenPackages = adminStore.getTokenPackages();
  const gifts = adminStore.getGifts();
  const monetization = adminStore.getMonetizationSettings();
  const tokenSalesRevenue = adminStore.getPlatformRevenueFromTokenSales();

  const totalUsers = users.length;
  const onlineUsers = users.filter((u) => u.isOnline).length;
  const liveUsers = users.filter((u) => u.isLive).length;
  const creatorEarnings = users.reduce((sum, u) => sum + (u.earnings || 0), 0);
  const vipUsers = users.filter((u) => u.badgeTier && u.badgeTier !== 'none').length;

  // Platform's cut from gifts: creators get X%, platform gets (100-X)%. Total gift value = creatorEarnings / (share/100)
  const creatorShare = monetization.creatorRevenueSharePercent || 70;
  const platformFromGifts = creatorShare < 100
    ? creatorEarnings * (100 - creatorShare) / creatorShare
    : 0;
  const totalPlatformRevenue = tokenSalesRevenue + platformFromGifts;

  const stats = [
    { label: 'Total Users', value: totalUsers, icon: '👥', color: 'from-blue-500 to-cyan-500', link: '/admin/users' },
    { label: 'Online Now', value: onlineUsers, icon: '🟢', color: 'from-emerald-500 to-green-500', link: '/admin/users' },
    { label: 'Live Streams', value: liveUsers, icon: '📺', color: 'from-rose-500 to-pink-500', link: '/admin/users' },
    { label: 'VIP Users', value: vipUsers, icon: '👑', color: 'from-amber-500 to-yellow-500', link: '/admin/users' },
    { label: 'Creator Earnings', value: `$${creatorEarnings.toLocaleString()}`, icon: '💸', color: 'from-violet-500 to-purple-500', link: '/admin/users' },
    { label: 'Badges', value: badges.length, icon: '🏅', color: 'from-orange-500 to-red-500', link: '/admin/badges' },
    { label: 'Token Packages', value: tokenPackages.length, icon: '💎', color: 'from-sky-500 to-blue-500', link: '/admin/tokens' },
    { label: 'Gifts', value: gifts.length, icon: '🎁', color: 'from-pink-500 to-rose-500', link: '/admin/gifts' },
  ];

  return (
    <div className="p-8">
      <div className="mb-8">
        <h1 className="text-3xl font-black text-zinc-900 dark:text-white">Dashboard</h1>
        <p className="text-zinc-500 mt-1">Overview of your Zongo Dating App</p>
      </div>

      <div className="-mx-2 overflow-x-auto px-2 pb-1 sm:mx-0 sm:px-0 lg:overflow-visible lg:pb-0">
        <div className="flex min-w-max gap-3 lg:min-w-0 lg:grid lg:w-full lg:grid-cols-8 lg:gap-4">
          {stats.map((stat) => (
            <Link
              key={stat.label}
              to={stat.link}
              className="block w-[9.25rem] shrink-0 group lg:w-auto lg:min-w-0 lg:shrink"
            >
              <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-2xl p-4 lg:p-5 hover:border-zinc-400 dark:hover:border-zinc-700 transition-all group-hover:scale-[1.02]">
                <div className="mb-4 flex items-center justify-between lg:mb-5">
                  <span className="text-2xl lg:text-3xl">{stat.icon}</span>
                  <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded-md bg-gradient-to-r sm:text-xs sm:px-2 sm:py-1 sm:rounded-lg ${stat.color} text-white`}>
                    View
                  </span>
                </div>
                <p className="text-lg font-black text-zinc-900 dark:text-white lg:text-xl xl:text-2xl">{stat.value}</p>
                <p className="mt-1 line-clamp-2 text-xs text-zinc-500 lg:text-sm">{stat.label}</p>
              </div>
            </Link>
          ))}
        </div>
      </div>

      <div className="mt-8 grid grid-cols-1 gap-6 lg:grid-cols-2 lg:items-stretch">
        {/* Your Revenue - App Owner */}
        <div className="flex h-full min-h-0 flex-col p-6 bg-gradient-to-br from-emerald-900/30 to-green-900/20 border border-emerald-700/50 rounded-2xl">
          <h2 className="mb-4 flex items-center gap-2 text-lg font-bold text-zinc-900 dark:text-white">
            <span>💰</span> Your Revenue (Platform)
          </h2>
          <div className="grid flex-1 grid-cols-1 gap-6 sm:grid-cols-3">
            <div>
              <p className="mb-1 text-xs font-bold uppercase text-zinc-500">From Token Sales</p>
              <p className="text-2xl font-black text-zinc-900 dark:text-white">${tokenSalesRevenue.toLocaleString(undefined, { minimumFractionDigits: 2 })}</p>
              <p className="mt-1 text-xs text-zinc-500">When users buy token packages</p>
            </div>
            <div>
              <p className="mb-1 text-xs font-bold uppercase text-zinc-500">From Gifts (Platform Cut)</p>
              <p className="text-2xl font-black text-zinc-900 dark:text-white">${platformFromGifts.toLocaleString(undefined, { minimumFractionDigits: 2 })}</p>
              <p className="mt-1 text-xs text-zinc-500">Your {100 - creatorShare}% of gift value (creators get {creatorShare}%)</p>
            </div>
            <div>
              <p className="mb-1 text-xs font-bold uppercase text-zinc-500">Total Revenue</p>
              <p className="text-3xl font-black text-zinc-900 dark:text-emerald-400">${totalPlatformRevenue.toLocaleString(undefined, { minimumFractionDigits: 2 })}</p>
              <p className="mt-1 text-xs text-zinc-500">Total you&apos;ve made as app owner</p>
            </div>
          </div>
        </div>

        {/* Monetization summary */}
        <Link
          to="/admin/monetization"
          className="group flex h-full min-h-0 flex-col p-6 bg-gradient-to-br from-rose-900/20 to-pink-900/20 border border-rose-800/50 rounded-2xl transition-all hover:border-rose-700"
        >
          <h2 className="mb-4 flex items-center gap-2 text-lg font-bold text-zinc-900 dark:text-white">
            <span>💰</span> Monetization Settings
          </h2>
          <div className="grid min-w-0 flex-1 grid-cols-4 gap-2 sm:gap-4">
            <div className="min-w-0">
              <p className="text-[10px] font-bold uppercase leading-tight text-zinc-500 sm:text-xs">Starter tokens</p>
              <p className="truncate text-[1.75rem] font-bold leading-tight text-zinc-900 dark:text-white">
                {monetization.starterTokens}
              </p>
            </div>
            <div className="min-w-0">
              <p className="text-[10px] font-bold uppercase leading-tight text-zinc-500 sm:text-xs">Live entry</p>
              <p className="truncate text-[1.75rem] font-bold leading-tight text-zinc-900 dark:text-white">
                💎 {monetization.liveStreamEntryTokens}
              </p>
            </div>
            <div className="min-w-0">
              <p className="text-[10px] font-bold uppercase leading-tight text-zinc-500 sm:text-xs">Video call</p>
              <p className="truncate text-[1.75rem] font-bold leading-tight text-zinc-900 dark:text-white">
                💎 {monetization.videoCallTokens}
              </p>
            </div>
            <div className="min-w-0">
              <p className="text-[10px] font-bold uppercase leading-tight text-zinc-500 sm:text-xs">Super Like</p>
              <p className="truncate text-[1.75rem] font-bold leading-tight text-zinc-900 dark:text-white">
                💎 {monetization.superLikeTokens}
              </p>
            </div>
          </div>
          <p className="mt-3 text-xs text-zinc-500">
            Live: {monetization.liveStreamingEnabled ? 'On' : 'Off'} · Gifts: {monetization.giftingEnabled ? 'On' : 'Off'} · Video: {monetization.videoCallEnabled ? 'On' : 'Off'} · VIP: {monetization.vipBadgesEnabled ? 'On' : 'Off'}
          </p>
          <span className="mt-auto inline-block pt-2 text-sm font-medium text-rose-400 group-hover:underline">Edit monetization →</span>
        </Link>
      </div>

      <div className="mt-12 grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-2xl p-6">
          <h2 className="text-lg font-bold text-zinc-900 dark:text-white mb-4">Recent Users</h2>
          <div className="space-y-3">
            {users.slice(0, 5).map((u) => (
              <div key={u.id} className="flex items-center gap-4 p-3 rounded-xl bg-zinc-100 dark:bg-zinc-800/50">
                <img src={u.avatar} alt="" className="w-10 h-10 rounded-full object-cover" />
                <div className="flex-1 min-w-0">
                  <p className="font-medium truncate text-zinc-900 dark:text-white">{u.name}</p>
                  <p className="text-xs text-zinc-500">{u.badgeTier || 'No badge'} • {u.isOnline ? 'Online' : 'Offline'}</p>
                </div>
                <Link to={`/admin/users?edit=${u.id}`} className="text-rose-500 text-sm font-medium hover:underline">Edit</Link>
              </div>
            ))}
          </div>
          <Link to="/admin/users" className="block mt-4 text-center text-rose-500 text-sm font-medium hover:underline">View all users →</Link>
        </div>

        <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-2xl p-6">
          <h2 className="text-lg font-bold text-zinc-900 dark:text-white mb-4">Quick Actions</h2>
          <div className="space-y-3">
            <Link to="/admin/users" className="block p-4 rounded-xl bg-zinc-100 dark:bg-zinc-800/50 hover:bg-zinc-200 dark:hover:bg-zinc-800 border border-zinc-200 dark:border-zinc-700/50 transition-colors">
              <span className="font-medium text-zinc-900 dark:text-white">➕ Add New User</span>
              <p className="text-xs text-zinc-500 mt-1">Create a new user account</p>
            </Link>
            <Link to="/admin/tokens" className="block p-4 rounded-xl bg-zinc-100 dark:bg-zinc-800/50 hover:bg-zinc-200 dark:hover:bg-zinc-800 border border-zinc-200 dark:border-zinc-700/50 transition-colors">
              <span className="font-medium text-zinc-900 dark:text-white">💎 Add Token Package</span>
              <p className="text-xs text-zinc-500 mt-1">Create a new token purchase option</p>
            </Link>
            <Link to="/admin/gifts" className="block p-4 rounded-xl bg-zinc-100 dark:bg-zinc-800/50 hover:bg-zinc-200 dark:hover:bg-zinc-800 border border-zinc-200 dark:border-zinc-700/50 transition-colors">
              <span className="font-medium text-zinc-900 dark:text-white">🎁 Add Gift</span>
              <p className="text-xs text-zinc-500 mt-1">Add a new gift for live streams</p>
            </Link>
            <Link to="/admin/monetization" className="block p-4 rounded-xl bg-zinc-100 dark:bg-zinc-800/50 hover:bg-zinc-200 dark:hover:bg-zinc-800 border border-zinc-200 dark:border-zinc-700/50 transition-colors">
              <span className="font-medium text-zinc-900 dark:text-white">💰 Monetization</span>
              <p className="text-xs text-zinc-500 mt-1">Token costs & feature flags</p>
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
};

export default AdminDashboard;

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
        <h1 className="text-3xl font-black text-white">Dashboard</h1>
        <p className="text-zinc-500 mt-1">Overview of your Zongo Dating App</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {stats.map((stat) => (
          <Link
            key={stat.label}
            to={stat.link}
            className="block group"
          >
            <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-6 hover:border-zinc-700 transition-all group-hover:scale-[1.02]">
              <div className="flex items-center justify-between mb-8">
                <span className="text-3xl">{stat.icon}</span>
                <span className={`text-xs font-bold px-2 py-1 rounded-lg bg-gradient-to-r ${stat.color} text-white`}>
                  View
                </span>
              </div>
              <p className="text-white text-2xl font-black">{stat.value}</p>
              <p className="text-zinc-500 text-sm mt-1">{stat.label}</p>
            </div>
          </Link>
        ))}
      </div>

      {/* Your Revenue - App Owner */}
      <div className="mt-8 p-6 bg-gradient-to-br from-emerald-900/30 to-green-900/20 border border-emerald-700/50 rounded-2xl">
        <h2 className="text-lg font-bold text-white mb-4 flex items-center gap-2">
          <span>💰</span> Your Revenue (Platform)
        </h2>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-6">
          <div>
            <p className="text-zinc-500 text-xs uppercase font-bold mb-1">From Token Sales</p>
            <p className="text-2xl font-black text-white">${tokenSalesRevenue.toLocaleString(undefined, { minimumFractionDigits: 2 })}</p>
            <p className="text-zinc-500 text-xs mt-1">When users buy token packages</p>
          </div>
          <div>
            <p className="text-zinc-500 text-xs uppercase font-bold mb-1">From Gifts (Platform Cut)</p>
            <p className="text-2xl font-black text-white">${platformFromGifts.toLocaleString(undefined, { minimumFractionDigits: 2 })}</p>
            <p className="text-zinc-500 text-xs mt-1">Your {100 - creatorShare}% of gift value (creators get {creatorShare}%)</p>
          </div>
          <div>
            <p className="text-zinc-500 text-xs uppercase font-bold mb-1">Total Revenue</p>
            <p className="text-3xl font-black text-emerald-400">${totalPlatformRevenue.toLocaleString(undefined, { minimumFractionDigits: 2 })}</p>
            <p className="text-zinc-500 text-xs mt-1">Total you&apos;ve made as app owner</p>
          </div>
        </div>
      </div>

      {/* Monetization summary */}
      <Link
        to="/admin/monetization"
        className="mt-8 block p-6 bg-gradient-to-br from-rose-900/20 to-pink-900/20 border border-rose-800/50 rounded-2xl hover:border-rose-700 transition-all group"
      >
        <h2 className="text-lg font-bold text-white mb-4 flex items-center gap-2">
          <span>💰</span> Monetization Settings
        </h2>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 text-sm">
          <div>
            <p className="text-zinc-500 text-xs uppercase font-bold">Starter tokens</p>
            <p className="text-white font-bold">{monetization.starterTokens}</p>
          </div>
          <div>
            <p className="text-zinc-500 text-xs uppercase font-bold">Live entry</p>
            <p className="text-white font-bold">💎 {monetization.liveStreamEntryTokens}</p>
          </div>
          <div>
            <p className="text-zinc-500 text-xs uppercase font-bold">Video call</p>
            <p className="text-white font-bold">💎 {monetization.videoCallTokens}</p>
          </div>
          <div>
            <p className="text-zinc-500 text-xs uppercase font-bold">Super Like</p>
            <p className="text-white font-bold">💎 {monetization.superLikeTokens}</p>
          </div>
        </div>
        <p className="text-zinc-500 text-xs mt-3">
          Live: {monetization.liveStreamingEnabled ? 'On' : 'Off'} · Gifts: {monetization.giftingEnabled ? 'On' : 'Off'} · Video: {monetization.videoCallEnabled ? 'On' : 'Off'} · VIP: {monetization.vipBadgesEnabled ? 'On' : 'Off'}
        </p>
        <span className="inline-block mt-2 text-rose-400 text-sm font-medium group-hover:underline">Edit monetization →</span>
      </Link>

      <div className="mt-12 grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-6">
          <h2 className="text-lg font-bold text-white mb-4">Recent Users</h2>
          <div className="space-y-3">
            {users.slice(0, 5).map((u) => (
              <div key={u.id} className="flex items-center gap-4 p-3 rounded-xl bg-zinc-800/50">
                <img src={u.avatar} alt="" className="w-10 h-10 rounded-full object-cover" />
                <div className="flex-1 min-w-0">
                  <p className="font-medium truncate">{u.name}</p>
                  <p className="text-xs text-zinc-500">{u.badgeTier || 'No badge'} • {u.isOnline ? 'Online' : 'Offline'}</p>
                </div>
                <Link to={`/admin/users?edit=${u.id}`} className="text-rose-500 text-sm font-medium hover:underline">Edit</Link>
              </div>
            ))}
          </div>
          <Link to="/admin/users" className="block mt-4 text-center text-rose-500 text-sm font-medium hover:underline">View all users →</Link>
        </div>

        <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-6">
          <h2 className="text-lg font-bold text-white mb-4">Quick Actions</h2>
          <div className="space-y-3">
            <Link to="/admin/users" className="block p-4 rounded-xl bg-zinc-800/50 hover:bg-zinc-800 border border-zinc-700/50 transition-colors">
              <span className="font-medium">➕ Add New User</span>
              <p className="text-xs text-zinc-500 mt-1">Create a new user account</p>
            </Link>
            <Link to="/admin/tokens" className="block p-4 rounded-xl bg-zinc-800/50 hover:bg-zinc-800 border border-zinc-700/50 transition-colors">
              <span className="font-medium">💎 Add Token Package</span>
              <p className="text-xs text-zinc-500 mt-1">Create a new token purchase option</p>
            </Link>
            <Link to="/admin/gifts" className="block p-4 rounded-xl bg-zinc-800/50 hover:bg-zinc-800 border border-zinc-700/50 transition-colors">
              <span className="font-medium">🎁 Add Gift</span>
              <p className="text-xs text-zinc-500 mt-1">Add a new gift for live streams</p>
            </Link>
            <Link to="/admin/monetization" className="block p-4 rounded-xl bg-zinc-800/50 hover:bg-zinc-800 border border-zinc-700/50 transition-colors">
              <span className="font-medium">💰 Monetization</span>
              <p className="text-xs text-zinc-500 mt-1">Token costs & feature flags</p>
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
};

export default AdminDashboard;

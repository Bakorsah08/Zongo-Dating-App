import React, { useState, useEffect } from 'react';
import { View, User, AppState } from './types';
import { getUsers, getBadges, getMonetizationSettings } from './data';
import { adminStore } from './admin/store';
import { getAppSession, setAppSession, setAppSessionGender, clearAppSession } from './appSession';
import DiscoverView from './components/DiscoverView';
import LandingPage from './components/LandingPage';
import GenderSelectPage from './components/GenderSelectPage';
import ChatListView from './components/ChatListView';
import ChatRoomView from './components/ChatRoomView';
import VideoCallView from './components/VideoCallView';
import LiveStreamView from './components/LiveStreamView';
import TokenShopView from './components/TokenShopView';
import Navbar from './components/Navbar';
import ProfileView from './components/ProfileView';
import UserDetailView from './components/UserDetailView';
import HomeMenuView from './components/HomeMenuView';
import CashOutView from './components/CashOutView';

const DEFAULT_ME: User = {
  id: 'me',
  name: 'James',
  age: 26,
  bio: 'Lover of tech and design. Looking for someone to explore the world with.',
  avatar: 'https://picsum.photos/seed/me/200',
  interests: ['Coding', 'Design', 'Travel'],
  location: 'New York',
  distance: 0,
  isOnline: true,
  album: ['https://picsum.photos/seed/me1/400/400', 'https://picsum.photos/seed/me2/400/400'],
  earnings: 0,
  transferredOut: 0,
  badgeTier: 'none',
};

const App: React.FC = () => {
  const [appSession, setAppSessionState] = useState<ReturnType<typeof getAppSession>>(getAppSession);

  useEffect(() => {
    setAppSessionState(getAppSession());
  }, []);

  const handleSignUp = (email: string, _password: string) => {
    setAppSession({ email });
    setAppSessionState(getAppSession());
  };

  const handleGoogleSignUp = () => {
    setAppSession({ email: 'user@gmail.com' });
    setAppSessionState(getAppSession());
  };

  const handleGenderSelect = (gender: 'male' | 'female') => {
    setAppSessionGender(gender);
    setAppSessionState(getAppSession());
  };

  const [state, setState] = useState<AppState>(() => {
    const users = getUsers();
    const meUser = users.find((u) => u.id === 'me');
    const currentUser = meUser ? { ...DEFAULT_ME, ...meUser } : DEFAULT_ME;
    if (!meUser) adminStore.addUser(currentUser);
    return {
      currentUser,
      tokens: getMonetizationSettings().starterTokens,
      matches: users.filter((u) => u.id !== 'me').slice(0, 2),
      followingIds: [],
      currentView: View.EXPLORE,
    };
  });
  const [isHomeMenuOpen, setIsHomeMenuOpen] = useState(false);
  const [showAccountMenu, setShowAccountMenu] = useState(false);

  const setView = (view: View) => {
    setShowAccountMenu(false);
    if (view === View.HOME) {
      setIsHomeMenuOpen(true);
    } else {
      setIsHomeMenuOpen(false); // Always close menu when navigating
      setState(prev => ({ ...prev, currentView: view }));
    }
  };

  const handleLogout = () => {
    setShowAccountMenu(false);
    clearAppSession();
    setAppSessionState(null);
  };
  
  const handleMenuAction = (viewToGo: View) => {
    setIsHomeMenuOpen(false);
    setTimeout(() => {
      setState(prev => ({ ...prev, currentView: viewToGo }));
    }, 200);
  };

  const openUserDetail = (user: User) => {
    setState(prev => ({
      ...prev,
      currentView: View.USER_DETAIL,
      selectedUserForDetail: user,
      profileReturnView: prev.currentView
    }));
  };

  const toggleFollow = (userId: string) => {
    setState(prev => ({
      ...prev,
      followingIds: prev.followingIds.includes(userId)
        ? prev.followingIds.filter(id => id !== userId)
        : [...prev.followingIds, userId]
    }));
  };

  const openChat = (user: User) => {
    const isAlreadyMatched = state.matches?.find(m => m.id === user.id);
    if (!isAlreadyMatched && !user.isAI) {
      setState(prev => ({ ...prev, matches: [...(prev.matches || []), user] }));
    }
    setState(prev => ({ ...prev, currentView: View.CHAT_ROOM, selectedChatPartner: user }));
  };

  const openLive = (user: User) => {
    const others = getUsers().filter(u => u.id !== user.id).slice(0, 4);
    setState(prev => ({
      ...prev,
      currentView: View.LIVE_STREAM,
      selectedLiveHost: user,
      liveStreamParticipants: [user, ...others]
    }));
  };

  const handleUpdateAlbum = (newAlbum: string[]) => {
    if (!state.currentUser) return;
    adminStore.updateUser(state.currentUser.id, { album: newAlbum });
    setState(prev => ({ ...prev, currentUser: { ...prev.currentUser, album: newAlbum } }));
  };
  
  const handleUpdateAvatar = (newAvatarUrl: string) => {
    if (!state.currentUser) return;
    adminStore.updateUser(state.currentUser.id, { avatar: newAvatarUrl });
    setState(prev => ({ ...prev, currentUser: { ...prev.currentUser, avatar: newAvatarUrl } }));
  };

  const handleUpdateProfile = (updates: Partial<User>) => {
    setState(prev => ({
      ...prev,
      currentUser: { ...prev.currentUser, ...updates }
    }));
    adminStore.updateUser('me', updates);
  };

  const handlePurchaseBadge = (tier: import('./types').BadgeTier): boolean => {
    const badge = getBadges().find((b) => b.id === tier);
    if (!badge || badge.tokenCost === 0) return false;
    if (state.tokens >= badge.tokenCost) {
      setState(prev => ({
        ...prev,
        tokens: prev.tokens - badge.tokenCost,
        currentUser: { ...prev.currentUser, badgeTier: tier }
      }));
      return true;
    }
    setView(View.TOKEN_SHOP);
    return false;
  };

  const deductTokens = (amount: number): boolean => {
    if (state.tokens && state.tokens >= amount) {
      setState(prev => ({ ...prev, tokens: (prev.tokens || 0) - amount }));
      return true;
    }
    setView(View.TOKEN_SHOP);
    return false;
  };

  const addTokens = (amount: number, priceUsd?: number) => {
    setState(prev => ({ ...prev, tokens: prev.tokens + amount }));
    if (priceUsd != null && priceUsd > 0) {
      adminStore.addPlatformRevenueFromTokenSales(priceUsd);
    }
  };

  const addEarnings = (amount: number) => {
    setState(prev => {
      const newEarnings = (prev.currentUser.earnings || 0) + amount;
      adminStore.updateUser('me', { earnings: newEarnings });
      return { ...prev, currentUser: { ...prev.currentUser, earnings: newEarnings } };
    });
  };
  
  const handleCashOut = (amount: number) => {
    if (!state.currentUser) return;
    const newEarnings = (state.currentUser.earnings ?? 0) - amount;
    const newTransferredOut = (state.currentUser.transferredOut ?? 0) + amount;
    adminStore.updateUser('me', { earnings: newEarnings, transferredOut: newTransferredOut });
    setState(prev => ({
      ...prev,
      currentUser: { ...prev.currentUser, earnings: newEarnings, transferredOut: newTransferredOut }
    }));
  };
  
  if (!state.currentUser) {
    return (
      <div className="flex flex-col min-h-screen bg-black text-white max-w-md mx-auto items-center justify-center">
        <div className="text-pink-500 text-4xl animate-bounce">❤</div>
        <p className="mt-4 font-bold tracking-widest uppercase">Loading Profile...</p>
      </div>
    );
  }

  if (!appSession) {
    return (
      <div className="min-h-screen bg-black flex justify-center">
        <div className="w-full max-w-md min-h-[100dvh] mx-auto relative overflow-hidden">
          <LandingPage onSignUp={handleSignUp} onGoogleSignUp={handleGoogleSignUp} />
        </div>
      </div>
    );
  }

  if (!appSession.gender) {
    return (
      <div className="min-h-screen bg-black flex justify-center">
        <div className="w-full max-w-md min-h-[100dvh] mx-auto relative overflow-hidden">
          <GenderSelectPage onSelect={handleGenderSelect} />
        </div>
      </div>
    );
  }

  const renderView = () => {
    switch (state.currentView) {
      case View.EXPLORE:
        return (
          <DiscoverView
            userGender={appSession.gender}
            onSelectUser={openUserDetail}
            onSelectLive={openLive}
            onGoLive={() => setView(View.HOST_LIVE)}
          />
        );
      case View.FOLLOWING: {
        const followingUsers = getUsers().filter(u => state.followingIds.includes(u.id));
        const badges = getBadges();
        return (
          <div className="min-h-full bg-white pb-24">
            <div className="px-4 pt-6 pb-4">
              <h1 className="text-xl font-bold text-zinc-900">People I&apos;m Following</h1>
            </div>
            {followingUsers.length > 0 ? (
              <div className="grid grid-cols-2 gap-0 w-full">
                {followingUsers.map((user) => (
                  <div
                    key={user.id}
                    onClick={() => openUserDetail(user)}
                    className="relative aspect-[3/4] overflow-hidden group cursor-pointer active:scale-[0.99] transition-transform"
                  >
                    <img
                      src={user.avatar}
                      alt={user.name}
                      className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                    />
                    <div className="absolute inset-0 bg-gradient-to-t from-black/75 via-transparent to-transparent" />
                    {user.isAI && (
                      <span className="absolute top-2 left-2 flex items-center gap-1 bg-black/40 backdrop-blur-md px-2 py-0.5 rounded-full text-[10px] font-semibold text-white">
                        <span className="text-xs">🤖</span> AI
                      </span>
                    )}
                    {user.isLive && (
                      <div className="absolute top-2 left-2 flex items-center gap-1.5 bg-red-500/90 backdrop-blur-md px-2.5 py-1 rounded-md text-[10px] font-bold text-white animate-pulse">
                        <span className="w-1.5 h-1.5 bg-white rounded-full" /> LIVE
                      </div>
                    )}
                    {!user.isAI && !user.isLive && (
                      <span className="absolute top-2 left-2 bg-white/25 backdrop-blur-md px-2 py-1 rounded-full text-[10px] font-semibold text-white shadow-sm">
                        {user.interests?.[0] || 'New'}
                      </span>
                    )}
                    {user.badgeTier && user.badgeTier !== 'none' && (
                      <div className="absolute top-2 right-2 text-[22px] drop-shadow-md" title={badges.find(b => b.id === user.badgeTier)?.name}>
                        {badges.find(b => b.id === user.badgeTier)?.icon}
                      </div>
                    )}
                    <div className="absolute bottom-3 left-3 right-3">
                      <h3 className="text-[1.3125rem] font-bold text-white drop-shadow-md">{user.name}, {user.age}</h3>
                      <p className="text-[10px] text-white/90 truncate drop-shadow-md mt-0.5">
                        {user.isAI ? 'AI Companion' : (user.isLive ? 'Tap to watch live' : `${user.distance} miles away`)}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <p className="px-4 text-sm text-zinc-500 mt-2">When you follow someone, they&apos;ll appear here.</p>
            )}
          </div>
        );
      }
      case View.CHATS:
        return <ChatListView matches={state.matches || []} onChatSelect={openChat} />;
      case View.CHAT_ROOM:
        return state.selectedChatPartner ? (
          <ChatRoomView 
            partner={state.selectedChatPartner} 
            onBack={() => setView(View.CHATS)}
            onVideoCall={() => setView(View.VIDEO_CALL)}
            onViewProfile={() => openUserDetail(state.selectedChatPartner!)}
          />
        ) : null;
      case View.VIDEO_CALL:
        return state.selectedChatPartner ? (
          <VideoCallView 
            partner={state.selectedChatPartner} 
            onEnd={() => setView(View.CHAT_ROOM)} 
            deductTokens={deductTokens}
            tokens={state.tokens!}
          />
        ) : null;
      case View.LIVE_STREAM: {
        const streamHost = state.selectedLiveHost || getUsers()[0];
        const participants = state.liveStreamParticipants?.length
          ? state.liveStreamParticipants
          : [streamHost];
        return (
          <LiveStreamView 
            host={streamHost}
            participants={participants}
            onEnd={() => setView(View.EXPLORE)} 
            deductTokens={deductTokens}
            onViewProfile={(user) => openUserDetail(user)}
            onSwitchMain={(user) => {
              const idx = participants.findIndex(p => p.id === user.id);
              if (idx >= 0) {
                const reordered = [participants[idx], ...participants.filter((_, i) => i !== idx)];
                setState(prev => ({ ...prev, liveStreamParticipants: reordered }));
              }
            }}
          />
        );
      }
      case View.HOST_LIVE: {
        const hostUser = state.currentUser;
        const participants = state.liveStreamParticipants?.length
          ? state.liveStreamParticipants
          : [hostUser];
        return (
          <LiveStreamView 
            isHost 
            host={hostUser} 
            participants={participants}
            onEnd={() => setState(prev => ({ ...prev, currentView: View.EXPLORE, liveStreamParticipants: undefined }))} 
            deductTokens={deductTokens} 
            onReceiveGift={addEarnings}
            onAddGuest={(user) => {
              const current = state.liveStreamParticipants || [hostUser];
              if (current.length < 5 && !current.find(p => p.id === user.id)) {
                setState(prev => ({
                  ...prev,
                  liveStreamParticipants: [...(prev.liveStreamParticipants || [hostUser]), user]
                }));
              }
            }}
            onSwitchMain={(user) => {
              const current = state.liveStreamParticipants || [hostUser];
              const idx = current.findIndex(p => p.id === user.id);
              if (idx >= 0) {
                const reordered = [current[idx], ...current.filter((_, i) => i !== idx)];
                setState(prev => ({ ...prev, liveStreamParticipants: reordered }));
              }
            }}
          />
        );
      }
      case View.TOKEN_SHOP:
        return <TokenShopView onBack={() => setView(View.EXPLORE)} currentTokens={state.tokens!} onPurchase={addTokens} />;
      case View.PROFILE:
        return (
          <ProfileView 
            user={state.currentUser} 
            tokens={state.tokens} 
            onGoShop={() => setView(View.TOKEN_SHOP)} 
            onUpdateAlbum={handleUpdateAlbum}
            onUpdateProfile={handleUpdateProfile}
            onPurchaseBadge={handlePurchaseBadge}
            onLogout={() => { clearAppSession(); setAppSessionState(null); }}
          />
        );
      case View.USER_DETAIL:
        return state.selectedUserForDetail ? (
          <UserDetailView 
            user={state.selectedUserForDetail} 
            onBack={() => setView(state.profileReturnView ?? View.EXPLORE)} 
            onChat={openChat} 
            onLive={openLive}
            deductTokens={deductTokens}
            onGoToTokenShop={() => setView(View.TOKEN_SHOP)}
            isFollowing={state.followingIds.includes(state.selectedUserForDetail.id)}
            onFollowToggle={() => toggleFollow(state.selectedUserForDetail!.id)}
          />
        ) : null;
      case View.CASH_OUT:
        return <CashOutView earnings={state.currentUser?.earnings || 0} onBack={() => {
          setState(prev => ({ ...prev, currentView: View.EXPLORE }));
          setIsHomeMenuOpen(true);
        }} onConfirmCashOut={handleCashOut} />;
      default:
        return (
          <DiscoverView
            userGender={appSession.gender}
            onSelectUser={openUserDetail}
            onSelectLive={openLive}
            onGoLive={() => setView(View.HOST_LIVE)}
          />
        );
    }
  };

  return (
    <div className="flex flex-col min-h-screen bg-black text-white max-w-md mx-auto relative border-x border-zinc-800 shadow-2xl overflow-hidden">
      {/* Top bar: account menu (Profile + Log out) so you can log out without opening Profile tab */}
      <div className="fixed top-0 left-0 right-0 max-w-md mx-auto z-[70] flex justify-end items-center h-14 px-4 bg-black/80 backdrop-blur-sm border-b border-zinc-800">
        <button
          type="button"
          onClick={() => setShowAccountMenu((open) => !open)}
          className="w-10 h-10 rounded-full flex items-center justify-center border border-zinc-700 text-zinc-300 hover:bg-zinc-800/80 hover:text-white transition-colors"
          aria-label="Account menu"
        >
          <svg xmlns="http://www.w3.org/2000/svg" width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="1"/><circle cx="12" cy="5" r="1"/><circle cx="12" cy="19" r="1"/></svg>
        </button>
        {showAccountMenu && (
          <>
            <div className="fixed inset-0 z-[69]" aria-hidden onClick={() => setShowAccountMenu(false)} />
            <div className="absolute top-full right-4 mt-2 w-48 py-2 rounded-xl bg-zinc-900 border border-zinc-700 shadow-xl z-[71]">
              <button
                type="button"
                onClick={() => { setView(View.PROFILE); setShowAccountMenu(false); }}
                className="w-full text-left px-4 py-3 text-sm font-medium text-zinc-200 hover:bg-zinc-800 hover:text-white transition-colors flex items-center gap-3"
              >
                <span className="text-lg">👤</span> Profile
              </button>
              <button
                type="button"
                onClick={handleLogout}
                className="w-full text-left px-4 py-3 text-sm font-medium text-red-400 hover:bg-zinc-800 hover:text-red-300 transition-colors flex items-center gap-3"
              >
                <span className="text-lg">🚪</span> Log out
              </button>
            </div>
          </>
        )}
      </div>

      <main className="flex-1 overflow-y-auto pb-20 pt-14">
        {renderView()}
      </main>

      <Navbar currentView={state.currentView} setView={setView} tokenCount={state.tokens} liveStreamingEnabled={getMonetizationSettings().liveStreamingEnabled} />
    </div>
  );
};

export default App;
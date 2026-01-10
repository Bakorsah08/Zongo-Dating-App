
import React, { useState, useEffect } from 'react';
import { View, User, AppState } from './types';
import * as db from './services/databaseService';
import DiscoverView from './components/DiscoverView';
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

const App: React.FC = () => {
  const [state, setState] = useState<Partial<AppState>>({
    tokens: 250,
    currentView: View.EXPLORE,
  });
  const [isHomeMenuOpen, setIsHomeMenuOpen] = useState(false);
  const [discoverUsers, setDiscoverUsers] = useState<User[]>([]);
  const [aiCompanions, setAiCompanions] = useState<User[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const loadInitialData = async () => {
      setIsLoading(true);
      try {
        const [currentUser, matches, usersForDiscovery, companions] = await Promise.all([
          db.getCurrentUser(),
          db.getMatches(),
          db.getDiscoverUsers(),
          db.getAICompanions(),
        ]);
        setState(prev => ({ ...prev, currentUser, matches }));
        setDiscoverUsers(usersForDiscovery);
        setAiCompanions(companions);
      } catch (error) {
        console.error("Failed to load initial data", error);
        // Handle error state in UI
      } finally {
        setIsLoading(false);
      }
    };
    loadInitialData();
  }, []);


  const setView = (view: View) => {
    if (view === View.HOME) {
      setIsHomeMenuOpen(true);
    } else {
      setIsHomeMenuOpen(false); // Always close menu when navigating
      setState(prev => ({ ...prev, currentView: view }));
    }
  };
  
  const handleMenuAction = (viewToGo: View) => {
    setIsHomeMenuOpen(false);
    setTimeout(() => {
      setState(prev => ({ ...prev, currentView: viewToGo }));
    }, 200);
  };

  const openUserDetail = (user: User) => {
    setState(prev => ({ ...prev, currentView: View.USER_DETAIL, selectedUserForDetail: user }));
  };

  const openChat = async (user: User) => {
    const isAlreadyMatched = state.matches?.find(m => m.id === user.id);
    if (!isAlreadyMatched && !user.isAI) { // Don't add AI to matches list
      const newMatch = await db.addMatch(user.id);
      setState(prev => ({ ...prev, matches: [...(prev.matches || []), newMatch] }));
    }
    setState(prev => ({ ...prev, currentView: View.CHAT_ROOM, selectedChatPartner: user }));
  };

  const openLive = (user: User) => {
    setState(prev => ({ ...prev, currentView: View.LIVE_STREAM, selectedLiveHost: user }));
  };

  const handleUpdateAlbum = async (newAlbum: string[]) => {
    if (!state.currentUser) return;
    const updatedUser = await db.updateUserAlbum(state.currentUser.id, newAlbum);
    setState(prev => ({...prev, currentUser: updatedUser }));
  };
  
  const handleUpdateAvatar = async (newAvatarUrl: string) => {
    if (!state.currentUser) return;
    const updatedUser = await db.updateUserAvatar(state.currentUser.id, newAvatarUrl);
    setState(prev => ({...prev, currentUser: updatedUser }));
  };

  const deductTokens = (amount: number): boolean => {
    if (state.tokens && state.tokens >= amount) {
      setState(prev => ({ ...prev, tokens: (prev.tokens || 0) - amount }));
      return true;
    }
    setView(View.TOKEN_SHOP);
    return false;
  };

  const addTokens = (amount: number) => {
    setState(prev => ({ ...prev, tokens: (prev.tokens || 0) + amount }));
  };

  const addEarnings = async (amount: number) => {
    if (!state.currentUser) return;
    const updatedUser = await db.updateUserEarnings(state.currentUser.id, amount);
    setState(prev => ({...prev, currentUser: updatedUser }));
  };
  
  const handleCashOut = async (amount: number) => {
    if (!state.currentUser) return;
    const updatedUser = await db.performCashOut(state.currentUser.id, amount);
    setState(prev => ({ ...prev, currentUser: updatedUser }));
  };
  
  if (isLoading || !state.currentUser) {
    return (
      <div className="flex flex-col min-h-screen bg-black text-white max-w-md mx-auto items-center justify-center">
        <div className="text-pink-500 text-4xl animate-bounce">❤</div>
        <p className="mt-4 font-bold tracking-widest uppercase">Loading Profile...</p>
      </div>
    );
  }

  const renderView = () => {
    switch (state.currentView) {
      case View.EXPLORE:
        return <DiscoverView users={discoverUsers} aiCompanions={aiCompanions} onSelectUser={openUserDetail} onSelectLive={openLive} />;
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
      case View.LIVE_STREAM:
        return <LiveStreamView host={state.selectedLiveHost!} onEnd={() => setView(View.EXPLORE)} deductTokens={deductTokens} />;
      case View.HOST_LIVE:
        return <LiveStreamView isHost host={state.currentUser!} onEnd={() => setView(View.EXPLORE)} deductTokens={deductTokens} onReceiveGift={addEarnings} />;
      case View.TOKEN_SHOP:
        return <TokenShopView onBack={() => setView(View.EXPLORE)} currentTokens={state.tokens!} onPurchase={addTokens} />;
      case View.PROFILE:
        return <ProfileView user={state.currentUser!} tokens={state.tokens!} onGoShop={() => setView(View.TOKEN_SHOP)} onUpdateAlbum={handleUpdateAlbum} onUpdateAvatar={handleUpdateAvatar} />;
      case View.USER_DETAIL:
        return state.selectedUserForDetail ? (
          <UserDetailView 
            user={state.selectedUserForDetail} 
            onBack={() => setView(View.EXPLORE)} 
            onChat={openChat} 
            onLive={openLive} 
          />
        ) : null;
      case View.CASH_OUT:
        return <CashOutView earnings={state.currentUser?.earnings || 0} onBack={() => {
          setState(prev => ({ ...prev, currentView: View.EXPLORE }));
          setIsHomeMenuOpen(true);
        }} onConfirmCashOut={handleCashOut} />;
      default:
        return <DiscoverView users={discoverUsers} aiCompanions={aiCompanions} onSelectUser={openUserDetail} onSelectLive={openLive} />;
    }
  };

  return (
    <div className="flex flex-col min-h-screen bg-black text-white max-w-md mx-auto relative border-x border-zinc-800 shadow-2xl overflow-hidden">
      <main className="flex-1 overflow-y-auto pb-20">
        {renderView()}
      </main>
      
      {![View.VIDEO_CALL, View.LIVE_STREAM, View.HOST_LIVE, View.USER_DETAIL, View.CASH_OUT].includes(state.currentView!) && (
        <Navbar currentView={state.currentView!} setView={setView} tokenCount={state.tokens!} />
      )}

      <HomeMenuView
        isOpen={isHomeMenuOpen}
        onClose={() => setIsHomeMenuOpen(false)}
        user={state.currentUser!}
        onGoLive={() => handleMenuAction(View.HOST_LIVE)}
        onGoShop={() => handleMenuAction(View.TOKEN_SHOP)}
        onGoProfile={() => handleMenuAction(View.PROFILE)}
        onGoCashOut={() => handleMenuAction(View.CASH_OUT)}
      />
    </div>
  );
};

export default App;
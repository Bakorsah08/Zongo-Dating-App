
import React, { useState } from 'react';
import { View, User, AppState } from './types';
import { MOCK_USERS } from './constants';
import DiscoverView from './components/DiscoverView';
import ChatListView from './components/ChatListView';
import ChatRoomView from './components/ChatRoomView';
import VideoCallView from './components/VideoCallView';
import LiveStreamView from './components/LiveStreamView';
import TokenShopView from './components/TokenShopView';
import Navbar from './components/Navbar';
import ProfileView from './components/ProfileView';
import UserDetailView from './components/UserDetailView';

const App: React.FC = () => {
  const [state, setState] = useState<AppState>({
    currentUser: {
      id: 'me',
      name: 'James',
      age: 26,
      bio: 'Lover of tech and design. Looking for someone to explore the world with.',
      avatar: 'https://picsum.photos/seed/me/200',
      interests: ['Coding', 'Design', 'Travel'],
      location: 'New York',
      distance: 0,
      isOnline: true,
      album: [
        'https://picsum.photos/seed/me1/400/400',
        'https://picsum.photos/seed/me2/400/400'
      ],
      earnings: 0
    },
    tokens: 250,
    matches: [MOCK_USERS[0], MOCK_USERS[1]],
    currentView: View.EXPLORE,
  });

  const setView = (view: View) => {
    setState(prev => ({ ...prev, currentView: view }));
  };

  const openUserDetail = (user: User) => {
    setState(prev => ({ ...prev, currentView: View.USER_DETAIL, selectedUserForDetail: user }));
  };

  const openChat = (user: User) => {
    if (!state.matches.find(m => m.id === user.id)) {
      setState(prev => ({ ...prev, matches: [...prev.matches, user] }));
    }
    setState(prev => ({ ...prev, currentView: View.CHAT_ROOM, selectedChatPartner: user }));
  };

  const openLive = (user: User) => {
    setState(prev => ({ ...prev, currentView: View.LIVE_STREAM, selectedLiveHost: user }));
  };

  const handleUpdateAlbum = (newAlbum: string[]) => {
    setState(prev => ({
      ...prev,
      currentUser: { ...prev.currentUser, album: newAlbum }
    }));
  };

  const deductTokens = (amount: number): boolean => {
    if (state.tokens >= amount) {
      setState(prev => ({ ...prev, tokens: prev.tokens - amount }));
      return true;
    }
    setView(View.TOKEN_SHOP);
    return false;
  };

  const addTokens = (amount: number) => {
    setState(prev => ({ ...prev, tokens: prev.tokens + amount }));
  };

  const addEarnings = (amount: number) => {
    setState(prev => ({
      ...prev,
      currentUser: { ...prev.currentUser, earnings: (prev.currentUser.earnings || 0) + amount }
    }));
  };

  const renderView = () => {
    switch (state.currentView) {
      case View.EXPLORE:
        return <DiscoverView onSelectUser={openUserDetail} onSelectLive={openLive} onGoLive={() => setView(View.HOST_LIVE)} />;
      case View.CHATS:
        return <ChatListView matches={state.matches} onChatSelect={openChat} />;
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
          />
        ) : null;
      case View.LIVE_STREAM:
        return <LiveStreamView host={state.selectedLiveHost || MOCK_USERS[0]} onEnd={() => setView(View.EXPLORE)} deductTokens={deductTokens} />;
      case View.HOST_LIVE:
        return <LiveStreamView isHost host={state.currentUser} onEnd={() => setView(View.EXPLORE)} deductTokens={deductTokens} onReceiveGift={addEarnings} />;
      case View.TOKEN_SHOP:
        return <TokenShopView onBack={() => setView(View.EXPLORE)} currentTokens={state.tokens} onPurchase={addTokens} />;
      case View.PROFILE:
        return <ProfileView user={state.currentUser} tokens={state.tokens} onGoShop={() => setView(View.TOKEN_SHOP)} onUpdateAlbum={handleUpdateAlbum} />;
      case View.USER_DETAIL:
        return state.selectedUserForDetail ? (
          <UserDetailView 
            user={state.selectedUserForDetail} 
            onBack={() => setView(View.EXPLORE)} 
            onChat={openChat} 
            onLive={openLive} 
          />
        ) : null;
      default:
        return <DiscoverView onSelectUser={openUserDetail} onSelectLive={openLive} onGoLive={() => setView(View.HOST_LIVE)} />;
    }
  };

  return (
    <div className="flex flex-col min-h-screen bg-black text-white max-w-md mx-auto relative border-x border-zinc-800 shadow-2xl overflow-hidden">
      <main className="flex-1 overflow-y-auto pb-20">
        {renderView()}
      </main>
      
      {![View.VIDEO_CALL, View.LIVE_STREAM, View.HOST_LIVE, View.USER_DETAIL].includes(state.currentView) && (
        <Navbar currentView={state.currentView} setView={setView} tokenCount={state.tokens} />
      )}
    </div>
  );
};

export default App;

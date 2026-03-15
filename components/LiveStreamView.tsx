import React, { useState, useEffect, useRef } from 'react';
import { getGifts, getUsers, getMonetizationSettings } from '../data';
import { User, Gift } from '../types';

interface Particle {
  id: number;
  emoji: string;
  left: string;
  drift: string;
}

interface LiveStreamViewProps {
  host: User;
  participants?: User[];
  onEnd: () => void;
  deductTokens: (amount: number) => boolean;
  isHost?: boolean;
  onReceiveGift?: (amount: number) => void;
  onViewProfile?: (user: User) => void;
  onAddGuest?: (user: User) => void;
  onSwitchMain?: (user: User) => void;
}

const LiveStreamView: React.FC<LiveStreamViewProps> = ({ host, participants: participantsProp, onEnd, deductTokens, isHost, onReceiveGift, onViewProfile, onAddGuest, onSwitchMain }) => {
  const participants = participantsProp && participantsProp.length > 0 ? participantsProp : [host];
  const mainUser = participants[0];
  const panes = participants.slice(1, 5); // Up to 4 added participants
  const canAddMore = isHost && participants.length < 5;
  const PANE_SLOTS = 4; // Always show 4 pane slots
  const [hasJoined, setHasJoined] = useState(isHost || false);
  const [viewerCount, setViewerCount] = useState(isHost ? 0 : (host.viewerCount || Math.floor(Math.random() * 500) + 100));
  const [likeCount, setLikeCount] = useState(isHost ? 0 : Math.floor(Math.random() * 2000) + 500);
  const [hostEarnings, setHostEarnings] = useState(host.earnings || 0);
  const [comments, setComments] = useState<{user: string, text: string, isGift?: boolean}[]>([]);
  const [showGiftSelector, setShowGiftSelector] = useState(false);
  const [showAddGuest, setShowAddGuest] = useState(false);
  const [panesVisible, setPanesVisible] = useState(true);
  const [panesTouchStart, setPanesTouchStart] = useState<number | null>(null);
  const [messageInput, setMessageInput] = useState('');
  const [particles, setParticles] = useState<Particle[]>([]);
  const videoRef = useRef<HTMLVideoElement>(null);

  const spawnParticle = (emoji: string) => {
    const id = Date.now() + Math.random();
    const drift = `${(Math.random() * 100 - 50)}px`;
    const left = `${(Math.random() * 40 + 60)}%`; // Randomize start position near the buttons
    
    setParticles(prev => [...prev, { id, emoji, left, drift }]);
    setTimeout(() => {
      setParticles(prev => prev.filter(p => p.id !== id));
    }, 1500);
  };

  // Simulated AI Audience for Host
  useEffect(() => {
    if (hasJoined) {
      const interval = setInterval(() => {
        const mockAudience = [
          { user: 'Alex99', text: 'Looking great tonight!' },
          { user: 'Sarah_X', text: 'Hiii everyone!' },
          { user: 'MikeJ', text: 'Send some hearts!' },
          { user: 'Elena_Love', text: 'This is vibes ✨' },
          { user: 'CryptoKing', text: 'Are you from around here?' },
          { user: 'Dave_The_Man', text: 'Keep it up!' },
          { user: 'Linda_B', text: 'Gorgeous!' }
        ];
        
        const random = mockAudience[Math.floor(Math.random() * mockAudience.length)];
        setComments(prev => [...prev.slice(-15), random]);
        
        // Host gets organic growth
        setViewerCount(prev => prev + Math.floor(Math.random() * 10) - 2);
        setLikeCount(prev => prev + Math.floor(Math.random() * 20) + 5);

        // Host receives simulated gifts from "fans"
        if (isHost && Math.random() > 0.85) {
          const gifts = getGifts();
          const randomGift = gifts[Math.floor(Math.random() * Math.min(3, gifts.length))];
          if (randomGift) {
          setHostEarnings(prev => prev + randomGift.value);
          setComments(prev => [
            ...prev.slice(-15), 
            { user: random.user, text: `sent a ${randomGift.name} ${randomGift.icon}`, isGift: true }
          ]);
          spawnParticle(randomGift.icon); // Visual feedback for received gift
          onReceiveGift?.(randomGift.value);
          }
        }
      }, isHost ? 2000 : 3000);
      
      return () => clearInterval(interval);
    }
  }, [hasJoined, isHost]);

  // Handle Camera for Host (when host is main view)
  useEffect(() => {
    let stream: MediaStream | null = null;
    if (isHost && hasJoined && mainUser.id === host.id) {
      navigator.mediaDevices.getUserMedia({ video: true, audio: true })
        .then(s => {
          stream = s;
          if (videoRef.current) videoRef.current.srcObject = s;
        })
        .catch(err => console.error("Camera access denied", err));
    }
    return () => {
      stream?.getTracks().forEach(track => track.stop());
    };
  }, [isHost, hasJoined, mainUser.id, host.id]);

  const liveEntryCost = getMonetizationSettings().liveStreamEntryTokens;
  const giftingEnabled = getMonetizationSettings().giftingEnabled;

  const handleJoin = () => {
    if (deductTokens(liveEntryCost)) {
      setHasJoined(true);
    }
  };

  const handleSendMessage = () => {
    if (!messageInput.trim()) return;
    setComments(prev => [
      ...prev.slice(-15), 
      { user: 'You', text: messageInput }
    ]);
    setMessageInput('');
  };

  const handleSendGift = (gift: Gift) => {
    if (deductTokens(gift.value)) {
      setHostEarnings(prev => prev + gift.value);
      setComments(prev => [
        ...prev.slice(-15), 
        { user: 'You', text: `sent a ${gift.name} ${gift.icon}`, isGift: true }
      ]);
      spawnParticle(gift.icon);
      setShowGiftSelector(false);
    }
  };

  const handleHypeBoost = () => {
    setLikeCount(prev => prev + 10);
    spawnParticle('🔥');
  };

  const handlePanesTouchStart = (e: React.TouchEvent) => setPanesTouchStart(e.touches[0].clientX);
  const handlePanesTouchEnd = (e: React.TouchEvent) => {
    if (panesTouchStart === null) return;
    const diff = e.changedTouches[0].clientX - panesTouchStart;
    if (diff > 50) setPanesVisible(false);
    else if (diff < -50) setPanesVisible(true);
    setPanesTouchStart(null);
  };

  if (!hasJoined) {
    return (
      <div className="h-full flex flex-col p-6 items-center justify-center text-center bg-black">
        <div className="w-full aspect-[9/16] max-h-[500px] rounded-3xl relative overflow-hidden bg-zinc-900 border border-zinc-800">
           <img 
            src={host.avatar} 
            className="w-full h-full object-cover blur-xl opacity-30"
          />
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-4 p-8">
            <div className="relative">
                <img src={host.avatar} className="w-24 h-24 rounded-full border-4 border-pink-500 shadow-2xl" />
                <div className="absolute -bottom-2 left-1/2 -translate-x-1/2 bg-red-600 px-3 py-0.5 rounded text-[10px] font-black">LIVE</div>
            </div>
            <div className="text-center space-y-2">
              <h2 className="text-2xl font-bold">Watch {host.name}'s Stream</h2>
              <div className="flex items-center justify-center gap-1.5 bg-black/50 backdrop-blur-sm px-3 py-1 rounded-full text-xs font-bold text-white shadow-lg border border-white/10 w-fit mx-auto">
                  <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"></path><circle cx="12" cy="12" r="3"></circle></svg>
                  <span>{viewerCount.toLocaleString()} watching</span>
              </div>
            </div>
            <p className="text-zinc-400 text-sm">Join {host.name}'s interactive AI date stream! Chat with her and other viewers.</p>
            <div className="bg-zinc-800/80 backdrop-blur-md p-4 rounded-2xl w-full border border-white/5">
               <div className="flex justify-between items-center mb-3">
                 <span className="text-zinc-500 text-xs font-bold uppercase tracking-widest">Entry Fee</span>
                 <span className="font-black text-pink-500 flex items-center gap-1">💎 {liveEntryCost}</span>
               </div>
               <button 
                 onClick={handleJoin}
                 className="w-full gradient-pink py-3 rounded-xl font-bold text-white shadow-lg shadow-pink-900/40 active:scale-95 transition-all"
               >
                 Purchase Ticket
               </button>
               <button onClick={onEnd} className="w-full mt-2 text-zinc-500 text-xs py-2">Maybe later</button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="h-[calc(100vh-5rem)] bg-black relative flex flex-col overflow-hidden">
      {/* Particle Overlay */}
      {particles.map(p => (
        <span 
          key={p.id}
          className="absolute z-[60] text-3xl pointer-events-none animate-hype"
          style={{ 
            left: p.left, 
            bottom: '80px',
            '--drift': p.drift 
          } as React.CSSProperties}
        >
          {p.emoji}
        </span>
      ))}

      {/* Background Stream */}
      <div className="absolute inset-0">
        {isHost && mainUser.id === host.id ? (
          <video ref={videoRef} autoPlay muted playsInline className="w-full h-full object-cover scale-x-[-1]" />
        ) : (
          <img src={mainUser.avatar} className="w-full h-full object-cover" alt={mainUser.name} />
        )}
        <div className="absolute inset-0 bg-gradient-to-b from-black/60 via-transparent to-black/90"></div>
      </div>

      {/* Vertical Panes - Right Side (1/3 width): Host=4 slots with +, Viewer=participants only */}
      {(isHost || panes.length > 0) && (
        <div
          className={`absolute top-0 right-0 bottom-0 z-20 flex flex-col justify-center gap-2 py-20 px-2 transition-transform duration-300 ease-out ${
            panesVisible ? 'translate-x-0' : 'translate-x-full'
          }`}
          onTouchStart={handlePanesTouchStart}
          onTouchEnd={handlePanesTouchEnd}
          style={{ touchAction: 'pan-y', width: '33.333%' }}
        >
          {isHost
            ? Array.from({ length: PANE_SLOTS }).map((_, i) => {
                const user = panes[i];
                if (user) {
                  return (
                    <button
                      key={user.id}
                      onClick={() => onSwitchMain?.(user)}
                      className="w-full aspect-square max-h-24 rounded-xl overflow-hidden border-2 border-white/30 shadow-lg flex-shrink-0 active:scale-95 transition-transform focus:ring-2 focus:ring-pink-500"
                    >
                      <img src={user.avatar} className="w-full h-full object-cover" alt={user.name} />
                    </button>
                  );
                }
                return (
                  <button
                    key={`empty-${i}`}
                    onClick={() => setShowAddGuest(true)}
                    className="w-full aspect-square max-h-24 rounded-xl border-2 border-dashed border-white/40 flex items-center justify-center text-white/60 text-3xl flex-shrink-0 hover:bg-white/10 transition-colors"
                  >
                    +
                  </button>
                );
              })
            : panes.map((user) => (
                <button
                  key={user.id}
                  onClick={() => onSwitchMain?.(user)}
                  className="w-full aspect-square max-h-24 rounded-xl overflow-hidden border-2 border-white/30 shadow-lg flex-shrink-0 active:scale-95 transition-transform focus:ring-2 focus:ring-pink-500"
                >
                  <img src={user.avatar} className="w-full h-full object-cover" alt={user.name} />
                </button>
              ))}
        </div>
      )}

      {/* Swipe zone & hint - when panes hidden */}
      {(isHost || panes.length > 0) && !panesVisible && (
        <div
          className="absolute right-0 top-0 bottom-0 w-12 z-10 flex items-center justify-end pr-1"
          onTouchStart={handlePanesTouchStart}
          onTouchEnd={handlePanesTouchEnd}
        >
          <button
            onClick={() => setPanesVisible(true)}
            className="w-8 h-16 bg-black/50 rounded-l-lg flex items-center justify-center text-white/70 text-xs"
          >
            ←
          </button>
        </div>
      )}

      {/* Top UI Bar - reference layout: [Live pill] ... [Stats + Exit grouped] */}
      <div 
        className="absolute top-0 left-0 right-0 p-4 flex items-center justify-between gap-4 z-30 pointer-events-none"
        style={{ right: (panes.length > 0 || (isHost && canAddMore)) && panesVisible ? '33.333%' : 0 }}
      >
        {/* Left: Live indicator pill - profile with name & earnings beside it */}
        <div 
          className={`pointer-events-auto flex items-center gap-3 flex-1 min-w-0 shrink-0 max-w-[55%] py-2 pl-2 pr-4 rounded-full border-2 border-green-500/80 bg-black/40 ${!isHost && onViewProfile ? 'cursor-pointer hover:bg-black/50 active:scale-[0.98] transition-all' : ''}`}
          onClick={!isHost && onViewProfile ? () => onViewProfile(mainUser) : undefined}
          role={!isHost && onViewProfile ? 'button' : undefined}
        >
          <img src={mainUser.avatar} className="w-10 h-10 rounded-full object-cover flex-shrink-0 border border-white/20" alt={mainUser.name} />
          <div className="min-w-0 flex-1 flex flex-col gap-0.5">
            <span className="text-sm font-bold text-white whitespace-nowrap overflow-hidden text-ellipsis">
              {isHost && mainUser.id === host.id ? 'Your Stream' : mainUser.name}
            </span>
            <span className="text-xs text-zinc-300 font-medium">
              {(isHost && mainUser.id === host.id ? hostEarnings : mainUser.earnings || 0).toLocaleString()} earned
            </span>
          </div>
        </div>

        {/* Right: Stats pill + Exit button grouped (exit overlaps stats) */}
        <div className="pointer-events-auto flex items-center flex-shrink-0">
          <div className="flex items-center gap-2 bg-zinc-800/95 border border-zinc-700 py-2 pl-4 pr-6 rounded-l-full">
            <span className="flex items-center gap-1 text-xs font-bold text-zinc-200">
              <span>👥</span> {Math.max(0, viewerCount).toLocaleString()}
            </span>
            <span className="w-px h-4 bg-zinc-600"></span>
            <span className="flex items-center gap-1 text-xs font-bold text-pink-400">
              <span>❤️</span> {likeCount.toLocaleString()}
            </span>
          </div>
          <button
            onClick={onEnd}
            className="relative -ml-4 w-10 h-10 flex items-center justify-center rounded-full bg-zinc-800 border-2 border-zinc-700 text-white text-lg font-bold hover:bg-zinc-700 z-10"
          >
            ✕
          </button>
        </div>
      </div>

      {/* Live Chat Area */}
      <div className="mt-auto relative p-4 z-10 max-h-[40%] overflow-y-auto scrollbar-hide flex flex-col justify-end">
        <div className="flex flex-col gap-2">
          {comments.map((c, i) => (
            <div key={i} className={`flex gap-2 items-start animate-in slide-in-from-left duration-300 ${c.isGift ? 'bg-pink-500/20 border border-pink-500/30 p-2 rounded-xl shadow-[0_0_15px_rgba(236,72,153,0.1)]' : ''}`}>
              <span className={`text-xs font-bold whitespace-nowrap ${c.isGift ? 'text-pink-400' : 'text-pink-300/80'}`}>{c.user}:</span>
              <span className={`text-xs leading-relaxed ${c.isGift ? 'text-white font-bold italic' : 'text-zinc-100 bg-black/20 backdrop-blur-sm px-2 py-1 rounded-lg'}`}>
                {c.text}
              </span>
            </div>
          ))}
        </div>
      </div>

      {/* Bottom Controls */}
      <div className="relative p-4 pb-8 z-10 flex gap-3">
        <div className="flex-1 relative flex items-center">
          <input 
            type="text" 
            value={messageInput}
            onChange={(e) => setMessageInput(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleSendMessage()}
            placeholder={isHost ? "Chat with fans..." : "Say something..."} 
            className="w-full bg-white/10 backdrop-blur-md rounded-full pl-5 pr-14 py-3 text-sm border border-white/10 outline-none placeholder:text-zinc-500 focus:border-pink-500/50 transition-colors"
          />
          <button 
            onClick={handleSendMessage}
            className={`absolute right-2.5 w-8 h-8 rounded-full flex items-center justify-center transition-all ${messageInput.trim() ? 'bg-pink-500 text-white shadow-lg shadow-pink-500/30' : 'text-zinc-500 opacity-50'}`}
          >
            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><line x1="22" y1="2" x2="11" y2="13"></line><polygon points="22 2 15 22 11 13 2 9 22 2"></polygon></svg>
          </button>
        </div>
        
        {!isHost ? (
          <>
            {giftingEnabled && (
              <button 
                onClick={() => setShowGiftSelector(true)}
                className="w-12 h-12 rounded-full bg-white/60 backdrop-blur-md flex items-center justify-center shadow-lg text-xl active:scale-90 transition-all hover:bg-white/80"
              >
                🎁
              </button>
            )}
            <button 
              onClick={() => {
                setLikeCount(prev => prev + 1);
                spawnParticle('❤️');
              }}
              className="w-12 h-12 rounded-full bg-white/60 backdrop-blur-md flex items-center justify-center shadow-lg text-xl active:scale-90 transition-all hover:bg-white/80"
            >
              ❤️
            </button>
          </>
        ) : (
          <button 
            onClick={handleHypeBoost}
            className="w-12 h-12 rounded-full bg-white/60 backdrop-blur-md flex items-center justify-center shadow-lg text-xl active:scale-90 transition-all hover:bg-white/80 border border-white/20"
          >
            🔥
          </button>
        )}
      </div>

      {/* Add Guest Modal (Host Only) - Online users or viewers on live */}
      {isHost && showAddGuest && (() => {
        const allUsers = getUsers().filter(u => u.id !== host.id && !participants.find(p => p.id === u.id));
        const onlineUsers = allUsers.filter(u => u.isOnline || u.isLive);
        const viewerNames = [...new Set(comments.map(c => c.user).filter(n => n !== 'You'))];
        const viewersOnLive = viewerNames
          .map(name => allUsers.find(u => name.toLowerCase().includes(u.name.toLowerCase())))
          .filter((u): u is User => !!u);
        const addableUsers = [...onlineUsers];
        viewersOnLive.forEach(v => { if (!addableUsers.find(a => a.id === v.id)) addableUsers.push(v); });
        return (
          <div className="fixed inset-0 z-[60] flex items-end justify-center bg-black/40 backdrop-blur-[2px] animate-in fade-in duration-300">
            <div className="absolute inset-0" onClick={() => setShowAddGuest(false)} />
            <div className="w-full max-w-md bg-zinc-950 border-t border-zinc-800 rounded-t-[32px] p-6 pb-12 relative animate-in slide-in-from-bottom duration-300 max-h-[60vh] flex flex-col">
              <div className="w-12 h-1 bg-zinc-800 rounded-full mx-auto mb-6" />
              <div className="flex justify-between items-center mb-4 px-1">
                <h3 className="text-sm font-black uppercase tracking-widest text-zinc-400">Add to Live</h3>
                <button onClick={() => setShowAddGuest(false)} className="text-zinc-600 text-sm font-bold">Close</button>
              </div>
              <p className="text-xs text-zinc-500 mb-4">Add someone online or watching your stream ({panes.length}/4 added)</p>
              <div className="overflow-y-auto flex-1 space-y-2">
                {addableUsers.length > 0 ? addableUsers.map((user) => (
                  <button
                    key={user.id}
                    onClick={() => {
                      onAddGuest?.(user);
                      setShowAddGuest(false);
                    }}
                    className="w-full flex items-center gap-3 p-3 rounded-xl bg-zinc-900/50 border border-zinc-800 hover:border-pink-500/50 transition-all"
                  >
                    <img src={user.avatar} className="w-12 h-12 rounded-full object-cover" alt={user.name} />
                    <div className="text-left flex-1">
                      <p className="font-bold text-sm">{user.name}, {user.age}</p>
                      <p className="text-[10px] text-zinc-500">{user.isOnline ? '🟢 Online' : 'Watching'} · {user.location}</p>
                    </div>
                    <span className="text-pink-500 text-sm font-bold">+ Add</span>
                  </button>
                )) : (
                  <p className="text-center text-zinc-500 py-8">No one online or watching to add</p>
                )}
              </div>
            </div>
          </div>
        );
      })()}

      {/* Gift Selection Bottom Sheet (Viewer Only) */}
      {!isHost && showGiftSelector && (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 backdrop-blur-[2px] animate-in fade-in duration-300">
          <div className="absolute inset-0" onClick={() => setShowGiftSelector(false)}></div>
          <div className="w-full max-w-md bg-zinc-950 border-t border-zinc-800 rounded-t-[32px] p-6 pb-12 relative animate-in slide-in-from-bottom duration-300">
            <div className="w-12 h-1 bg-zinc-800 rounded-full mx-auto mb-6"></div>
            
            <div className="flex justify-between items-center mb-6 px-1">
              <h3 className="text-sm font-black uppercase tracking-widest text-zinc-400">Send a Gift</h3>
              <button onClick={() => setShowGiftSelector(false)} className="text-zinc-600 text-sm font-bold">Close</button>
            </div>

            <div className="grid grid-cols-4 gap-4">
              {getGifts().map((gift) => (
                <button
                  key={gift.id}
                  onClick={() => handleSendGift(gift)}
                  className="flex flex-col items-center gap-2 p-3 rounded-2xl bg-zinc-900/50 border border-zinc-800 hover:border-pink-500/50 hover:bg-zinc-800 transition-all active:scale-90"
                >
                  <span className="text-3xl">{gift.icon}</span>
                  <div className="flex flex-col items-center">
                    <span className="text-[10px] font-bold text-zinc-300">{gift.name}</span>
                    <span className="text-[10px] font-black text-pink-500 flex items-center gap-0.5">
                      <span className="text-[8px]">💎</span>{gift.value}
                    </span>
                  </div>
                </button>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default LiveStreamView;
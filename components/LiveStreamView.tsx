import React, { useState, useEffect, useRef } from 'react';
import { TOKEN_COSTS, GIFTS } from '../constants';
import { User, Gift } from '../types';

interface Particle {
  id: number;
  emoji: string;
  left: string;
  drift: string;
}

interface LiveStreamViewProps {
  host: User;
  onEnd: () => void;
  deductTokens: (amount: number) => boolean;
  isHost?: boolean;
  onReceiveGift?: (amount: number) => void;
}

const LiveStreamView: React.FC<LiveStreamViewProps> = ({ host, onEnd, deductTokens, isHost, onReceiveGift }) => {
  const [hasJoined, setHasJoined] = useState(isHost || false);
  const [viewerCount, setViewerCount] = useState(isHost ? 0 : (host.viewerCount || Math.floor(Math.random() * 500) + 100));
  const [likeCount, setLikeCount] = useState(isHost ? 0 : Math.floor(Math.random() * 2000) + 500);
  const [hostEarnings, setHostEarnings] = useState(host.earnings || 0);
  const [comments, setComments] = useState<{user: string, text: string, isGift?: boolean}[]>([]);
  const [showGiftSelector, setShowGiftSelector] = useState(false);
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
          const randomGift = GIFTS[Math.floor(Math.random() * 3)]; // Small gifts mostly
          setHostEarnings(prev => prev + randomGift.value);
          setComments(prev => [
            ...prev.slice(-15), 
            { user: random.user, text: `sent a ${randomGift.name} ${randomGift.icon}`, isGift: true }
          ]);
          spawnParticle(randomGift.icon); // Visual feedback for received gift
          onReceiveGift?.(randomGift.value);
        }
      }, isHost ? 2000 : 3000);
      
      return () => clearInterval(interval);
    }
  }, [hasJoined, isHost]);

  // Handle Camera for Host
  useEffect(() => {
    let stream: MediaStream | null = null;
    if (isHost && hasJoined) {
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
  }, [isHost, hasJoined]);

  const handleJoin = () => {
    if (deductTokens(TOKEN_COSTS.LIVE_STREAM)) {
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
                 <span className="font-black text-pink-500 flex items-center gap-1">💎 {TOKEN_COSTS.LIVE_STREAM}</span>
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
    <div className="h-screen bg-black relative flex flex-col overflow-hidden">
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
        {isHost ? (
          <video ref={videoRef} autoPlay muted playsInline className="w-full h-full object-cover scale-x-[-1]" />
        ) : (
          <img src={host.avatar} className="w-full h-full object-cover" />
        )}
        <div className="absolute inset-0 bg-gradient-to-b from-black/60 via-transparent to-black/90"></div>
      </div>

      {/* Top UI Bar */}
      <div className="relative p-4 flex items-center justify-between z-10">
        <div className="flex items-center gap-2 bg-black/40 backdrop-blur-md p-1 pr-3 rounded-full border border-white/10">
          <img src={host.avatar} className="w-8 h-8 rounded-full border border-pink-500" />
          <div>
             <h3 className="text-[10px] font-bold leading-tight">{isHost ? 'Your Stream' : host.name}</h3>
             <div className="flex items-center gap-1 text-[8px] text-zinc-300">
               <span className="w-1 h-1 bg-red-500 rounded-full animate-pulse"></span> {hostEarnings.toLocaleString()} earned
             </div>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {isHost && (
            <div className="bg-red-600 px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-widest animate-pulse">
              LIVE
            </div>
          )}
          <div className="flex items-center gap-1.5 bg-black/40 backdrop-blur-md px-3 py-1 rounded-full text-[10px] font-bold border border-white/10">
             <span className="text-zinc-400">👥</span> {Math.max(0, viewerCount).toLocaleString()}
             <span className="w-px h-2.5 bg-white/20 mx-0.5"></span>
             <span className="text-pink-500">❤️</span> {likeCount.toLocaleString()}
          </div>
          <button onClick={onEnd} className="bg-zinc-900/50 p-2 rounded-full text-white text-sm">✕</button>
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
            <button 
              onClick={() => setShowGiftSelector(true)}
              className="w-12 h-12 rounded-full bg-white/60 backdrop-blur-md flex items-center justify-center shadow-lg text-xl active:scale-90 transition-all hover:bg-white/80"
            >
              🎁
            </button>
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
              {GIFTS.map((gift) => (
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
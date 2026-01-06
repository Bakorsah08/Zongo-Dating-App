import React, { useState, useMemo } from 'react';
import { MOCK_USERS } from '../constants';
import { User } from '../types';

interface DiscoverViewProps {
  onSelectUser: (user: User) => void;
  onSelectLive: (user: User) => void;
}

const DiscoverView: React.FC<DiscoverViewProps> = ({ onSelectUser, onSelectLive }) => {
  const [showFilters, setShowFilters] = useState(false);
  const [filterOnline, setFilterOnline] = useState<'all' | 'online'>('all');
  const [maxDistance, setMaxDistance] = useState(50);
  const [minAge, setMinAge] = useState(18);
  const [maxAge, setMaxAge] = useState(50);

  const filteredUsers = useMemo(() => {
    return MOCK_USERS.filter(user => {
      const matchesOnline = filterOnline === 'all' || user.isOnline;
      const matchesDistance = user.distance <= maxDistance;
      const matchesAge = user.age >= minAge && user.age <= maxAge;
      return matchesOnline && matchesDistance && matchesAge;
    });
  }, [filterOnline, maxDistance, minAge, maxAge]);

  return (
    <div className="p-4 flex flex-col gap-6 relative min-h-full">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-black bg-gradient-to-r from-pink-500 to-rose-400 bg-clip-text text-transparent tracking-tighter">
            HEARTSYNC
          </h1>
          <p className="text-[10px] text-zinc-500 font-bold uppercase tracking-widest mt-0.5">Explore your world</p>
        </div>
        <button 
          onClick={() => setShowFilters(!showFilters)}
          className={`w-10 h-10 rounded-full flex items-center justify-center border transition-all shadow-lg ${
            showFilters || filterOnline === 'online' || maxDistance < 50 || minAge > 18 || maxAge < 50
            ? 'bg-pink-600 border-pink-500 text-white' 
            : 'bg-zinc-900 border-zinc-800 text-zinc-400'
          }`}
        >
          <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="4" y1="21" x2="4" y2="14"></line><line x1="4" y1="10" x2="4" y2="3"></line><line x1="12" y1="21" x2="12" y2="12"></line><line x1="12" y1="8" x2="12" y2="3"></line><line x1="20" y1="21" x2="20" y2="16"></line><line x1="20" y1="12" x2="20" y2="3"></line><line x1="1" y1="14" x2="7" y2="14"></line><line x1="9" y1="8" x2="15" y2="8"></line><line x1="17" y1="16" x2="23" y2="16"></line></svg>
        </button>
      </div>

      {/* Filter Panel */}
      {showFilters && (
        <div className="bg-zinc-900/90 backdrop-blur-xl border border-zinc-800 rounded-3xl p-5 space-y-6 animate-in slide-in-from-top duration-300">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-bold uppercase tracking-widest text-zinc-400">Filters</h3>
            <button onClick={() => setShowFilters(false)} className="text-zinc-500 hover:text-white text-xs">Close</button>
          </div>

          <div className="space-y-3">
            <label className="text-[10px] font-bold text-zinc-500 uppercase tracking-wider">Status</label>
            <div className="flex bg-black p-1 rounded-xl border border-zinc-800">
              <button 
                onClick={() => setFilterOnline('all')}
                className={`flex-1 py-2 text-xs font-bold rounded-lg transition-all ${filterOnline === 'all' ? 'bg-zinc-800 text-white' : 'text-zinc-500'}`}
              >
                Everyone
              </button>
              <button 
                onClick={() => setFilterOnline('online')}
                className={`flex-1 py-2 text-xs font-bold rounded-lg transition-all ${filterOnline === 'online' ? 'bg-pink-600 text-white' : 'text-zinc-500'}`}
              >
                Online Now
              </button>
            </div>
          </div>

          <div className="space-y-3">
            <div className="flex justify-between items-end">
              <label className="text-[10px] font-bold text-zinc-500 uppercase tracking-wider">Max Distance</label>
              <span className="text-xs font-bold text-pink-500">{maxDistance} miles</span>
            </div>
            <input 
              type="range" 
              min="1" 
              max="100" 
              value={maxDistance} 
              onChange={(e) => setMaxDistance(parseInt(e.target.value))}
              className="w-full h-1.5 bg-black rounded-lg appearance-none cursor-pointer accent-pink-600 border border-zinc-800"
            />
          </div>

          <div className="space-y-3">
            <div className="flex justify-between items-end">
              <label className="text-[10px] font-bold text-zinc-500 uppercase tracking-wider">Age Range</label>
              <span className="text-xs font-bold text-pink-500">{minAge} - {maxAge}</span>
            </div>
            <div className="flex gap-4">
               <div className="flex-1 space-y-1">
                 <span className="text-[8px] text-zinc-600 uppercase font-bold">Min</span>
                 <input 
                    type="number" 
                    value={minAge} 
                    onChange={(e) => setMinAge(Math.max(18, parseInt(e.target.value) || 18))}
                    className="w-full bg-black border border-zinc-800 rounded-lg py-2 px-3 text-sm outline-none focus:border-pink-500"
                  />
               </div>
               <div className="flex-1 space-y-1">
                 <span className="text-[8px] text-zinc-600 uppercase font-bold">Max</span>
                 <input 
                    type="number" 
                    value={maxAge} 
                    onChange={(e) => setMaxAge(Math.min(100, parseInt(e.target.value) || 100))}
                    className="w-full bg-black border border-zinc-800 rounded-lg py-2 px-3 text-sm outline-none focus:border-pink-500"
                  />
               </div>
            </div>
          </div>
        </div>
      )}

      <div className="grid grid-cols-2 gap-3 pb-24">
        {filteredUsers.length > 0 ? (
          filteredUsers.map((user) => (
            <div 
              key={user.id}
              onClick={() => user.isLive ? onSelectLive(user) : onSelectUser(user)}
              className="relative aspect-[3/4] rounded-2xl overflow-hidden border border-zinc-800 shadow-xl group cursor-pointer active:scale-95 transition-transform"
            >
              <img 
                src={user.avatar} 
                alt={user.name} 
                className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-transparent"></div>
              
              {user.isLive && (
                <div className="absolute top-2 left-2 flex items-center gap-1.5">
                  <div className="flex items-center gap-1 bg-red-600 px-2 py-0.5 rounded text-[8px] font-black uppercase tracking-tighter text-white shadow-lg animate-pulse">
                    <span className="w-1 h-1 bg-white rounded-full"></span>
                    LIVE
                  </div>
                  {user.viewerCount && (
                     <div className="flex items-center gap-1 bg-black/50 backdrop-blur-sm px-1.5 py-0.5 rounded text-[8px] font-bold text-white shadow-lg">
                        <svg xmlns="http://www.w3.org/2000/svg" width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"></path><circle cx="12" cy="12" r="3"></circle></svg>
                        <span>{user.viewerCount.toLocaleString()}</span>
                    </div>
                  )}
                </div>
              )}

              {!user.isLive && user.isOnline && (
                <div className="absolute top-2 left-2 w-2 h-2 bg-green-500 rounded-full border border-black shadow-lg"></div>
              )}

              <div className="absolute bottom-3 left-3 right-3">
                <div className="flex items-center gap-1.5">
                  <h3 className="text-sm font-bold text-white drop-shadow-md">{user.name}, {user.age}</h3>
                  {user.isOnline && !user.isLive && <span className="w-1.5 h-1.5 bg-green-500 rounded-full"></span>}
                </div>
                <p className="text-[10px] text-zinc-300 truncate drop-shadow-md">
                  {user.isLive ? 'Tap to watch live' : `${user.distance} miles away`}
                </p>
              </div>
            </div>
          ))
        ) : (
          <div className="col-span-2 py-20 text-center flex flex-col items-center gap-4">
            <span className="text-4xl grayscale opacity-50">🔍</span>
            <div className="space-y-1">
              <h3 className="font-bold text-zinc-400">No results found</h3>
              <p className="text-xs text-zinc-600">Try broadening your search filters</p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default DiscoverView;
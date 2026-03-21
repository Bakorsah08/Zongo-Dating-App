import React, { useState, useMemo } from 'react';
import { getUsers, getBadges, getMonetizationSettings, getExploreSpotlight } from '../data';
import type { ExploreSpotlight, User, UserGender } from '../types';

interface DiscoverViewProps {
  userGender?: UserGender;
  onSelectUser: (user: User) => void;
  onSelectLive: (user: User) => void;
  onGoLive?: () => void;
}

const AI_PERSONALITIES = ['Any', 'Romantic', 'Playful', 'Calm', 'Intellectual'];
const AI_STYLES = ['Any', 'Casual', 'Elegant', 'Streetwear', 'Sporty'];

const getBadgeRank = (user: User): number => {
  const tier = user.badgeTier || 'none';
  return getBadges().find(b => b.id === tier)?.rank ?? 0;
};

/** Reserved first Explore grid cell — super-admin ads & announcements. */
const ExploreSpotlightCard: React.FC<{ spotlight: ExploreSpotlight }> = ({ spotlight }) => {
  const active = spotlight.enabled;
  const badge = active ? (spotlight.badgeLabel.trim() || 'Promo') : 'Featured';
  const title = active ? (spotlight.title.trim() || 'Zongo') : 'Zongo';
  const subtitle = active ? (spotlight.subtitle.trim() || 'Promos & news') : 'Ads & announcements';
  const imgSrc =
    active && spotlight.imageDataUrl?.trim()
      ? spotlight.imageDataUrl.trim()
      : active && spotlight.imageUrl.trim()
        ? spotlight.imageUrl.trim()
        : '';
  const bgColor =
    active && spotlight.backgroundColor?.trim() ? spotlight.backgroundColor.trim() : '';
  const link = spotlight.linkUrl.trim();

  const handleActivate = () => {
    if (!active || !link) return;
    const url =
      link.startsWith('http://') || link.startsWith('https://') ? link : `https://${link}`;
    window.open(url, '_blank', 'noopener,noreferrer');
  };

  return (
    <div
      role="button"
      tabIndex={active && link ? 0 : undefined}
      onClick={handleActivate}
      onKeyDown={(e) => {
        if (!active || !link) return;
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          handleActivate();
        }
      }}
      className={`group relative aspect-[3/4] overflow-hidden rounded-[0.65rem] border border-white transition-transform active:scale-[0.99] ${
        active && link ? 'cursor-pointer' : 'cursor-default'
      }`}
    >
      {imgSrc ? (
        <img
          src={imgSrc}
          alt=""
          className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-105"
        />
      ) : bgColor ? (
        <div className="absolute inset-0" style={{ backgroundColor: bgColor }} />
      ) : (
        <div className="absolute inset-0 bg-gradient-to-br from-pink-500 via-violet-600 to-blue-600" />
      )}
      <div className="absolute inset-0 bg-gradient-to-t from-black/85 via-black/25 to-transparent" />
      <div className="absolute left-2 top-2 rounded bg-white/90 px-2 py-0.5 text-[8px] font-black uppercase tracking-tighter text-zinc-900 shadow-sm">
        {badge}
      </div>
      <div className="absolute bottom-3 left-3 right-3">
        <h3 className="text-[0.91875rem] font-bold text-white drop-shadow-md">{title}</h3>
        <p className="text-[10px] text-zinc-200 drop-shadow-md line-clamp-2">{subtitle}</p>
      </div>
    </div>
  );
};

const DiscoverView: React.FC<DiscoverViewProps> = ({ userGender, onSelectUser, onSelectLive, onGoLive }) => {
  const liveStreamingEnabled = getMonetizationSettings().liveStreamingEnabled;
  const [showFilters, setShowFilters] = useState(false);
  const [activeTextFilter, setActiveTextFilter] = useState<
    'all' | 'recommend' | 'newcomer' | 'nearby' | 'live'
  >('all');
  
  // Filter states
  const [profileType, setProfileType] = useState<'human' | 'ai'>('human');
  
  // Human filters
  const [filterOnline, setFilterOnline] = useState<'all' | 'online'>('all');
  const [maxDistance, setMaxDistance] = useState(50);
  const [minAge, setMinAge] = useState(18);
  const [maxAge, setMaxAge] = useState(50);
  
  // AI filters
  const [aiMinAge, setAiMinAge] = useState(18);
  const [aiMaxAge, setAiMaxAge] = useState(35);
  const [aiPersonality, setAiPersonality] = useState('Any');
  const [aiStyle, setAiStyle] = useState('Any');

  const filteredUsers = useMemo(() => {
    const allUsers = getUsers();
    let filtered = allUsers
      .filter(user => user.id !== 'me') // Exclude current user
      .filter(user => {
        const matchesOnline = filterOnline === 'all' || user.isOnline;
        const matchesDistance = user.distance <= maxDistance;
        const matchesAge = user.age >= minAge && user.age <= maxAge;
        return matchesOnline && matchesDistance && matchesAge;
      });

    const beforeGenderFilter = [...filtered];

    // Gender-based filtering: 90% opposite gender, 10% same (or users without gender)
    if (userGender) {
      const preferredGender = userGender === 'male' ? 'female' : 'male';
      const preferred = filtered.filter(u => u.gender === preferredGender);
      const other = filtered.filter(u => u.gender === userGender || u.gender === undefined);
      const otherCount = preferred.length > 0 ? Math.ceil(preferred.length / 9) : other.length; // ~10% of total, or all "other" if no preferred
      filtered = [...preferred, ...other.slice(0, otherCount)];

      // Fallback: if gender filter yields no results (e.g. users lack gender in storage), show all
      if (filtered.length === 0 && beforeGenderFilter.length > 0) {
        filtered = beforeGenderFilter;
      }
    }

    if (activeTextFilter === 'all') {
      return [...filtered];
    }

    if (activeTextFilter === 'live') {
      return filtered
        .filter(u => u.isLive)
        .sort((a, b) => (b.viewerCount ?? 0) - (a.viewerCount ?? 0));
    }

    if (activeTextFilter === 'nearby') {
      return [...filtered].sort((a, b) => a.distance - b.distance);
    }

    if (activeTextFilter === 'newcomer') {
      const indexById = new Map(allUsers.map((u, i) => [u.id, i]));
      // Newest assumed to be the most recently inserted (towards end of array)
      return [...filtered].sort((a, b) => (indexById.get(b.id) ?? 0) - (indexById.get(a.id) ?? 0));
    }

    // Recommend: VIP rank first, then by distance
    return [...filtered].sort((a, b) => {
      const rankA = getBadgeRank(a);
      const rankB = getBadgeRank(b);
      if (rankB !== rankA) return rankB - rankA;
      return a.distance - b.distance;
    });
  }, [userGender, filterOnline, maxDistance, minAge, maxAge, activeTextFilter]);

  const areHumanFiltersActive = filterOnline === 'online' || maxDistance < 50 || minAge > 18 || maxAge < 50;
  const areAIFiltersActive = aiMinAge > 18 || aiMaxAge < 35 || aiPersonality !== 'Any' || aiStyle !== 'Any';
  const areAnyFiltersActive = (profileType === 'human' && areHumanFiltersActive) || (profileType === 'ai' && areAIFiltersActive);
  const exploreSpotlight = getExploreSpotlight();

  return (
    <div className="flex flex-col min-h-full bg-white">
      <div className="px-4 pt-4 pb-2 flex items-center justify-between">
        <h1 className="text-2xl font-black text-black tracking-tight">Explore Your World</h1>
        <button 
          onClick={() => setShowFilters(!showFilters)}
          className={`w-10 h-10 rounded-full flex items-center justify-center transition-all ${
            showFilters || areAnyFiltersActive
            ? 'bg-white text-pink-600' 
            : 'bg-white text-zinc-700'
          }`}
        >
          <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="4" y1="21" x2="4" y2="14"></line><line x1="4" y1="10" x2="4" y2="3"></line><line x1="12" y1="21" x2="12" y2="12"></line><line x1="12" y1="8" x2="12" y2="3"></line><line x1="20" y1="21" x2="20" y2="16"></line><line x1="20" y1="12" x2="20" y2="3"></line><line x1="1" y1="14" x2="7" y2="14"></line><line x1="9" y1="8" x2="15" y2="8"></line><line x1="17" y1="16" x2="23" y2="16"></line></svg>
        </button>
      </div>

      <div className="flex items-center gap-2 overflow-x-auto px-4 pb-3">
        <button
          type="button"
          onClick={() => setActiveTextFilter('all')}
          className={`whitespace-nowrap rounded-full px-4 py-2 text-xs transition-all ${
            activeTextFilter === 'all'
              ? 'bg-gradient-to-r from-pink-200 to-blue-200 font-extrabold text-zinc-900'
              : 'bg-zinc-100 font-medium text-zinc-500'
          }`}
        >
          All
        </button>
        <button
          type="button"
          onClick={() => setActiveTextFilter('recommend')}
          className={`whitespace-nowrap rounded-full px-4 py-2 text-xs transition-all ${
            activeTextFilter === 'recommend'
              ? 'bg-gradient-to-r from-pink-200 to-blue-200 font-extrabold text-zinc-900'
              : 'bg-zinc-100 font-medium text-zinc-500'
          }`}
        >
          Recommended
        </button>
        <button
          type="button"
          onClick={() => setActiveTextFilter('newcomer')}
          className={`whitespace-nowrap rounded-full px-4 py-2 text-xs transition-all ${
            activeTextFilter === 'newcomer'
              ? 'bg-gradient-to-r from-pink-200 to-blue-200 font-extrabold text-zinc-900'
              : 'bg-zinc-100 font-medium text-zinc-500'
          }`}
        >
          Newcomer
        </button>
        <button
          type="button"
          onClick={() => setActiveTextFilter('nearby')}
          className={`whitespace-nowrap rounded-full px-4 py-2 text-xs transition-all ${
            activeTextFilter === 'nearby'
              ? 'bg-gradient-to-r from-pink-200 to-blue-200 font-extrabold text-zinc-900'
              : 'bg-zinc-100 font-medium text-zinc-500'
          }`}
        >
          Nearby
        </button>
        <button
          type="button"
          onClick={() => setActiveTextFilter('live')}
          className={`whitespace-nowrap rounded-full px-4 py-2 text-xs transition-all ${
            activeTextFilter === 'live'
              ? 'bg-gradient-to-r from-pink-200 to-blue-200 font-extrabold text-zinc-900'
              : 'bg-zinc-100 font-medium text-zinc-500'
          }`}
        >
          Live
        </button>
      </div>

      {/* Filter Panel - light theme */}
      {showFilters && (
        <div className="px-4">
        <div className="bg-white border border-zinc-200 rounded-3xl p-5 space-y-6 shadow-xl animate-in slide-in-from-top duration-300">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-bold uppercase tracking-widest text-zinc-800">Filters</h3>
            <button onClick={() => setShowFilters(false)} className="text-zinc-600 hover:text-zinc-900 text-xs font-medium">Close</button>
          </div>
          
          {/* Profile Type Toggle */}
          <div className="space-y-3">
            <label className="text-[10px] font-bold text-zinc-600 uppercase tracking-wider">Profile Type</label>
            <div className="flex bg-zinc-200 p-1 rounded-xl border border-zinc-200">
              <button 
                onClick={() => setProfileType('human')}
                className={`flex-1 py-2 text-xs font-bold rounded-lg transition-all ${profileType === 'human' ? 'bg-white text-zinc-900 shadow-sm' : 'text-zinc-600'}`}
              >
                Humans
              </button>
              <button 
                onClick={() => setProfileType('ai')}
                className={`flex-1 py-2 text-xs font-bold rounded-lg transition-all ${profileType === 'ai' ? 'bg-pink-500 text-white shadow-sm' : 'text-zinc-600'}`}
              >
                AI Companions
              </button>
            </div>
          </div>
          
          {/* Divider */}
          <hr className="border-zinc-200"/>

          {profileType === 'human' ? (
            <div className="space-y-6 animate-in fade-in duration-300">
              <div className="space-y-3">
                <label className="text-[10px] font-bold text-zinc-600 uppercase tracking-wider">Status</label>
                <div className="flex bg-zinc-200 p-1 rounded-xl border border-zinc-200">
                  <button onClick={() => setFilterOnline('all')} className={`flex-1 py-2 text-xs font-bold rounded-lg transition-all ${filterOnline === 'all' ? 'bg-white text-zinc-900 shadow-sm' : 'text-zinc-600'}`}>Everyone</button>
                  <button onClick={() => setFilterOnline('online')} className={`flex-1 py-2 text-xs font-bold rounded-lg transition-all ${filterOnline === 'online' ? 'bg-pink-500 text-white shadow-sm' : 'text-zinc-600'}`}>Online Now</button>
                </div>
              </div>
              <div className="space-y-3">
                <div className="flex justify-between items-end"><label className="text-[10px] font-bold text-zinc-600 uppercase tracking-wider">Max Distance</label><span className="text-xs font-bold text-pink-500">{maxDistance} miles</span></div>
                <input type="range" min="1" max="100" value={maxDistance} onChange={(e) => setMaxDistance(parseInt(e.target.value))} className="w-full h-1.5 bg-zinc-200 rounded-lg appearance-none cursor-pointer accent-pink-500"/>
              </div>
              <div className="space-y-3">
                <div className="flex justify-between items-end"><label className="text-[10px] font-bold text-zinc-600 uppercase tracking-wider">Age Range</label><span className="text-xs font-bold text-pink-500">{minAge} - {maxAge}</span></div>
                <div className="flex gap-4">
                  <div className="flex-1 space-y-1"><span className="text-[8px] text-zinc-600 uppercase font-bold">Min</span><input type="number" value={minAge} onChange={(e) => setMinAge(Math.max(18, parseInt(e.target.value) || 18))} className="w-full bg-white border border-zinc-300 rounded-lg py-2 px-3 text-sm text-zinc-900 outline-none focus:border-pink-500"/></div>
                  <div className="flex-1 space-y-1"><span className="text-[8px] text-zinc-600 uppercase font-bold">Max</span><input type="number" value={maxAge} onChange={(e) => setMaxAge(Math.min(100, parseInt(e.target.value) || 100))} className="w-full bg-white border border-zinc-300 rounded-lg py-2 px-3 text-sm text-zinc-900 outline-none focus:border-pink-500"/></div>
                </div>
              </div>
            </div>
          ) : (
             <div className="space-y-6 animate-in fade-in duration-300">
              <div className="space-y-3">
                <div className="flex justify-between items-end"><label className="text-[10px] font-bold text-zinc-600 uppercase tracking-wider">Age</label><span className="text-xs font-bold text-pink-500">{aiMinAge} - {aiMaxAge}</span></div>
                <div className="flex gap-4">
                  <div className="flex-1 space-y-1"><span className="text-[8px] text-zinc-600 uppercase font-bold">Min</span><input type="number" value={aiMinAge} onChange={(e) => setAiMinAge(Math.max(18, parseInt(e.target.value) || 18))} className="w-full bg-white border border-zinc-300 rounded-lg py-2 px-3 text-sm text-zinc-900 outline-none focus:border-pink-500"/></div>
                  <div className="flex-1 space-y-1"><span className="text-[8px] text-zinc-600 uppercase font-bold">Max</span><input type="number" value={aiMaxAge} onChange={(e) => setAiMaxAge(Math.min(100, parseInt(e.target.value) || 100))} className="w-full bg-white border border-zinc-300 rounded-lg py-2 px-3 text-sm text-zinc-900 outline-none focus:border-pink-500"/></div>
                </div>
              </div>
               <div className="space-y-3">
                <label className="text-[10px] font-bold text-zinc-600 uppercase tracking-wider">Personality</label>
                <select value={aiPersonality} onChange={e => setAiPersonality(e.target.value)} className="w-full bg-white border border-zinc-300 rounded-lg py-2.5 px-3 text-sm text-zinc-900 outline-none focus:border-pink-500">
                  {AI_PERSONALITIES.map(p => <option key={p} value={p}>{p}</option>)}
                </select>
              </div>
              <div className="space-y-3">
                <label className="text-[10px] font-bold text-zinc-600 uppercase tracking-wider">Style</label>
                <select value={aiStyle} onChange={e => setAiStyle(e.target.value)} className="w-full bg-white border border-zinc-300 rounded-lg py-2.5 px-3 text-sm text-zinc-900 outline-none focus:border-pink-500">
                  {AI_STYLES.map(s => <option key={s} value={s}>{s}</option>)}
                </select>
              </div>
            </div>
          )}
        </div>
        </div>
      )}

      <div className="grid w-full grid-cols-2 gap-[0.225rem] px-[0.15rem] pb-24 sm:gap-[0.3rem] sm:px-[0.3rem]">
        <ExploreSpotlightCard spotlight={exploreSpotlight} />
        {filteredUsers.length > 0 ? (
          filteredUsers.map((user) => (
            <div 
              key={user.id}
              onClick={() => (user.isLive && liveStreamingEnabled) ? onSelectLive(user) : onSelectUser(user)}
              className="relative aspect-[3/4] cursor-pointer overflow-hidden rounded-[0.65rem] border border-white transition-transform group active:scale-[0.99]"
            >
              <img 
                src={user.avatar} 
                alt={user.name} 
                className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-transparent"></div>
              
              {user.isAI && (
                 <div className="absolute top-2 left-2 flex items-center gap-1 bg-pink-600/80 backdrop-blur-md px-2 py-0.5 rounded text-[8px] font-black uppercase tracking-tighter text-white shadow-lg border border-white/20">
                    <span className="text-[10px]">🤖</span> AI
                  </div>
              )}
              {user.isLive && (
                <div className="absolute top-2 left-2 flex items-center gap-2">
                  <div className="flex items-center gap-1.5 bg-red-600 px-2.5 py-1 rounded-md text-[10px] font-black uppercase tracking-tighter text-white shadow-lg animate-pulse">
                    <span className="w-1.5 h-1.5 bg-white rounded-full"></span>
                    LIVE
                  </div>
                  {user.viewerCount && (
                     <div className="flex items-center gap-1.5 bg-black/50 backdrop-blur-sm px-2 py-1 rounded-md text-[10px] font-bold text-white shadow-lg">
                        <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"></path><circle cx="12" cy="12" r="3"></circle></svg>
                        <span>{user.viewerCount.toLocaleString()}</span>
                    </div>
                  )}
                </div>
              )}

              {user.badgeTier && user.badgeTier !== 'none' && (
                <div className="absolute top-2 right-2 text-[22px] drop-shadow-md" title={getBadges().find(b => b.id === user.badgeTier)?.name}>
                  {getBadges().find(b => b.id === user.badgeTier)?.icon}
                </div>
              )}

              <div className="absolute bottom-3 left-3 right-3">
                <div className="flex items-center gap-1.5">
                  <h3 className="text-[0.91875rem] font-bold text-white drop-shadow-md">{user.name}, {user.age}</h3>
                  {user.isOnline && !user.isLive && !user.isAI && <span className="w-3 h-3 bg-green-500 rounded-full"></span>}
                </div>
                <p className="text-[10px] text-zinc-300 truncate drop-shadow-md">
                  {user.isAI ? "AI Companion" : (user.isLive ? 'Tap to watch live' : `${user.distance} miles away`)}
                </p>
              </div>
            </div>
          ))
        ) : (
          <div className="flex aspect-[3/4] flex-col items-center justify-center rounded-[0.65rem] border border-dashed border-zinc-200 bg-zinc-50 px-3 text-center">
            <span className="text-3xl grayscale opacity-50">🔍</span>
            <h3 className="mt-2 text-sm font-bold text-zinc-600">No results</h3>
            <p className="mt-1 text-[10px] text-zinc-500">Try adjusting filters</p>
          </div>
        )}
      </div>

    </div>
  );
};

export default DiscoverView;
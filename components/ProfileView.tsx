
import React, { useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { User, BadgeTier, PayoutDetails } from '../types';
import { getBadges, getMonetizationSettings } from '../data';

interface ProfileViewProps {
  user: User;
  tokens: number;
  onGoShop: () => void;
  onUpdateAlbum: (newAlbum: string[]) => void;
  onUpdateProfile: (updates: Partial<User>) => void;
  onPurchaseBadge?: (tier: BadgeTier) => boolean;
  onLogout?: () => void;
}

const MAX_PHOTOS = 8;

const ProfileView: React.FC<ProfileViewProps> = ({ 
  user, 
  tokens, 
  onGoShop, 
  onUpdateAlbum, 
  onUpdateProfile,
  onPurchaseBadge,
  onLogout
}) => {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const avatarFileInputRef = useRef<HTMLInputElement>(null);
  const [viewingIndex, setViewingIndex] = useState<number | null>(null);
  const [showAvatarPicker, setShowAvatarPicker] = useState(false);
  const [editingBio, setEditingBio] = useState(false);
  const [bioDraft, setBioDraft] = useState(user.bio);
  const [editingBasic, setEditingBasic] = useState(false);
  const [basicDraft, setBasicDraft] = useState({ name: user.name, age: user.age, location: user.location });
  const [showBadgeShop, setShowBadgeShop] = useState(false);

  const handleUploadClick = () => {
    if (user.album.length >= MAX_PHOTOS) return;
    fileInputRef.current?.click();
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      if (user.album.length >= MAX_PHOTOS) {
        alert(`Maximum of ${MAX_PHOTOS} photos allowed.`);
        return;
      }
      const fakeUrl = URL.createObjectURL(file);
      onUpdateAlbum([fakeUrl, ...user.album]);
    }
    if (e.target) e.target.value = '';
  };

  const handleAvatarFromAlbum = (imgUrl: string) => {
    onUpdateProfile({ avatar: imgUrl });
    setShowAvatarPicker(false);
  };

  const handleAvatarUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const url = URL.createObjectURL(file);
      onUpdateProfile({ avatar: url });
      if (!user.album.includes(url)) {
        onUpdateAlbum([url, ...user.album.filter(a => a !== user.avatar)]);
      }
      setShowAvatarPicker(false);
    }
    if (e.target) e.target.value = '';
  };

  const nextImage = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (viewingIndex !== null) {
      setViewingIndex((viewingIndex + 1) % user.album.length);
    }
  };

  const prevImage = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (viewingIndex !== null) {
      setViewingIndex((viewingIndex - 1 + user.album.length) % user.album.length);
    }
  };
  
  const handleSelectPhoto = (photoUrl: string) => {
    onUpdateProfile({ avatar: photoUrl });
    setShowAvatarPicker(false);
  };

  const saveBio = () => {
    onUpdateProfile({ bio: bioDraft });
    setEditingBio(false);
  };

  const cancelBio = () => {
    setBioDraft(user.bio);
    setEditingBio(false);
  };

  const saveBasic = () => {
    onUpdateProfile({
      name: basicDraft.name,
      age: Math.max(18, Math.min(100, basicDraft.age)),
      location: basicDraft.location
    });
    setBasicDraft({ ...basicDraft, age: Math.max(18, Math.min(100, basicDraft.age)) });
    setEditingBasic(false);
  };

  const cancelBasic = () => {
    setBasicDraft({ name: user.name, age: user.age, location: user.location });
    setEditingBasic(false);
  };

  const purchaseBadge = (tier: BadgeTier) => {
    if (tier === 'none') return;
    const badgeInfo = getBadges().find(b => b.id === tier);
    if (!badgeInfo || badgeInfo.tokenCost === 0) return;
    const success = onPurchaseBadge?.(tier);
    if (success) setShowBadgeShop(false);
  };

  const currentBadge = getBadges().find(b => b.id === (user.badgeTier || 'none'));
  const earnings = user.earnings || 0;
  const transferredOut = user.transferredOut || 0;
  const outstanding = Math.max(0, earnings - transferredOut);
  const purchasableBadges = getBadges().filter(b => b.id !== 'none');
  const monetization = getMonetizationSettings();
  const vipBadgesEnabled = monetization.vipBadgesEnabled;
  const isLimitReached = user.album.length >= MAX_PHOTOS;
  const [showPayoutForm, setShowPayoutForm] = useState(false);
  const [withdrawAmount, setWithdrawAmount] = useState('');

  return (
    <div className="p-6">
      <div className="flex flex-col items-center gap-4 mb-8">
        <div className="relative">
          <img src={user.avatar} className="w-32 h-32 rounded-full border-4 border-zinc-800 shadow-2xl object-cover" />
          <button 
            onClick={() => setShowAvatarPicker(true)}
            className="absolute bottom-0 right-0 bg-pink-500 w-10 h-10 rounded-full flex items-center justify-center border-4 border-black text-white text-xl shadow-lg hover:bg-pink-600 active:scale-95 transition-all"
          >
            ✎
          </button>
        </div>
        <div className="text-center">
          {!editingBasic ? (
            <>
              <div className="flex items-center justify-center gap-2">
                <h2 className="text-2xl font-bold">{user.name}, {user.age}</h2>
                <button 
                  onClick={() => setEditingBasic(true)}
                  className="text-pink-500 text-sm p-1 hover:bg-pink-500/20 rounded"
                >
                  ✎
                </button>
              </div>
              <p className="text-zinc-500 text-sm">📍 {user.location}</p>
            </>
          ) : (
            <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-4 space-y-3 w-full max-w-xs">
              <input
                value={basicDraft.name}
                onChange={e => setBasicDraft({ ...basicDraft, name: e.target.value })}
                placeholder="Name"
                className="w-full bg-black border border-zinc-800 rounded-lg px-3 py-2 text-sm outline-none focus:border-pink-500"
              />
              <input
                type="number"
                value={basicDraft.age}
                onChange={e => setBasicDraft({ ...basicDraft, age: parseInt(e.target.value) || 18 })}
                placeholder="Age"
                min={18}
                max={100}
                className="w-full bg-black border border-zinc-800 rounded-lg px-3 py-2 text-sm outline-none focus:border-pink-500"
              />
              <input
                value={basicDraft.location}
                onChange={e => setBasicDraft({ ...basicDraft, location: e.target.value })}
                placeholder="Location"
                className="w-full bg-black border border-zinc-800 rounded-lg px-3 py-2 text-sm outline-none focus:border-pink-500"
              />
              <div className="flex gap-2">
                <button onClick={saveBasic} className="flex-1 bg-pink-500 py-2 rounded-lg font-bold text-sm">Save</button>
                <button onClick={cancelBasic} className="flex-1 bg-zinc-800 py-2 rounded-lg font-bold text-sm">Cancel</button>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* VIP Badge Section */}
      {vipBadgesEnabled && (
        <div className="bg-gradient-to-br from-amber-900/30 to-pink-900/30 rounded-3xl border border-amber-700/50 p-5 mb-8">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <span className="text-3xl">{currentBadge?.icon || '⭐'}</span>
              <div>
                <p className="text-[10px] text-amber-400/80 uppercase font-bold tracking-widest">VIP Badge</p>
                <p className="font-bold text-white">{currentBadge?.name || 'No Badge'}</p>
                <p className="text-[10px] text-zinc-500">Earn or purchase to rank higher on Explore</p>
              </div>
            </div>
            <button 
              onClick={() => setShowBadgeShop(true)}
              className="bg-amber-500/20 border border-amber-500/50 text-amber-400 px-4 py-2 rounded-full font-bold text-xs"
            >
              Get Badge
            </button>
          </div>
        </div>
      )}

      <div className="bg-zinc-900/50 rounded-3xl border border-zinc-800 p-6 flex items-center justify-between mb-8 shadow-inner">
        <div>
          <p className="text-zinc-500 text-xs uppercase font-bold tracking-widest mb-1">Balance</p>
          <h3 className="text-3xl font-black text-white flex items-center gap-2">
            <span>💎</span> {tokens}
          </h3>
        </div>
        <button 
          onClick={onGoShop}
          className="bg-white text-black px-6 py-2.5 rounded-full font-bold text-sm shadow-xl active:scale-95 transition-all"
        >
          Buy More
        </button>
      </div>

      {/* Payout - Earnings & Withdraw */}
      <div className="bg-gradient-to-br from-emerald-900/20 to-green-900/10 rounded-3xl border border-emerald-800/40 p-6 mb-8">
          <h4 className="text-xs font-bold text-emerald-400/80 uppercase tracking-widest mb-4">Payout</h4>
          <div className="grid grid-cols-3 gap-4 mb-4">
            <div>
              <p className="text-zinc-500 text-[10px] uppercase">Earnings</p>
              <p className="font-bold text-white">${earnings.toLocaleString()}</p>
            </div>
            <div>
              <p className="text-zinc-500 text-[10px] uppercase">Transferred</p>
              <p className="font-bold text-zinc-400">${transferredOut.toLocaleString()}</p>
            </div>
            <div>
              <p className="text-zinc-500 text-[10px] uppercase">Outstanding</p>
              <p className="font-bold text-emerald-400">${outstanding.toLocaleString()}</p>
            </div>
          </div>
          {!user.payoutDetails ? (
            <button onClick={() => setShowPayoutForm(true)} className="w-full py-3 bg-emerald-600/30 border border-emerald-500/50 text-emerald-400 rounded-xl font-bold text-sm">
              Add Bank or Mobile Money
            </button>
          ) : (
            <div className="space-y-3">
              <p className="text-xs text-zinc-500">
                {user.payoutDetails.type === 'bank'
                  ? `${user.payoutDetails.bankName} •••• ${user.payoutDetails.accountNumber?.slice(-4)}`
                  : `${user.payoutDetails.provider} ${user.payoutDetails.mobileNumber}`}
              </p>
              <div className="flex gap-2">
                <input
                  type="number"
                  step="0.01"
                  placeholder="Amount"
                  value={withdrawAmount}
                  onChange={(e) => setWithdrawAmount(e.target.value)}
                  className="flex-1 px-4 py-2 bg-zinc-800 border border-zinc-700 rounded-xl text-white text-sm"
                />
                <button
                  onClick={() => {
                    const amt = parseFloat(withdrawAmount);
                    if (amt > 0 && amt <= outstanding) {
                      onUpdateProfile({ transferredOut: transferredOut + amt });
                      setWithdrawAmount('');
                    }
                  }}
                  className="px-4 py-2 bg-emerald-600 text-white rounded-xl font-bold text-sm"
                >
                  Withdraw
                </button>
              </div>
              <button onClick={() => setShowPayoutForm(true)} className="text-xs text-zinc-500 hover:text-white">Change payout details</button>
            </div>
          )}
          {showPayoutForm && (
            <PayoutFormModal
              details={user.payoutDetails}
              onSave={(d) => { onUpdateProfile({ payoutDetails: d }); setShowPayoutForm(false); }}
              onClose={() => setShowPayoutForm(false)}
            />
          )}
      </div>

      <div className="space-y-8">
        <section>
          <div className="flex items-center justify-between mb-4 px-1">
            <div className="flex flex-col">
              <h4 className="text-xs font-bold text-zinc-500 uppercase tracking-widest">My Album</h4>
              <span className="text-[10px] text-zinc-600 font-medium">({user.album.length}/{MAX_PHOTOS} photos)</span>
            </div>
            {!isLimitReached && (
              <button 
                onClick={handleUploadClick}
                className="text-pink-500 text-xs font-bold hover:underline"
              >
                + Add Photo
              </button>
            )}
            <input 
              type="file" 
              ref={fileInputRef} 
              className="hidden" 
              accept="image/*"
              onChange={handleFileChange}
            />
          </div>
          <div className="grid grid-cols-3 gap-2">
            {user.album.map((img, idx) => (
              <div 
                key={idx} 
                onClick={() => setViewingIndex(idx)}
                className="aspect-square rounded-xl overflow-hidden bg-zinc-900 border border-zinc-800 cursor-pointer active:scale-95 transition-transform relative group"
              >
                <img src={img} className="w-full h-full object-cover" />
                {img === user.avatar && (
                  <div className="absolute inset-0 bg-black/40 flex items-center justify-center">
                    <span className="text-xs font-bold bg-pink-500 px-2 py-0.5 rounded">Profile</span>
                  </div>
                )}
              </div>
            ))}
            {!isLimitReached && (
              <div 
                onClick={handleUploadClick}
                className="aspect-square rounded-xl border-2 border-dashed border-zinc-800 flex flex-col items-center justify-center text-zinc-700 cursor-pointer hover:border-zinc-700 hover:text-zinc-500 transition-colors"
              >
                <span className="text-2xl">+</span>
                <span className="text-[10px] font-bold">Upload</span>
              </div>
            )}
          </div>
        </section>

        <section>
          <div className="flex items-center justify-between mb-3 px-1">
            <h4 className="text-xs font-bold text-zinc-500 uppercase tracking-widest">About Me</h4>
            {!editingBio ? (
              <button 
                onClick={() => setEditingBio(true)}
                className="text-pink-500 text-xs font-bold hover:underline"
              >
                Edit
              </button>
            ) : null}
          </div>
          {!editingBio ? (
            <p className="bg-zinc-900 border border-zinc-800 rounded-2xl p-4 text-sm text-zinc-300">
              {user.bio}
            </p>
          ) : (
            <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-4">
              <textarea
                value={bioDraft}
                onChange={e => setBioDraft(e.target.value)}
                placeholder="Tell others about yourself..."
                rows={4}
                className="w-full bg-black border border-zinc-800 rounded-lg px-3 py-2 text-sm text-zinc-300 outline-none focus:border-pink-500 resize-none"
              />
              <div className="flex gap-2 mt-3">
                <button onClick={saveBio} className="flex-1 bg-pink-500 py-2 rounded-lg font-bold text-sm">Save</button>
                <button onClick={cancelBio} className="flex-1 bg-zinc-800 py-2 rounded-lg font-bold text-sm">Cancel</button>
              </div>
            </div>
          )}
        </section>

        <section>
          <h4 className="text-xs font-bold text-zinc-500 uppercase tracking-widest mb-3 px-1">Settings</h4>
          <div className="bg-zinc-900 border border-zinc-800 rounded-2xl divide-y divide-zinc-800">
            {['Notification Settings', 'Discovery Preferences', 'Privacy & Safety', 'Help & Support'].map((item) => (
              <button key={item} className="w-full text-left px-4 py-4 text-sm font-medium flex justify-between items-center group">
                <span className="text-zinc-200">{item}</span>
                <span className="text-zinc-600 group-hover:translate-x-1 transition-transform">→</span>
              </button>
            ))}
          </div>
        </section>

        <button onClick={onLogout} className="w-full py-4 text-red-500 font-bold text-sm">
          Log Out
        </button>

        <Link to="/admin" className="block w-full py-3 text-center text-zinc-500 hover:text-zinc-400 text-xs font-medium">
          Admin Dashboard →
        </Link>
      </div>
      
      {/* Album Photo Selector Modal */}
      {isPhotoSelectorOpen && (
        <div 
          className="fixed inset-0 z-[100] bg-black/80 backdrop-blur-sm flex items-end justify-center animate-in fade-in duration-200"
          onClick={() => setIsPhotoSelectorOpen(false)}
        >
          <div 
              className="w-full max-w-md bg-zinc-950 border-t border-zinc-800 rounded-t-[32px] p-6 pb-12 relative animate-in slide-in-from-bottom duration-300"
              onClick={(e) => e.stopPropagation()}
          >
            <div className="w-12 h-1.5 bg-zinc-800 rounded-full mx-auto mb-6"></div>
            <h3 className="text-sm font-black uppercase tracking-widest text-zinc-400 text-center mb-6">Select New Profile Photo</h3>
            {user.album.length > 0 ? (
              <div className="grid grid-cols-3 gap-3 max-h-[40vh] overflow-y-auto">
                {user.album.map((img, idx) => (
                  <div 
                    key={idx} 
                    onClick={() => handleSelectPhoto(img)}
                    className="aspect-square rounded-xl overflow-hidden bg-zinc-900 border border-zinc-800 cursor-pointer active:scale-95 transition-transform hover:border-pink-500"
                  >
                    <img src={img} className="w-full h-full object-cover" />
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-center text-zinc-500 text-sm py-8">
                You have no photos in your album. Add some photos first!
              </p>
            )}
            <button 
              onClick={() => setIsPhotoSelectorOpen(false)}
              className="w-full mt-6 bg-zinc-800 py-3 rounded-xl font-bold text-white active:scale-95 transition-transform"
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {/* Avatar Picker Modal */}
      {showAvatarPicker && (
        <div className="fixed inset-0 z-[100] bg-black/90 flex flex-col items-center justify-center p-6" onClick={() => setShowAvatarPicker(false)}>
          <div className="bg-zinc-900 border border-zinc-800 rounded-3xl p-6 w-full max-w-sm" onClick={e => e.stopPropagation()}>
            <h3 className="text-lg font-bold mb-4">Change Profile Photo</h3>
            <div className="space-y-3">
              <button
                onClick={() => { avatarFileInputRef.current?.click(); }}
                className="w-full bg-pink-500 py-3 rounded-xl font-bold text-sm"
              >
                📷 Upload from device
              </button>
              <input type="file" ref={avatarFileInputRef} className="hidden" accept="image/*" onChange={handleAvatarUpload} />
              {user.album.length > 0 && (
                <>
                  <p className="text-xs text-zinc-500 font-bold uppercase">Or choose from album</p>
                  <div className="grid grid-cols-3 gap-2 max-h-40 overflow-y-auto">
                    {user.album.map((img, idx) => (
                      <button
                        key={idx}
                        onClick={() => handleAvatarFromAlbum(img)}
                        className={`aspect-square rounded-xl overflow-hidden border-2 ${img === user.avatar ? 'border-pink-500' : 'border-zinc-800'}`}
                      >
                        <img src={img} className="w-full h-full object-cover" />
                      </button>
                    ))}
                  </div>
                </>
              )}
            </div>
            <button onClick={() => setShowAvatarPicker(false)} className="w-full mt-4 py-2 text-zinc-400 text-sm">Cancel</button>
          </div>
        </div>
      )}

      {/* Badge Shop Modal */}
      {showBadgeShop && (
        <div className="fixed inset-0 z-[100] bg-black/90 flex flex-col items-center justify-center p-6 overflow-y-auto" onClick={() => setShowBadgeShop(false)}>
          <div className="bg-zinc-900 border border-zinc-800 rounded-3xl p-6 w-full max-w-sm max-h-[85vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
            <h3 className="text-lg font-bold mb-2">VIP Badges</h3>
            <p className="text-xs text-zinc-500 mb-4">Purchase with tokens or earn by receiving gifts on live streams</p>
            <div className="space-y-3">
              {purchasableBadges.map(badge => {
                const canEarn = badge.minEarningsToEarn > 0 && earnings >= badge.minEarningsToEarn;
                const canPurchase = tokens >= badge.tokenCost;
                const isCurrent = user.badgeTier === badge.id;
                return (
                  <div 
                    key={badge.id}
                    className={`flex items-center justify-between p-4 rounded-2xl border ${isCurrent ? 'border-amber-500/50 bg-amber-500/10' : 'border-zinc-800 bg-zinc-900/50'}`}
                  >
                    <div className="flex items-center gap-3">
                      <span className="text-2xl">{badge.icon}</span>
                      <div>
                        <p className="font-bold">{badge.name}</p>
                        <p className="text-[10px] text-zinc-500">
                          {badge.tokenCost} 💎 or earn at {badge.minEarningsToEarn} gifts
                        </p>
                      </div>
                    </div>
                    {isCurrent ? (
                      <span className="text-xs font-bold text-amber-400">Current</span>
                    ) : canEarn ? (
                      <button 
                        onClick={() => { onUpdateProfile({ badgeTier: badge.id }); setShowBadgeShop(false); }}
                        className="text-xs font-bold text-green-400"
                      >
                        Claim Free
                      </button>
                    ) : canPurchase ? (
                      <button 
                        onClick={() => purchaseBadge(badge.id)}
                        className="bg-amber-500 text-black px-3 py-1 rounded-lg text-xs font-bold"
                      >
                        Buy
                      </button>
                    ) : (
                      <button 
                        onClick={onGoShop}
                        className="text-xs text-amber-400 font-bold"
                      >
                        Get {badge.tokenCost - tokens} more 💎
                      </button>
                    )}
                  </div>
                );
              })}
            </div>
            <button onClick={() => setShowBadgeShop(false)} className="w-full mt-4 py-2 text-zinc-400 text-sm">Close</button>
          </div>
        </div>
      )}

      {/* Full Screen Image Viewer */}
      {viewingIndex !== null && (
        <div 
          className="fixed inset-0 z-[100] bg-black/95 flex flex-col items-center justify-center animate-in fade-in duration-200"
          onClick={() => setViewingIndex(null)}
        >
          <button 
            className="absolute top-6 right-6 w-12 h-12 bg-zinc-800/50 rounded-full flex items-center justify-center text-white text-2xl z-10"
            onClick={() => setViewingIndex(null)}
          >
            ✕
          </button>
          
          <div className="absolute top-6 left-6 z-10">
            {user.album[viewingIndex] !== user.avatar && (
              <button
                onClick={(e) => { e.stopPropagation(); handleAvatarFromAlbum(user.album[viewingIndex]); setViewingIndex(null); }}
                className="bg-pink-500 px-3 py-1.5 rounded-full text-xs font-bold"
              >
                Set as profile pic
              </button>
            )}
          </div>
          
          <div className="relative w-full h-full flex items-center justify-center p-4">
            <button 
              className="absolute left-4 w-12 h-12 bg-white/10 rounded-full flex items-center justify-center text-white text-2xl backdrop-blur-md"
              onClick={prevImage}
            >
              ‹
            </button>
            
            <img 
              src={user.album[viewingIndex]} 
              className="max-w-full max-h-full object-contain shadow-2xl rounded-lg"
              onClick={(e) => e.stopPropagation()}
            />
            
            <button 
              className="absolute right-4 w-12 h-12 bg-white/10 rounded-full flex items-center justify-center text-white text-2xl backdrop-blur-md"
              onClick={nextImage}
            >
              ›
            </button>
          </div>
          
          <div className="absolute bottom-8 text-white/50 text-xs font-bold tracking-widest">
            {viewingIndex + 1} / {user.album.length}
          </div>
        </div>
      )}
    </div>
  );
};

const PayoutFormModal: React.FC<{ details?: PayoutDetails | null; onSave: (d: PayoutDetails) => void; onClose: () => void }> = ({ details, onSave, onClose }) => {
  const [type, setType] = useState<'bank' | 'mobile_money'>(details?.type || 'bank');
  const [bankName, setBankName] = useState(details?.bankName || '');
  const [accountNumber, setAccountNumber] = useState(details?.accountNumber || '');
  const [accountName, setAccountName] = useState(details?.accountName || '');
  const [provider, setProvider] = useState(details?.provider || '');
  const [mobileNumber, setMobileNumber] = useState(details?.mobileNumber || '');

  const handleSave = () => {
    if (type === 'bank') {
      if (!bankName || !accountNumber || !accountName) { alert('Fill all bank fields'); return; }
      onSave({ type: 'bank', bankName, accountNumber, accountName });
    } else {
      if (!provider || !mobileNumber) { alert('Fill provider and mobile number'); return; }
      onSave({ type: 'mobile_money', provider, mobileNumber });
    }
  };

  return (
    <div className="fixed inset-0 z-[100] bg-black/90 flex items-center justify-center p-6" onClick={onClose}>
      <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-6 w-full max-w-sm" onClick={e => e.stopPropagation()}>
        <h3 className="text-lg font-bold mb-4">Add Payout Details</h3>
        <div className="flex gap-4 mb-4">
          <label className="flex items-center gap-2 cursor-pointer"><input type="radio" checked={type === 'bank'} onChange={() => setType('bank')} /> Bank</label>
          <label className="flex items-center gap-2 cursor-pointer"><input type="radio" checked={type === 'mobile_money'} onChange={() => setType('mobile_money')} /> Mobile Money</label>
        </div>
        {type === 'bank' ? (
          <div className="space-y-3">
            <input value={bankName} onChange={e => setBankName(e.target.value)} placeholder="Bank name" className="w-full px-4 py-2 bg-zinc-800 border border-zinc-700 rounded-xl text-white text-sm" />
            <input value={accountNumber} onChange={e => setAccountNumber(e.target.value)} placeholder="Account number" className="w-full px-4 py-2 bg-zinc-800 border border-zinc-700 rounded-xl text-white text-sm" />
            <input value={accountName} onChange={e => setAccountName(e.target.value)} placeholder="Account name" className="w-full px-4 py-2 bg-zinc-800 border border-zinc-700 rounded-xl text-white text-sm" />
          </div>
        ) : (
          <div className="space-y-3">
            <div className="flex gap-2 flex-wrap">
              {['MTN', 'Vodafone', 'AirtelTigo'].map(p => (
                <button key={p} onClick={() => setProvider(p)} className={`px-3 py-1 rounded text-sm ${provider === p ? 'bg-pink-600 text-white' : 'bg-zinc-800 text-zinc-400'}`}>{p}</button>
              ))}
            </div>
            <input value={mobileNumber} onChange={e => setMobileNumber(e.target.value)} placeholder="Mobile number" className="w-full px-4 py-2 bg-zinc-800 border border-zinc-700 rounded-xl text-white text-sm" />
          </div>
        )}
        <div className="flex gap-2 mt-4">
          <button onClick={onClose} className="flex-1 py-2 text-zinc-400 text-sm">Cancel</button>
          <button onClick={handleSave} className="flex-1 py-2 bg-pink-600 rounded-xl font-bold text-sm">Save</button>
        </div>
      </div>
    </div>
  );
};

export default ProfileView;

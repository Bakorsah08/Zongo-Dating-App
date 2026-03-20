
import React, { useRef, useState } from 'react';
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
  const [isPhotoSelectorOpen, setIsPhotoSelectorOpen] = useState(false);
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
    <div className="min-h-full bg-white p-6 pb-28 text-zinc-900">
      <div className="mb-8 flex flex-col items-center gap-4">
        <div className="relative">
          <img src={user.avatar} className="h-32 w-32 rounded-full border-4 border-zinc-200 object-cover shadow-lg" />
          <button 
            onClick={() => setShowAvatarPicker(true)}
            className="absolute bottom-0 right-0 flex h-10 w-10 items-center justify-center rounded-full border-4 border-white bg-pink-500 text-xl text-white shadow-md transition-all hover:bg-pink-600 active:scale-95"
          >
            ✎
          </button>
        </div>
        <div className="text-center">
          {!editingBasic ? (
            <>
              <div className="flex items-center justify-center gap-2">
                <h2 className="text-2xl font-bold text-zinc-900">{user.name}, {user.age}</h2>
                <button 
                  onClick={() => setEditingBasic(true)}
                  className="rounded p-1 text-sm text-pink-600 transition-colors hover:bg-pink-50"
                >
                  ✎
                </button>
              </div>
              <p className="text-sm text-zinc-500">📍 {user.location}</p>
            </>
          ) : (
            <div className="w-full max-w-xs space-y-3 rounded-2xl border border-zinc-200 bg-zinc-50 p-4">
              <input
                value={basicDraft.name}
                onChange={e => setBasicDraft({ ...basicDraft, name: e.target.value })}
                placeholder="Name"
                className="w-full rounded-lg border border-zinc-200 bg-white px-3 py-2 text-sm text-zinc-900 outline-none focus:border-pink-500"
              />
              <input
                type="number"
                value={basicDraft.age}
                onChange={e => setBasicDraft({ ...basicDraft, age: parseInt(e.target.value) || 18 })}
                placeholder="Age"
                min={18}
                max={100}
                className="w-full rounded-lg border border-zinc-200 bg-white px-3 py-2 text-sm text-zinc-900 outline-none focus:border-pink-500"
              />
              <input
                value={basicDraft.location}
                onChange={e => setBasicDraft({ ...basicDraft, location: e.target.value })}
                placeholder="Location"
                className="w-full rounded-lg border border-zinc-200 bg-white px-3 py-2 text-sm text-zinc-900 outline-none focus:border-pink-500"
              />
              <div className="flex gap-2">
                <button onClick={saveBasic} className="flex-1 rounded-lg bg-pink-600 py-2 text-sm font-bold text-white">Save</button>
                <button onClick={cancelBasic} className="flex-1 rounded-lg border border-zinc-200 bg-white py-2 text-sm font-bold text-zinc-700">Cancel</button>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* VIP Badge Section */}
      {vipBadgesEnabled && (
        <div className="mb-8 rounded-3xl border border-amber-200 bg-gradient-to-br from-amber-50 to-pink-50 p-5">
          <div className="flex items-center justify-between gap-3">
            <div className="flex min-w-0 items-center gap-3">
              <span className="text-3xl">{currentBadge?.icon || '⭐'}</span>
              <div className="min-w-0">
                <p className="text-[10px] font-bold uppercase tracking-widest text-amber-800/90">VIP Badge</p>
                <p className="font-bold text-zinc-900">{currentBadge?.name || 'No Badge'}</p>
                <p className="text-[10px] text-zinc-600">Earn or purchase to rank higher on Explore</p>
              </div>
            </div>
            <button 
              onClick={() => setShowBadgeShop(true)}
              className="shrink-0 rounded-full border border-amber-300 bg-amber-100 px-4 py-2 text-xs font-bold text-amber-900 transition-colors hover:bg-amber-200"
            >
              Get Badge
            </button>
          </div>
        </div>
      )}

      <div className="mb-8 flex items-center justify-between rounded-3xl border border-zinc-200 bg-zinc-50 p-6 shadow-sm">
        <div>
          <p className="mb-1 text-xs font-bold uppercase tracking-widest text-zinc-500">Balance</p>
          <h3 className="flex items-center gap-2 text-3xl font-black text-zinc-900">
            <span>💎</span> {tokens}
          </h3>
        </div>
        <button 
          onClick={onGoShop}
          className="rounded-full bg-pink-600 px-6 py-2.5 text-sm font-bold text-white shadow-md transition-all active:scale-95 hover:bg-pink-500"
        >
          Buy More
        </button>
      </div>

      {/* Payout - Earnings & Withdraw */}
      <div className="mb-8 rounded-3xl border border-emerald-200 bg-gradient-to-br from-emerald-50 to-green-50 p-6">
          <h4 className="mb-4 text-xs font-bold uppercase tracking-widest text-emerald-800">Payout</h4>
          <div className="mb-4 grid grid-cols-3 gap-4">
            <div>
              <p className="text-[10px] uppercase text-zinc-500">Earnings</p>
              <p className="font-bold text-zinc-900">${earnings.toLocaleString()}</p>
            </div>
            <div>
              <p className="text-[10px] uppercase text-zinc-500">Transferred</p>
              <p className="font-bold text-zinc-600">${transferredOut.toLocaleString()}</p>
            </div>
            <div>
              <p className="text-[10px] uppercase text-zinc-500">Outstanding</p>
              <p className="font-bold text-emerald-700">${outstanding.toLocaleString()}</p>
            </div>
          </div>
          {!user.payoutDetails ? (
            <button onClick={() => setShowPayoutForm(true)} className="w-full rounded-xl border border-emerald-300 bg-emerald-600 py-3 text-sm font-bold text-white shadow-sm transition-colors hover:bg-emerald-500">
              Add Bank or Mobile Money
            </button>
          ) : (
            <div className="space-y-3">
              <p className="text-xs text-zinc-600">
                {user.payoutDetails.type === 'bank'
                  ? `${user.payoutDetails.bankName} •••• ${user.payoutDetails.accountNumber?.slice(-4)}`
                  : `${user.payoutDetails.provider} ${user.payoutDetails.mobileNumber}`}
              </p>
              <div className="flex flex-col gap-2">
                <input
                  type="number"
                  step="0.01"
                  placeholder="Amount"
                  value={withdrawAmount}
                  onChange={(e) => setWithdrawAmount(e.target.value)}
                  className="w-full rounded-xl border border-zinc-200 bg-white px-4 py-2 text-sm text-zinc-900"
                />
                <button
                  type="button"
                  onClick={() => {
                    const amt = parseFloat(withdrawAmount);
                    if (amt > 0 && amt <= outstanding) {
                      onUpdateProfile({ transferredOut: transferredOut + amt });
                      setWithdrawAmount('');
                    }
                  }}
                  className="w-full rounded-xl bg-emerald-600 py-2.5 text-sm font-bold text-white hover:bg-emerald-500"
                >
                  Withdraw
                </button>
              </div>
              <button onClick={() => setShowPayoutForm(true)} className="text-xs text-pink-600 hover:underline">Change payout details</button>
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
          <div className="mb-4 flex items-center justify-between px-1">
            <div className="flex flex-col">
              <h4 className="text-xs font-bold uppercase tracking-widest text-zinc-500">My Album</h4>
              <span className="text-[10px] font-medium text-zinc-500">({user.album.length}/{MAX_PHOTOS} photos)</span>
            </div>
            {!isLimitReached && (
              <button 
                onClick={handleUploadClick}
                className="text-xs font-bold text-pink-600 hover:underline"
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
                className="group relative aspect-square cursor-pointer overflow-hidden rounded-xl border border-zinc-200 bg-zinc-100 transition-transform active:scale-95"
              >
                <img src={img} className="h-full w-full object-cover" />
                {img === user.avatar && (
                  <div className="absolute inset-0 flex items-center justify-center bg-black/35">
                    <span className="rounded bg-pink-600 px-2 py-0.5 text-xs font-bold text-white">Profile</span>
                  </div>
                )}
              </div>
            ))}
            {!isLimitReached && (
              <div 
                onClick={handleUploadClick}
                className="flex aspect-square cursor-pointer flex-col items-center justify-center rounded-xl border-2 border-dashed border-zinc-300 text-zinc-500 transition-colors hover:border-pink-300 hover:text-pink-600"
              >
                <span className="text-2xl">+</span>
                <span className="text-[10px] font-bold">Upload</span>
              </div>
            )}
          </div>
        </section>

        <section>
          <div className="mb-3 flex items-center justify-between px-1">
            <h4 className="text-xs font-bold uppercase tracking-widest text-zinc-500">About Me</h4>
            {!editingBio ? (
              <button 
                onClick={() => setEditingBio(true)}
                className="text-xs font-bold text-pink-600 hover:underline"
              >
                Edit
              </button>
            ) : null}
          </div>
          {!editingBio ? (
            <p className="rounded-2xl border border-zinc-200 bg-zinc-50 p-4 text-sm text-zinc-700">
              {user.bio}
            </p>
          ) : (
            <div className="rounded-2xl border border-zinc-200 bg-zinc-50 p-4">
              <textarea
                value={bioDraft}
                onChange={e => setBioDraft(e.target.value)}
                placeholder="Tell others about yourself..."
                rows={4}
                className="w-full resize-none rounded-lg border border-zinc-200 bg-white px-3 py-2 text-sm text-zinc-900 outline-none focus:border-pink-500"
              />
              <div className="mt-3 flex gap-2">
                <button onClick={saveBio} className="flex-1 rounded-lg bg-pink-600 py-2 text-sm font-bold text-white">Save</button>
                <button onClick={cancelBio} className="flex-1 rounded-lg border border-zinc-200 bg-white py-2 text-sm font-bold text-zinc-700">Cancel</button>
              </div>
            </div>
          )}
        </section>

        <section>
          <h4 className="mb-3 px-1 text-xs font-bold uppercase tracking-widest text-zinc-500">Settings</h4>
          <div className="divide-y divide-zinc-100 rounded-2xl border border-zinc-200 bg-white">
            {['Notification Settings', 'Discovery Preferences', 'Privacy & Safety', 'Help & Support'].map((item) => (
              <button key={item} className="group flex w-full items-center justify-between px-4 py-4 text-left text-sm font-medium">
                <span className="text-zinc-800">{item}</span>
                <span className="text-zinc-400 transition-transform group-hover:translate-x-1">→</span>
              </button>
            ))}
          </div>
        </section>

        <button onClick={onLogout} className="w-full py-4 text-sm font-bold text-red-600">
          Log Out
        </button>
      </div>
      
      {/* Album Photo Selector Modal */}
      {isPhotoSelectorOpen && (
        <div 
          className="fixed inset-0 z-[100] flex animate-in items-end justify-center bg-black/40 backdrop-blur-sm fade-in duration-200"
          onClick={() => setIsPhotoSelectorOpen(false)}
        >
          <div 
              className="relative w-full max-w-md animate-in rounded-t-[32px] border-t border-zinc-200 bg-white p-6 pb-12 slide-in-from-bottom duration-300"
              onClick={(e) => e.stopPropagation()}
          >
            <div className="mx-auto mb-6 h-1.5 w-12 rounded-full bg-zinc-300"></div>
            <h3 className="mb-6 text-center text-sm font-black uppercase tracking-widest text-zinc-500">Select New Profile Photo</h3>
            {user.album.length > 0 ? (
              <div className="grid max-h-[40vh] grid-cols-3 gap-3 overflow-y-auto">
                {user.album.map((img, idx) => (
                  <div 
                    key={idx} 
                    onClick={() => handleSelectPhoto(img)}
                    className="aspect-square cursor-pointer overflow-hidden rounded-xl border border-zinc-200 bg-zinc-50 transition-transform hover:border-pink-400 active:scale-95"
                  >
                    <img src={img} className="h-full w-full object-cover" />
                  </div>
                ))}
              </div>
            ) : (
              <p className="py-8 text-center text-sm text-zinc-500">
                You have no photos in your album. Add some photos first!
              </p>
            )}
            <button 
              onClick={() => setIsPhotoSelectorOpen(false)}
              className="mt-6 w-full rounded-xl border border-zinc-200 bg-zinc-50 py-3 font-bold text-zinc-800 transition-transform active:scale-[0.99]"
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {/* Avatar Picker Modal */}
      {showAvatarPicker && (
        <div className="fixed inset-0 z-[100] flex flex-col items-center justify-center bg-black/40 p-6 backdrop-blur-sm" onClick={() => setShowAvatarPicker(false)}>
          <div className="w-full max-w-sm rounded-3xl border border-zinc-200 bg-white p-6 shadow-xl" onClick={e => e.stopPropagation()}>
            <h3 className="mb-4 text-lg font-bold text-zinc-900">Change Profile Photo</h3>
            <div className="space-y-3">
              <button
                onClick={() => { avatarFileInputRef.current?.click(); }}
                className="w-full rounded-xl bg-pink-600 py-3 text-sm font-bold text-white hover:bg-pink-500"
              >
                📷 Upload from device
              </button>
              <input type="file" ref={avatarFileInputRef} className="hidden" accept="image/*" onChange={handleAvatarUpload} />
              {user.album.length > 0 && (
                <>
                  <p className="text-xs font-bold uppercase text-zinc-500">Or choose from album</p>
                  <div className="grid max-h-40 grid-cols-3 gap-2 overflow-y-auto">
                    {user.album.map((img, idx) => (
                      <button
                        key={idx}
                        type="button"
                        onClick={() => handleAvatarFromAlbum(img)}
                        className={`aspect-square overflow-hidden rounded-xl border-2 ${img === user.avatar ? 'border-pink-500' : 'border-zinc-200'}`}
                      >
                        <img src={img} className="h-full w-full object-cover" />
                      </button>
                    ))}
                  </div>
                </>
              )}
            </div>
            <button type="button" onClick={() => setShowAvatarPicker(false)} className="mt-4 w-full py-2 text-sm text-zinc-500 hover:text-zinc-800">Cancel</button>
          </div>
        </div>
      )}

      {/* Badge Shop Modal */}
      {showBadgeShop && (
        <div className="fixed inset-0 z-[100] flex flex-col items-center justify-center overflow-y-auto bg-black/40 p-6 backdrop-blur-sm" onClick={() => setShowBadgeShop(false)}>
          <div className="max-h-[85vh] w-full max-w-sm overflow-y-auto rounded-3xl border border-zinc-200 bg-white p-6 shadow-xl" onClick={e => e.stopPropagation()}>
            <h3 className="mb-2 text-lg font-bold text-zinc-900">VIP Badges</h3>
            <p className="mb-4 text-xs text-zinc-600">Purchase with tokens or earn by receiving gifts on live streams</p>
            <div className="space-y-3">
              {purchasableBadges.map(badge => {
                const canEarn = badge.minEarningsToEarn > 0 && earnings >= badge.minEarningsToEarn;
                const canPurchase = tokens >= badge.tokenCost;
                const isCurrent = user.badgeTier === badge.id;
                return (
                  <div 
                    key={badge.id}
                    className={`flex items-center justify-between rounded-2xl border p-4 ${isCurrent ? 'border-amber-300 bg-amber-50' : 'border-zinc-200 bg-zinc-50'}`}
                  >
                    <div className="flex items-center gap-3">
                      <span className="text-2xl">{badge.icon}</span>
                      <div>
                        <p className="font-bold text-zinc-900">{badge.name}</p>
                        <p className="text-[10px] text-zinc-600">
                          {badge.tokenCost} 💎 or earn at {badge.minEarningsToEarn} gifts
                        </p>
                      </div>
                    </div>
                    {isCurrent ? (
                      <span className="text-xs font-bold text-amber-800">Current</span>
                    ) : canEarn ? (
                      <button 
                        type="button"
                        onClick={() => { onUpdateProfile({ badgeTier: badge.id }); setShowBadgeShop(false); }}
                        className="text-xs font-bold text-emerald-600 hover:underline"
                      >
                        Claim Free
                      </button>
                    ) : canPurchase ? (
                      <button 
                        type="button"
                        onClick={() => purchaseBadge(badge.id)}
                        className="rounded-lg bg-amber-500 px-3 py-1 text-xs font-bold text-zinc-900 hover:bg-amber-400"
                      >
                        Buy
                      </button>
                    ) : (
                      <button 
                        type="button"
                        onClick={onGoShop}
                        className="text-xs font-bold text-amber-700 hover:underline"
                      >
                        Get {badge.tokenCost - tokens} more 💎
                      </button>
                    )}
                  </div>
                );
              })}
            </div>
            <button type="button" onClick={() => setShowBadgeShop(false)} className="mt-4 w-full py-2 text-sm text-zinc-500 hover:text-zinc-800">Close</button>
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
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/40 p-6 backdrop-blur-sm" onClick={onClose}>
      <div className="w-full max-w-sm rounded-2xl border border-zinc-200 bg-white p-6 shadow-xl" onClick={e => e.stopPropagation()}>
        <h3 className="mb-4 text-lg font-bold text-zinc-900">Add Payout Details</h3>
        <div className="mb-4 flex gap-4 text-sm text-zinc-800">
          <label className="flex cursor-pointer items-center gap-2"><input type="radio" checked={type === 'bank'} onChange={() => setType('bank')} /> Bank</label>
          <label className="flex cursor-pointer items-center gap-2"><input type="radio" checked={type === 'mobile_money'} onChange={() => setType('mobile_money')} /> Mobile Money</label>
        </div>
        {type === 'bank' ? (
          <div className="space-y-3">
            <input value={bankName} onChange={e => setBankName(e.target.value)} placeholder="Bank name" className="w-full rounded-xl border border-zinc-200 bg-zinc-50 px-4 py-2 text-sm text-zinc-900" />
            <input value={accountNumber} onChange={e => setAccountNumber(e.target.value)} placeholder="Account number" className="w-full rounded-xl border border-zinc-200 bg-zinc-50 px-4 py-2 text-sm text-zinc-900" />
            <input value={accountName} onChange={e => setAccountName(e.target.value)} placeholder="Account name" className="w-full rounded-xl border border-zinc-200 bg-zinc-50 px-4 py-2 text-sm text-zinc-900" />
          </div>
        ) : (
          <div className="space-y-3">
            <div className="flex flex-wrap gap-2">
              {['MTN', 'Vodafone', 'AirtelTigo'].map(p => (
                <button key={p} type="button" onClick={() => setProvider(p)} className={`rounded px-3 py-1 text-sm ${provider === p ? 'bg-pink-600 text-white' : 'border border-zinc-200 bg-zinc-100 text-zinc-700'}`}>{p}</button>
              ))}
            </div>
            <input value={mobileNumber} onChange={e => setMobileNumber(e.target.value)} placeholder="Mobile number" className="w-full rounded-xl border border-zinc-200 bg-zinc-50 px-4 py-2 text-sm text-zinc-900" />
          </div>
        )}
        <div className="mt-4 flex gap-2">
          <button type="button" onClick={onClose} className="flex-1 rounded-xl border border-zinc-200 py-2 text-sm text-zinc-600">Cancel</button>
          <button type="button" onClick={handleSave} className="flex-1 rounded-xl bg-pink-600 py-2 text-sm font-bold text-white hover:bg-pink-500">Save</button>
        </div>
      </div>
    </div>
  );
};

export default ProfileView;

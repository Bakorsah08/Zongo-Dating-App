
import React, { useRef, useState } from 'react';
import { User } from '../types';

interface ProfileViewProps {
  user: User;
  tokens: number;
  onGoShop: () => void;
  onUpdateAlbum: (newAlbum: string[]) => void;
  onUpdateAvatar: (newAvatarUrl: string) => void;
}

const MAX_PHOTOS = 8;

const ProfileView: React.FC<ProfileViewProps> = ({ user, tokens, onGoShop, onUpdateAlbum, onUpdateAvatar }) => {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [viewingIndex, setViewingIndex] = useState<number | null>(null);
  const [isPhotoSelectorOpen, setIsPhotoSelectorOpen] = useState(false);

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
    // Reset the input value so the same file can be uploaded if deleted and re-added
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
    onUpdateAvatar(photoUrl);
    setIsPhotoSelectorOpen(false);
  };

  const isLimitReached = user.album.length >= MAX_PHOTOS;

  return (
    <div className="p-6">
      <div className="flex flex-col items-center gap-4 mb-8">
        <div className="relative">
          <img src={user.avatar} className="w-32 h-32 rounded-full border-4 border-zinc-800 shadow-2xl object-cover" />
          <button 
            onClick={() => setIsPhotoSelectorOpen(true)}
            className="absolute bottom-0 right-0 bg-pink-500 w-10 h-10 rounded-full flex items-center justify-center border-4 border-black text-white text-xl shadow-lg active:scale-90 transition-transform"
          >
            ✎
          </button>
        </div>
        <div className="text-center">
          <h2 className="text-2xl font-bold">{user.name}, {user.age}</h2>
          <p className="text-zinc-500 text-sm">📍 {user.location}</p>
        </div>
      </div>

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
                className="aspect-square rounded-xl overflow-hidden bg-zinc-900 border border-zinc-800 cursor-pointer active:scale-95 transition-transform"
              >
                <img src={img} className="w-full h-full object-cover" />
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
          <h4 className="text-xs font-bold text-zinc-500 uppercase tracking-widest mb-3 px-1">About Me</h4>
          <p className="bg-zinc-900 border border-zinc-800 rounded-2xl p-4 text-sm text-zinc-300">
            {user.bio}
          </p>
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

        <button className="w-full py-4 text-red-500 font-bold text-sm">
          Log Out
        </button>
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

export default ProfileView;
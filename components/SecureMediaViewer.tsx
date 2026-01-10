
import React, { useEffect } from 'react';

interface SecureMediaViewerProps {
  mediaUrl: string;
  mediaType: 'image' | 'video';
  onClose: () => void;
}

const SecureMediaViewer: React.FC<SecureMediaViewerProps> = ({ mediaUrl, mediaType, onClose }) => {
  useEffect(() => {
    // Prevent scrolling on the body
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = 'auto';
    };
  }, []);

  return (
    <div 
      className="fixed inset-0 z-[100] bg-black/90 backdrop-blur-sm flex flex-col items-center justify-center animate-in fade-in duration-200"
      onClick={onClose}
      onContextMenu={(e) => e.preventDefault()} // Disable right-click on the whole viewer
    >
      <button 
        className="absolute top-6 right-6 w-12 h-12 bg-zinc-800/50 rounded-full flex items-center justify-center text-white text-2xl z-20 border border-white/10"
        onClick={onClose}
      >
        ✕
      </button>

      {/* Main Content Area */}
      <div className="relative w-full h-full flex items-center justify-center p-4">
        {mediaType === 'image' ? (
          <img 
            src={mediaUrl} 
            className="max-w-full max-h-full object-contain shadow-2xl rounded-lg"
            onClick={(e) => e.stopPropagation()} // Prevent closing when clicking the image
            onContextMenu={(e) => e.preventDefault()}
          />
        ) : (
          <video 
            src={mediaUrl} 
            className="max-w-full max-h-full object-contain shadow-2xl rounded-lg"
            controls
            controlsList="nodownload" // Disable download button in controls
            onClick={(e) => e.stopPropagation()}
            onContextMenu={(e) => e.preventDefault()}
            autoPlay
          />
        )}
      </div>

      {/* Anti-screenshot Watermark Overlay */}
      <div className="absolute inset-0 z-10 flex flex-wrap items-center justify-center overflow-hidden pointer-events-none select-none">
        {Array.from({ length: 100 }).map((_, i) => (
          <span 
            key={i} 
            className="text-white/5 font-black text-lg -rotate-[30deg] m-4"
          >
            HeartSync Protected
          </span>
        ))}
      </div>
    </div>
  );
};

export default SecureMediaViewer;
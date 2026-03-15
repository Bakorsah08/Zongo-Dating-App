
import React, { useState, useRef, useEffect } from 'react';
import { User, Message } from '../types';
import { generateChatResponse } from '../services/geminiService';
import { getMonetizationSettings } from '../data';

interface ChatRoomViewProps {
  partner: User;
  onBack: () => void;
  onVideoCall: () => void;
  onViewProfile: () => void;
}

const ChatRoomView: React.FC<ChatRoomViewProps> = ({ partner, onBack, onVideoCall, onViewProfile }) => {
  const { videoCallTokens, videoCallEnabled } = getMonetizationSettings();
  const [messages, setMessages] = useState<Message[]>([
    { id: '1', senderId: partner.id, text: `Hey! I'm ${partner.name}. Nice to meet you!`, timestamp: Date.now() - 100000 }
  ]);
  const [input, setInput] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [viewerState, setViewerState] = useState<{
    isOpen: boolean;
    url: string;
    type: 'image' | 'video';
  }>({ isOpen: false, url: '', type: 'image' });

  useEffect(() => {
    scrollRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, isTyping]);

  const handleSend = async () => {
    if (!input.trim()) return;

    const userMsg: Message = {
      id: Date.now().toString(),
      senderId: 'me',
      text: input,
      timestamp: Date.now()
    };
    setInput('');
    setMessages(prev => [...prev, userMsg]);
    
    setIsTyping(true);
    const aiResponse = await generateChatResponse(input, partner.name);
    
    setIsTyping(false);
    const partnerMsg: Message = {
      id: (Date.now() + 1).toString(),
      senderId: partner.id,
      text: aiResponse || "That's cool!",
      timestamp: Date.now()
    };
    setMessages(prev => [...prev, partnerMsg]);
  };
  
  const handleFileSelect = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    const url = URL.createObjectURL(file);
    const message: Message = {
      id: Date.now().toString(),
      senderId: 'me',
      timestamp: Date.now()
    };

    if (file.type.startsWith('image/')) {
      message.imageUrl = url;
    } else if (file.type.startsWith('video/')) {
      message.videoUrl = url;
    } else {
      // Clean up if file is not supported
      URL.revokeObjectURL(url);
      return;
    }

    setMessages(prev => [...prev, message]);
    
    // Simulate AI response to media
    setIsTyping(true);
    setTimeout(() => {
      setIsTyping(false);
      const partnerMsg: Message = {
        id: (Date.now() + 1).toString(),
        senderId: partner.id,
        text: file.type.startsWith('image/') ? 'Wow, great picture!' : 'Cool video!',
        timestamp: Date.now()
      };
      setMessages(prev => [...prev, partnerMsg]);
    }, 1500);
    
    // Reset file input
    event.target.value = '';
  };

  const openMediaViewer = (url: string, type: 'image' | 'video') => {
    setViewerState({ isOpen: true, url, type });
  };
  
  const renderMessageContent = (msg: Message) => {
    if (msg.imageUrl) {
      return (
        <img 
          src={msg.imageUrl} 
          onClick={() => openMediaViewer(msg.imageUrl!, 'image')}
          className="w-48 h-auto rounded-xl cursor-pointer object-cover"
        />
      );
    }
    if (msg.videoUrl) {
      return (
        <video 
          src={msg.videoUrl} 
          onClick={() => openMediaViewer(msg.videoUrl!, 'video')}
          className="w-48 h-auto rounded-xl cursor-pointer" 
          preload="metadata"
        />
      );
    }
    return msg.text;
  };

  return (
    <div className="flex flex-col h-full bg-zinc-950">
      {/* Header */}
      <div className="p-4 glass-effect border-b border-zinc-800 flex items-center justify-between sticky top-0 z-10">
        <div className="flex items-center gap-3">
          <button onClick={onBack} className="text-zinc-400 p-1">←</button>
          <div className="cursor-pointer flex items-center gap-3 hover:opacity-90 active:scale-[0.98] transition-all" onClick={onViewProfile} title="View profile">
            <img src={partner.avatar} className="w-10 h-10 rounded-full object-cover border border-zinc-700" alt={partner.name} />
            <div>
              <h3 className="font-bold text-sm">{partner.name}</h3>
              <span className="text-[10px] text-green-500 font-medium flex items-center gap-1 uppercase tracking-widest">
                <span className="w-1.5 h-1.5 bg-green-500 rounded-full"></span> Active
              </span>
            </div>
          </div>
        </div>
        {videoCallEnabled && (
          <button 
            onClick={onVideoCall}
            className="bg-pink-600 hover:bg-pink-500 text-white px-3 py-1.5 rounded-full text-xs font-bold flex items-center gap-2 transition-all shadow-lg shadow-pink-900/20 active:scale-95"
          >
            <span>📹</span> 
            <span>Video Call</span>
            <span className="bg-black/20 px-1.5 rounded text-[10px]">{videoCallTokens}</span>
          </button>
        )}
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {messages.map(msg => (
          <div key={msg.id} className={`flex ${msg.senderId === 'me' ? 'justify-end' : 'justify-start'}`}>
            <div className={`max-w-[80%] px-4 py-2 rounded-2xl text-sm ${
              msg.senderId === 'me' 
              ? 'bg-pink-600 text-white rounded-br-none shadow-md' 
              : 'bg-zinc-800 text-zinc-100 rounded-bl-none border border-zinc-700'
            }`}>
              {msg.text}
            </div>
          </div>
        ))}
        {isTyping && (
          <div className="flex justify-start">
            <div className="bg-zinc-800 px-4 py-2 rounded-2xl rounded-bl-none border border-zinc-700">
              <div className="flex gap-1">
                <div className="w-1.5 h-1.5 bg-zinc-500 rounded-full animate-bounce"></div>
                <div className="w-1.5 h-1.5 bg-zinc-500 rounded-full animate-bounce delay-100"></div>
                <div className="w-1.5 h-1.5 bg-zinc-500 rounded-full animate-bounce delay-200"></div>
              </div>
            </div>
          </div>
        )}
        <div ref={scrollRef}></div>
      </div>

        {/* Input */}
        <footer className="p-4 border-t border-zinc-800 bg-black">
          <div className="flex gap-2 items-center bg-zinc-900 rounded-2xl px-2 py-2 focus-within:ring-1 ring-pink-500">
            <button onClick={() => fileInputRef.current?.click()} className="text-zinc-500 p-2 rounded-full hover:bg-zinc-800">
                <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m21.44 11.05-9.19 9.19a6 6 0 0 1-8.49-8.49l8.57-8.57A4 4 0 1 1 18 8.84l-8.59 8.59a2 2 0 0 1-2.83-2.83l8.49-8.48"/></svg>
            </button>
            <input 
              type="file" 
              ref={fileInputRef} 
              className="hidden" 
              accept="image/*,video/*"
              onChange={handleFileSelect}
            />
            <input 
              type="text" 
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleSend()}
              placeholder="Type a message..."
              className="flex-1 bg-transparent text-sm outline-none"
            />
            <button 
              onClick={handleSend}
              className="bg-pink-600 w-9 h-9 rounded-full text-white flex items-center justify-center active:scale-90 transition-transform"
            >
              ↑
            </button>
          </div>
        </footer>
    </div>
  );
};

export default ChatRoomView;
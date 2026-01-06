
import React, { useState, useRef, useEffect } from 'react';
import { User, Message } from '../types';
import { generateChatResponse } from '../services/geminiService';
import { TOKEN_COSTS } from '../constants';

interface ChatRoomViewProps {
  partner: User;
  onBack: () => void;
  onVideoCall: () => void;
  onViewProfile: () => void;
}

const ChatRoomView: React.FC<ChatRoomViewProps> = ({ partner, onBack, onVideoCall, onViewProfile }) => {
  const [messages, setMessages] = useState<Message[]>([
    { id: '1', senderId: partner.id, text: `Hey! I'm ${partner.name}. Nice to meet you!`, timestamp: Date.now() - 100000 }
  ]);
  const [input, setInput] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

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

    setMessages(prev => [...prev, userMsg]);
    setInput('');
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

  return (
    <div className="flex flex-col h-full bg-zinc-950">
      {/* Header */}
      <div className="p-4 glass-effect border-b border-zinc-800 flex items-center justify-between sticky top-0 z-10">
        <div className="flex items-center gap-3">
          <button onClick={onBack} className="text-zinc-400 p-1">←</button>
          <div className="cursor-pointer flex items-center gap-3" onClick={onViewProfile}>
            <img src={partner.avatar} className="w-10 h-10 rounded-full object-cover border border-zinc-700" />
            <div>
              <h3 className="font-bold text-sm">{partner.name}</h3>
              <span className="text-[10px] text-green-500 font-medium flex items-center gap-1 uppercase tracking-widest">
                <span className="w-1.5 h-1.5 bg-green-500 rounded-full"></span> Active
              </span>
            </div>
          </div>
        </div>
        <button 
          onClick={onVideoCall}
          className="bg-pink-600 hover:bg-pink-500 text-white p-2 pr-3 rounded-full flex items-center gap-2 transition-all shadow-lg shadow-pink-900/20 active:scale-95"
        >
          <span className="text-lg">📹</span>
          <div className="text-left">
            <span className="font-bold text-xs block leading-tight">Video Call</span>
            <span className="text-[9px] text-pink-200 block leading-tight">💎 {TOKEN_COSTS.VIDEO_CALL_PER_INTERVAL} / 10s</span>
          </div>
        </button>
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
      <div className="p-4 border-t border-zinc-800 bg-black">
        <div className="flex gap-2 items-center bg-zinc-900 rounded-2xl px-4 py-2 focus-within:ring-1 ring-pink-500">
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
            className="text-pink-500 font-bold text-sm px-2"
          >
            Send
          </button>
        </div>
      </div>
    </div>
  );
};

export default ChatRoomView;
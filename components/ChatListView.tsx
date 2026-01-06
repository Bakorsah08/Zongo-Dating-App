
import React from 'react';
import { User } from '../types';

interface ChatListViewProps {
  matches: User[];
  onChatSelect: (user: User) => void;
}

const ChatListView: React.FC<ChatListViewProps> = ({ matches, onChatSelect }) => {
  return (
    <div className="p-4 flex flex-col gap-6">
      <h1 className="text-2xl font-bold">Matches</h1>
      
      {/* Horizontal New Matches */}
      <div className="flex gap-4 overflow-x-auto pb-2 -mx-4 px-4 scrollbar-hide">
        {matches.map(user => (
          <button 
            key={`new-${user.id}`}
            onClick={() => onChatSelect(user)}
            className="flex flex-col items-center gap-2 flex-shrink-0"
          >
            <div className="relative">
              <img src={user.avatar} className="w-16 h-16 rounded-full object-cover border-2 border-pink-500 p-0.5" />
              <div className="absolute bottom-0 right-0 w-4 h-4 bg-green-500 border-2 border-black rounded-full"></div>
            </div>
            <span className="text-xs font-medium text-zinc-300">{user.name}</span>
          </button>
        ))}
      </div>

      <div className="flex flex-col gap-1">
        <h2 className="text-sm font-semibold text-zinc-500 uppercase tracking-widest">Messages</h2>
        <div className="mt-2 flex flex-col divide-y divide-zinc-800">
          {matches.length === 0 ? (
            <div className="py-20 text-center text-zinc-600">No messages yet. Start swiping!</div>
          ) : (
            matches.map(user => (
              <button 
                key={user.id}
                onClick={() => onChatSelect(user)}
                className="py-4 flex items-center gap-4 active:bg-zinc-900 transition-colors"
              >
                <img src={user.avatar} className="w-14 h-14 rounded-full object-cover" />
                <div className="flex-1 text-left">
                  <h3 className="font-bold">{user.name}</h3>
                  <p className="text-sm text-zinc-500 line-clamp-1">Hey there! How is it going?</p>
                </div>
                <div className="text-[10px] text-zinc-600 font-medium">10:45 AM</div>
              </button>
            ))
          )}
        </div>
      </div>
    </div>
  );
};

export default ChatListView;


import React from 'react';
import { User } from '../types';

interface ChatListViewProps {
  matches: User[];
  onChatSelect: (user: User) => void;
}

function formatDdMmYyBeforeTime(d: Date): string {
  const dd = String(d.getDate()).padStart(2, '0');
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const yy = String(d.getFullYear()).slice(-2);
  const time = d.toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit', hour12: true });
  return `${dd}/${mm}/${yy} ${time}`;
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
        <div className="mt-2 flex flex-col">
          {matches.length === 0 ? (
            <div className="py-20 text-center text-zinc-600">No messages yet. Start swiping!</div>
          ) : (
            matches.map((user, i) => {
              const stamp = new Date();
              stamp.setHours(10, 45, 0, 0);
              stamp.setDate(stamp.getDate() - i);
              return (
              <button 
                key={user.id}
                type="button"
                onClick={() => onChatSelect(user)}
                className="flex items-center gap-4 rounded-xl py-4 transition-colors [-webkit-tap-highlight-color:transparent] active:bg-zinc-100"
              >
                <img src={user.avatar} className="w-14 h-14 rounded-full object-cover" />
                <div className="flex-1 text-left">
                  <h3 className="font-bold">{user.name}</h3>
                  <p className="text-sm text-zinc-500 line-clamp-1">Hey there! How is it going?</p>
                </div>
                <div className="shrink-0 text-right text-[10px] text-zinc-600 font-medium whitespace-nowrap pl-2">
                  {formatDdMmYyBeforeTime(stamp)}
                </div>
              </button>
              );
            })
          )}
        </div>
      </div>
    </div>
  );
};

export default ChatListView;

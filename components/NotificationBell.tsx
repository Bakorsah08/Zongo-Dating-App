import React, { useEffect, useRef } from 'react';
import type { AppNotification } from '../types';

function formatRelativeTime(ts: number): string {
  const sec = Math.floor((Date.now() - ts) / 1000);
  if (sec < 45) return 'Just now';
  if (sec < 3600) return `${Math.floor(sec / 60)}m ago`;
  if (sec < 86400) return `${Math.floor(sec / 3600)}h ago`;
  if (sec < 604800) return `${Math.floor(sec / 86400)}d ago`;
  return new Date(ts).toLocaleDateString();
}

const BellIcon = ({ className }: { className?: string }) => (
  <svg
    xmlns="http://www.w3.org/2000/svg"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="1.75"
    strokeLinecap="round"
    strokeLinejoin="round"
    className={className}
    aria-hidden
  >
    <path d="M6 8a6 6 0 1 1 12 0c0 7 3 9 3 9H3s3-2 3-9" />
    <path d="M10.3 21a1.94 1.94 0 0 0 3.4 0" />
  </svg>
);

interface NotificationBellProps {
  notifications: AppNotification[];
  unreadCount: number;
  isOpen: boolean;
  onToggle: () => void;
}

const NotificationBell: React.FC<NotificationBellProps> = ({
  notifications,
  unreadCount,
  isOpen,
  onToggle,
}) => {
  const rootRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!isOpen) return;
    const onDocDown = (e: MouseEvent) => {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) {
        onToggle();
      }
    };
    document.addEventListener('mousedown', onDocDown);
    return () => document.removeEventListener('mousedown', onDocDown);
  }, [isOpen, onToggle]);

  return (
    <div ref={rootRef} className="pointer-events-auto absolute right-3 top-[max(0.75rem,env(safe-area-inset-top))] z-[70]">
      <button
        type="button"
        onClick={onToggle}
        aria-expanded={isOpen}
        aria-controls="app-notification-panel"
        id="app-notification-bell"
        aria-label={
          unreadCount > 0
            ? `Notifications, ${unreadCount} unread`
            : 'Notifications'
        }
        className="relative flex h-11 w-11 items-center justify-center rounded-full bg-white text-zinc-800 transition-transform active:scale-95 hover:bg-zinc-50"
      >
        <BellIcon className="h-[1.35rem] w-[1.35rem]" />
        {unreadCount > 0 ? (
          <span className="absolute -right-0.5 -top-0.5 flex h-[1.125rem] min-w-[1.125rem] items-center justify-center rounded-full bg-rose-500 px-1 text-[10px] font-bold leading-none text-white ring-2 ring-white">
            {unreadCount > 99 ? '99+' : unreadCount}
          </span>
        ) : null}
      </button>

      {isOpen ? (
        <div
          id="app-notification-panel"
          role="region"
          aria-labelledby="app-notification-bell"
          className="absolute right-0 top-[calc(100%+0.5rem)] w-[min(calc(100vw-1.5rem),20rem)] rounded-2xl border border-pink-200 bg-[#fff5f7] p-4 shadow-xl ring-1 ring-pink-100/80"
        >
          <h2 className="mb-3 text-[11px] font-black uppercase tracking-[0.2em] text-rose-950">
            Notification centre
          </h2>
          {notifications.length === 0 ? (
            <p className="rounded-xl border border-pink-100/80 bg-white/80 px-4 py-6 text-center text-sm text-zinc-500">
              No notifications yet.
            </p>
          ) : (
            <ul className="max-h-[min(55vh,380px)] space-y-3 overflow-y-auto pr-0.5">
              {notifications.map((n) => (
                <li
                  key={n.id}
                  className={`flex items-start gap-3 rounded-2xl border border-pink-100/90 bg-white px-3.5 py-3 shadow-sm ${
                    n.read ? 'opacity-80' : ''
                  }`}
                >
                  {n.type === 'super_like' ? (
                    <img
                      src={n.fromAvatar || 'https://picsum.photos/seed/sl/80'}
                      alt=""
                      className="h-11 w-11 shrink-0 rounded-full object-cover ring-2 ring-zinc-200"
                    />
                  ) : (
                    <div
                      className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-zinc-100 text-lg"
                      aria-hidden
                    >
                      <span className="text-[1.15rem] leading-none">📣</span>
                    </div>
                  )}
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-bold leading-snug text-zinc-800">
                      {n.type === 'super_like' ? (
                        <>
                          <span className="text-pink-700">{n.fromName}</span>
                          <span className="text-zinc-800"> sent you a Super Like</span>
                        </>
                      ) : (
                        n.systemMessage
                      )}
                    </p>
                    <p className="mt-1 text-xs font-medium text-zinc-500">{formatRelativeTime(n.createdAt)}</p>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>
      ) : null}
    </div>
  );
};

export default NotificationBell;

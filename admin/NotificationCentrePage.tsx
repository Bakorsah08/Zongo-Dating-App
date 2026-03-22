import React, { useState, useEffect, useMemo, useCallback } from 'react';
import type { BadgeTier, User } from '../types';
import { adminStore } from './store';
import { broadcastAdminNotification } from '../notificationsStore';
import { getBadges } from '../data';

type Audience = 'all' | 'selected' | 'group';
type GroupMode = 'gender' | 'badge' | 'online';

const NotificationCentrePage: React.FC = () => {
  const [users, setUsers] = useState<User[]>([]);
  const [message, setMessage] = useState('');
  const [audience, setAudience] = useState<Audience>('all');
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [groupMode, setGroupMode] = useState<GroupMode>('gender');
  const [groupGender, setGroupGender] = useState<'male' | 'female'>('female');
  const [groupBadge, setGroupBadge] = useState<BadgeTier>('none');
  const [userSearch, setUserSearch] = useState('');
  const [lastResult, setLastResult] = useState<string | null>(null);

  const syncUsers = useCallback(() => {
    setUsers(adminStore.getUsers());
  }, []);

  useEffect(() => {
    syncUsers();
  }, [syncUsers]);

  const badges = getBadges();

  const filteredUsersForSelect = useMemo(() => {
    const q = userSearch.trim().toLowerCase();
    if (!q) return users;
    return users.filter(
      (u) =>
        u.name.toLowerCase().includes(q) ||
        u.id.toLowerCase().includes(q) ||
        (u.location && u.location.toLowerCase().includes(q))
    );
  }, [users, userSearch]);

  const resolveRecipientIds = useCallback((): string[] => {
    if (audience === 'all') {
      return users.map((u) => u.id);
    }
    if (audience === 'selected') {
      return Array.from(selectedIds);
    }
    if (groupMode === 'gender') {
      return users.filter((u) => u.gender === groupGender).map((u) => u.id);
    }
    if (groupMode === 'badge') {
      return users.filter((u) => (u.badgeTier ?? 'none') === groupBadge).map((u) => u.id);
    }
    return users.filter((u) => u.isOnline).map((u) => u.id);
  }, [audience, users, selectedIds, groupMode, groupGender, groupBadge]);

  const previewCount = useMemo(() => resolveRecipientIds().length, [resolveRecipientIds]);

  const toggleUser = (id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const selectAllFiltered = () => {
    setSelectedIds(new Set(filteredUsersForSelect.map((u) => u.id)));
  };

  const clearSelection = () => setSelectedIds(new Set());

  const handleSend = () => {
    const text = message.trim();
    if (!text) {
      window.alert('Enter a message.');
      return;
    }
    const ids = resolveRecipientIds();
    if (ids.length === 0) {
      window.alert('No recipients match your selection.');
      return;
    }
    if (ids.length > 10 && !window.confirm(`Send to ${ids.length} users?`)) return;

    const sent = broadcastAdminNotification(ids, text);
    setLastResult(`Delivered to ${sent} user${sent === 1 ? '' : 's'}. They will see it as an unread notification in the app.`);
    setMessage('');
    if (audience === 'selected') setSelectedIds(new Set());
  };

  return (
    <div className="p-8 max-w-3xl">
      <div className="mb-8">
        <h1 className="text-3xl font-black text-white">Notification centre</h1>
        <p className="text-zinc-500 mt-1">
          Send an in-app message to app users. It appears in their notification bell as unread until they open it.
        </p>
      </div>

      <div className="space-y-8">
        <section className="bg-zinc-900 border border-zinc-800 rounded-2xl p-6">
          <label className="block text-sm font-bold text-zinc-300 mb-2">Message</label>
          <textarea
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            rows={4}
            placeholder="e.g. New live event this Friday at 8pm — don’t miss it!"
            className="w-full px-4 py-3 bg-zinc-800 border border-zinc-700 rounded-xl text-white placeholder:text-zinc-600 resize-y min-h-[6rem]"
          />
        </section>

        <section className="bg-zinc-900 border border-zinc-800 rounded-2xl p-6 space-y-4">
          <h2 className="text-lg font-bold text-white">Audience</h2>

          <div className="flex flex-wrap gap-3">
            {(
              [
                ['all', 'All users'],
                ['selected', 'Selected users'],
                ['group', 'Group (filter)'],
              ] as const
            ).map(([key, label]) => (
              <label
                key={key}
                className={`flex items-center gap-2 cursor-pointer rounded-xl border px-4 py-2 text-sm font-bold transition-colors ${
                  audience === key
                    ? 'border-rose-500 bg-rose-500/15 text-rose-300'
                    : 'border-zinc-700 text-zinc-400 hover:border-zinc-600'
                }`}
              >
                <input
                  type="radio"
                  name="audience"
                  checked={audience === key}
                  onChange={() => setAudience(key)}
                  className="sr-only"
                />
                {label}
              </label>
            ))}
          </div>

          {audience === 'selected' ? (
            <div className="space-y-3 pt-2 border-t border-zinc-800">
              <div className="flex flex-wrap gap-2 items-center">
                <input
                  type="search"
                  value={userSearch}
                  onChange={(e) => setUserSearch(e.target.value)}
                  placeholder="Search by name, id, location…"
                  className="flex-1 min-w-[12rem] px-3 py-2 bg-zinc-800 border border-zinc-700 rounded-xl text-white text-sm"
                />
                <button
                  type="button"
                  onClick={selectAllFiltered}
                  className="px-3 py-2 text-xs font-bold text-rose-400 border border-zinc-600 rounded-xl hover:bg-zinc-800"
                >
                  Select all in list
                </button>
                <button
                  type="button"
                  onClick={clearSelection}
                  className="px-3 py-2 text-xs font-bold text-zinc-400 border border-zinc-600 rounded-xl hover:bg-zinc-800"
                >
                  Clear
                </button>
              </div>
              <p className="text-xs text-zinc-500">
                {selectedIds.size} selected · {filteredUsersForSelect.length} shown
              </p>
              <div className="max-h-56 overflow-y-auto rounded-xl border border-zinc-800 divide-y divide-zinc-800">
                {filteredUsersForSelect.map((u) => (
                  <label
                    key={u.id}
                    className="flex items-center gap-3 px-3 py-2 hover:bg-zinc-800/80 cursor-pointer"
                  >
                    <input
                      type="checkbox"
                      checked={selectedIds.has(u.id)}
                      onChange={() => toggleUser(u.id)}
                      className="rounded border-zinc-600"
                    />
                    <img src={u.avatar} alt="" className="h-8 w-8 rounded-full object-cover" />
                    <span className="text-sm text-white font-medium truncate">{u.name}</span>
                    <span className="text-[10px] text-zinc-500 font-mono truncate ml-auto">{u.id}</span>
                  </label>
                ))}
              </div>
            </div>
          ) : null}

          {audience === 'group' ? (
            <div className="space-y-4 pt-2 border-t border-zinc-800">
              <div className="flex flex-wrap gap-3">
                {(
                  [
                    ['gender', 'By gender'],
                    ['badge', 'By VIP badge'],
                    ['online', 'Online now'],
                  ] as const
                ).map(([key, label]) => (
                  <label
                    key={key}
                    className={`flex items-center gap-2 cursor-pointer rounded-xl border px-3 py-2 text-xs font-bold ${
                      groupMode === key
                        ? 'border-amber-500/60 bg-amber-500/10 text-amber-200'
                        : 'border-zinc-700 text-zinc-500'
                    }`}
                  >
                    <input
                      type="radio"
                      name="groupMode"
                      checked={groupMode === key}
                      onChange={() => setGroupMode(key)}
                      className="sr-only"
                    />
                    {label}
                  </label>
                ))}
              </div>

              {groupMode === 'gender' ? (
                <div className="flex gap-3">
                  <label className="text-sm text-zinc-400">
                    Gender
                    <select
                      value={groupGender}
                      onChange={(e) => setGroupGender(e.target.value as 'male' | 'female')}
                      className="mt-1 block w-full max-w-xs px-3 py-2 bg-zinc-800 border border-zinc-700 rounded-xl text-white"
                    >
                      <option value="female">Female</option>
                      <option value="male">Male</option>
                    </select>
                  </label>
                </div>
              ) : null}

              {groupMode === 'badge' ? (
                <div>
                  <label className="text-sm text-zinc-400 block mb-1">Badge tier</label>
                  <select
                    value={groupBadge}
                    onChange={(e) => setGroupBadge(e.target.value as BadgeTier)}
                    className="w-full max-w-xs px-3 py-2 bg-zinc-800 border border-zinc-700 rounded-xl text-white"
                  >
                    {badges.map((b) => (
                      <option key={b.id} value={b.id}>
                        {b.icon} {b.name}
                      </option>
                    ))}
                  </select>
                </div>
              ) : null}

              {groupMode === 'online' ? (
                <p className="text-sm text-zinc-500">Users with &quot;online&quot; status in the directory.</p>
              ) : null}
            </div>
          ) : null}
        </section>

        <div className="flex flex-wrap items-center justify-between gap-4">
          <p className="text-sm text-zinc-400">
            <span className="font-bold text-white tabular-nums">{previewCount}</span> recipient
            {previewCount === 1 ? '' : 's'} for this send
          </p>
          <button
            type="button"
            onClick={handleSend}
            disabled={!message.trim() || previewCount === 0}
            className="px-8 py-3 rounded-xl bg-rose-600 hover:bg-rose-500 disabled:opacity-40 disabled:pointer-events-none text-white font-bold text-sm"
          >
            Send notification
          </button>
        </div>

        {lastResult ? (
          <p className="text-sm text-emerald-400 font-medium border border-emerald-500/30 rounded-xl px-4 py-3 bg-emerald-500/10">
            {lastResult}
          </p>
        ) : null}
      </div>
    </div>
  );
};

export default NotificationCentrePage;

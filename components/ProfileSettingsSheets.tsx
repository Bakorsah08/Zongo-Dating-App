import React, { useState, useEffect } from 'react';
import { getUsers } from '../data';
import {
  getNotificationPreferences,
  setNotificationPreferences,
  getPrivacyPreferences,
  setPrivacyPreferences,
  removeBlockedUserId,
} from '../userPreferencesStore';

export type ProfileSettingsSheetId = 'notifications' | 'discovery' | 'privacy' | 'help';

interface ProfileSettingsSheetsProps {
  sheet: ProfileSettingsSheetId | null;
  onClose: () => void;
  onNavigateToExploreFilters: () => void;
  onPreferencesChanged: () => void;
}

const toggleRowClass =
  'flex w-full items-center justify-between gap-4 border-b border-zinc-100 py-4 last:border-0';

const ProfileSettingsSheets: React.FC<ProfileSettingsSheetsProps> = ({
  sheet,
  onClose,
  onNavigateToExploreFilters,
  onPreferencesChanged,
}) => {
  const [superLike, setSuperLike] = useState(true);
  const [system, setSystem] = useState(true);
  const [approxDist, setApproxDist] = useState(false);
  const [blockedIds, setBlockedIds] = useState<string[]>([]);

  useEffect(() => {
    if (!sheet) return;
    const n = getNotificationPreferences();
    setSuperLike(n.superLikeEnabled);
    setSystem(n.systemEnabled);
    const p = getPrivacyPreferences();
    setApproxDist(p.showApproximateDistanceOnly);
    setBlockedIds([...p.blockedUserIds]);
  }, [sheet]);

  if (!sheet) return null;

  const persistNotifications = (next: { superLikeEnabled?: boolean; systemEnabled?: boolean }) => {
    setNotificationPreferences(next);
    onPreferencesChanged();
  };

  const persistPrivacyDistance = (showApproximateDistanceOnly: boolean) => {
    setPrivacyPreferences({ showApproximateDistanceOnly });
    setApproxDist(showApproximateDistanceOnly);
    onPreferencesChanged();
  };

  const handleUnblock = (userId: string) => {
    removeBlockedUserId(userId);
    setBlockedIds((prev) => prev.filter((id) => id !== userId));
    onPreferencesChanged();
  };

  const titles: Record<ProfileSettingsSheetId, string> = {
    notifications: 'Notification settings',
    discovery: 'Discovery preferences',
    privacy: 'Privacy & safety',
    help: 'Help & support',
  };

  return (
    <div
      className="fixed inset-0 z-[110] flex flex-col bg-white animate-in fade-in duration-200"
      role="dialog"
      aria-modal
      aria-labelledby="profile-settings-sheet-title"
    >
      <header className="flex shrink-0 items-center gap-3 border-b border-zinc-200 px-4 py-4 pt-[max(1rem,env(safe-area-inset-top))]">
        <button
          type="button"
          onClick={onClose}
          className="rounded-full px-2 py-1 text-sm font-bold text-pink-600 [-webkit-tap-highlight-color:transparent]"
        >
          ← Back
        </button>
        <h2 id="profile-settings-sheet-title" className="text-base font-bold text-zinc-900">
          {titles[sheet]}
        </h2>
      </header>

      <div className="min-h-0 flex-1 overflow-y-auto px-4 pb-12">
        {sheet === 'notifications' && (
          <div className="mt-2">
            <p className="mb-4 text-sm text-zinc-600">
              Choose which alerts appear in your notification bell and as toasts.
            </p>
            <div className="rounded-2xl border border-zinc-200 bg-white px-4">
              <label className={toggleRowClass}>
                <div>
                  <span className="text-sm font-medium text-zinc-900">Super Like alerts</span>
                  <p className="text-xs text-zinc-500">When someone sends you a Super Like</p>
                </div>
                <input
                  type="checkbox"
                  className="h-5 w-5 accent-pink-600"
                  checked={superLike}
                  onChange={(e) => {
                    const v = e.target.checked;
                    setSuperLike(v);
                    persistNotifications({ superLikeEnabled: v });
                  }}
                />
              </label>
              <label className={toggleRowClass}>
                <div>
                  <span className="text-sm font-medium text-zinc-900">Updates & reminders</span>
                  <p className="text-xs text-zinc-500">Promoted posts, ad status, and admin messages</p>
                </div>
                <input
                  type="checkbox"
                  className="h-5 w-5 accent-pink-600"
                  checked={system}
                  onChange={(e) => {
                    const v = e.target.checked;
                    setSystem(v);
                    persistNotifications({ systemEnabled: v });
                  }}
                />
              </label>
            </div>
          </div>
        )}

        {sheet === 'discovery' && (
          <div className="mt-2 space-y-4">
            <p className="text-sm text-zinc-600">
              Distance, age, online status, and AI companion filters are saved automatically when you
              change them on Explore.
            </p>
            <button
              type="button"
              onClick={() => {
                onNavigateToExploreFilters();
                onClose();
              }}
              className="w-full rounded-2xl bg-gradient-to-r from-pink-600 to-rose-600 py-4 text-sm font-bold text-white shadow-md [-webkit-tap-highlight-color:transparent] active:scale-[0.99]"
            >
              Open Explore filters
            </button>
            <p className="text-xs text-zinc-500">
              You&apos;ll jump to Explore with the filter panel open. Adjust sliders and chips there;
              we&apos;ll remember your choices on this device.
            </p>
          </div>
        )}

        {sheet === 'privacy' && (
          <div className="mt-2 space-y-6">
            <div className="rounded-2xl border border-zinc-200 bg-white px-4">
              <label className={toggleRowClass}>
                <div>
                  <span className="text-sm font-medium text-zinc-900">Approximate distance on Explore</span>
                  <p className="text-xs text-zinc-500">
                    Show labels like &quot;Nearby&quot; instead of exact miles on profile cards
                  </p>
                </div>
                <input
                  type="checkbox"
                  className="h-5 w-5 accent-pink-600"
                  checked={approxDist}
                  onChange={(e) => persistPrivacyDistance(e.target.checked)}
                />
              </label>
            </div>

            <div>
              <h3 className="mb-2 text-xs font-bold uppercase tracking-widest text-zinc-500">
                Blocked people
              </h3>
              <p className="mb-3 text-sm text-zinc-600">
                Block someone from their profile (⋯ menu). Blocked people won&apos;t appear in Explore,
                Following, or Chats.
              </p>
              {blockedIds.length === 0 ? (
                <p className="rounded-2xl border border-dashed border-zinc-200 bg-zinc-50 py-8 text-center text-sm text-zinc-500">
                  No blocked accounts
                </p>
              ) : (
                <ul className="divide-y divide-zinc-100 rounded-2xl border border-zinc-200 bg-white">
                  {blockedIds.map((id) => {
                    const u = getUsers().find((x) => x.id === id);
                    const label = u?.name ?? id;
                    return (
                      <li key={id} className="flex items-center justify-between gap-3 px-4 py-3">
                        <span className="min-w-0 truncate text-sm font-medium text-zinc-900">
                          {label}
                        </span>
                        <button
                          type="button"
                          onClick={() => handleUnblock(id)}
                          className="shrink-0 rounded-full border border-zinc-200 px-3 py-1.5 text-xs font-bold text-pink-600 [-webkit-tap-highlight-color:transparent]"
                        >
                          Unblock
                        </button>
                      </li>
                    );
                  })}
                </ul>
              )}
            </div>
          </div>
        )}

        {sheet === 'help' && (
          <div className="mt-2 space-y-6">
            <section>
              <h3 className="mb-2 text-xs font-bold uppercase tracking-widest text-zinc-500">
                Safety tips
              </h3>
              <ul className="list-disc space-y-2 pl-5 text-sm text-zinc-600">
                <li>Meet first in public places and tell a friend where you are.</li>
                <li>Never send money or share banking details with someone you just met.</li>
                <li>Use Report and Block on any profile if something feels wrong.</li>
              </ul>
            </section>
            <section>
              <h3 className="mb-2 text-xs font-bold uppercase tracking-widest text-zinc-500">
                Using Zongo
              </h3>
              <ul className="list-disc space-y-2 pl-5 text-sm text-zinc-600">
                <li>
                  <strong className="text-zinc-800">Tokens</strong> power Super Likes, video calls, live
                  entry, and promoting your profile on Explore.
                </li>
                <li>
                  <strong className="text-zinc-800">Explore filters</strong> (top-right on Explore) let you
                  set age, distance, and online-only matching.
                </li>
                <li>
                  Notifications from admins appear in the bell when the app sends broadcast messages.
                </li>
              </ul>
            </section>
            <a
              href="mailto:support@zongo.app?subject=Zongo%20help"
              className="block w-full rounded-2xl border border-zinc-200 bg-zinc-50 py-4 text-center text-sm font-bold text-pink-600"
            >
              Email support
            </a>
          </div>
        )}
      </div>
    </div>
  );
};

export default ProfileSettingsSheets;

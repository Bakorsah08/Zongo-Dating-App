import type { AppNotification } from './types';

const STORAGE_KEY = 'zongo_app_notifications';
const MAX_PER_USER = 100;

export const SUPER_LIKE_NOTIFICATION_EVENT = 'zongo-super-like-notification';
export const APP_NOTIFICATION_UPDATED_EVENT = 'zongo-app-notification-updated';

type StoreShape = Record<string, AppNotification[]>;

function load(): StoreShape {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return {};
    const p = JSON.parse(raw) as unknown;
    if (!p || typeof p !== 'object') return {};
    return p as StoreShape;
  } catch {
    return {};
  }
}

function save(data: StoreShape) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
  } catch (_) {}
}

function newId(): string {
  return typeof crypto !== 'undefined' && crypto.randomUUID
    ? crypto.randomUUID()
    : `n-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

/** Record that `recipientId` received a Super Like from `from`. */
export function addSuperLikeNotification(
  recipientId: string,
  from: { id: string; name: string; avatar: string }
): void {
  if (!recipientId || recipientId === from.id) return;
  const all = load();
  const list = all[recipientId] ?? [];
  const n: AppNotification = {
    id: newId(),
    type: 'super_like',
    fromUserId: from.id,
    fromName: from.name.trim() || 'Someone',
    fromAvatar: from.avatar || '',
    createdAt: Date.now(),
    read: false,
  };
  all[recipientId] = [n, ...list].slice(0, MAX_PER_USER);
  save(all);
  window.dispatchEvent(
    new CustomEvent(SUPER_LIKE_NOTIFICATION_EVENT, { detail: { recipientId } })
  );
  window.dispatchEvent(
    new CustomEvent(APP_NOTIFICATION_UPDATED_EVENT, { detail: { recipientId } })
  );
}

/** In-app system line (user ads, moderation, etc.). */
export function addUserAdSystemNotification(
  recipientId: string,
  systemKind: NonNullable<AppNotification['systemKind']>,
  systemMessage: string
): void {
  if (!recipientId) return;
  const all = load();
  const list = all[recipientId] ?? [];
  const n: AppNotification = {
    id: newId(),
    type: 'system',
    systemKind,
    systemMessage,
    createdAt: Date.now(),
    read: false,
  };
  all[recipientId] = [n, ...list].slice(0, MAX_PER_USER);
  save(all);
  window.dispatchEvent(
    new CustomEvent(APP_NOTIFICATION_UPDATED_EVENT, { detail: { recipientId } })
  );
}

/** Push the same admin message to many users (unread until they open the bell). Returns count sent. */
export function broadcastAdminNotification(recipientIds: string[], message: string): number {
  const text = message.trim();
  if (!text) return 0;
  const unique = [...new Set(recipientIds.filter(Boolean))];
  if (unique.length === 0) return 0;

  const all = load();
  for (const recipientId of unique) {
    const list = all[recipientId] ?? [];
    const n: AppNotification = {
      id: newId(),
      type: 'system',
      systemKind: 'admin_broadcast',
      systemMessage: text,
      createdAt: Date.now(),
      read: false,
    };
    all[recipientId] = [n, ...list].slice(0, MAX_PER_USER);
  }
  save(all);

  for (const recipientId of unique) {
    window.dispatchEvent(
      new CustomEvent(APP_NOTIFICATION_UPDATED_EVENT, { detail: { recipientId } })
    );
  }
  return unique.length;
}

export function getNotificationsForUser(userId: string): AppNotification[] {
  const list = load()[userId];
  return list ? [...list] : [];
}

export function getUnreadNotificationCount(userId: string): number {
  return getNotificationsForUser(userId).filter((n) => !n.read).length;
}

export function markNotificationRead(userId: string, notificationId: string): void {
  const all = load();
  const list = all[userId];
  if (!list) return;
  all[userId] = list.map((n) => (n.id === notificationId ? { ...n, read: true } : n));
  save(all);
}

export function markAllNotificationsRead(userId: string): void {
  const all = load();
  const list = all[userId];
  if (!list?.length) return;
  all[userId] = list.map((n) => ({ ...n, read: true }));
  save(all);
}

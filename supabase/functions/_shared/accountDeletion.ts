import type { SupabaseClient } from 'https://esm.sh/@supabase/supabase-js@2';

const MEDIA_BUCKET = 'chat-media';

/** Collect every object path under `prefix` (chat media is stored as `<user id>/...`). */
async function listObjectPaths(admin: SupabaseClient, prefix: string): Promise<string[]> {
  const out: string[] = [];
  const pageSize = 1000;
  for (let offset = 0; ; offset += pageSize) {
    const { data, error } = await admin.storage.from(MEDIA_BUCKET).list(prefix, { limit: pageSize, offset });
    if (error) throw error;
    if (!data || data.length === 0) break;
    for (const entry of data) {
      const path = `${prefix}/${entry.name}`;
      // Folders come back without an id.
      if (entry.id) out.push(path);
      else out.push(...(await listObjectPaths(admin, path)));
    }
    if (data.length < pageSize) break;
  }
  return out;
}

/**
 * Permanently delete a member: their uploaded media, then the auth user.
 * Every app table references profiles / auth.users with ON DELETE CASCADE or SET NULL,
 * so deleting the auth user removes the profile, chats, wallet and preferences.
 */
export async function deleteMemberAccount(
  admin: SupabaseClient,
  userId: string
): Promise<{ ok: true; mediaRemoved: number } | { ok: false; error: string }> {
  let mediaRemoved = 0;
  try {
    const paths = await listObjectPaths(admin, userId);
    for (let i = 0; i < paths.length; i += 100) {
      const { error } = await admin.storage.from(MEDIA_BUCKET).remove(paths.slice(i, i + 100));
      if (error) throw error;
    }
    mediaRemoved = paths.length;
  } catch (err) {
    console.error('deleteMemberAccount: media cleanup failed', err);
    return { ok: false, error: 'media_cleanup_failed' };
  }

  const { error } = await admin.auth.admin.deleteUser(userId);
  if (error) {
    console.error('deleteMemberAccount: deleteUser failed', error);
    return { ok: false, error: 'delete_user_failed' };
  }
  return { ok: true, mediaRemoved };
}

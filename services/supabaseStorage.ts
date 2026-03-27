import { getSupabase, isSupabaseConfigured } from '../lib/supabaseClient';

const BUCKET = 'chat-media';
const SIGNED_URL_TTL_SECONDS = 60 * 60;

function extFromMime(mime: string): string {
  if (mime.includes('jpeg') || mime.includes('jpg')) return 'jpg';
  if (mime.includes('png')) return 'png';
  if (mime.includes('webp')) return 'webp';
  if (mime.includes('gif')) return 'gif';
  if (mime.includes('mp4')) return 'mp4';
  if (mime.includes('webm')) return 'webm';
  if (mime.includes('mpeg')) return 'mp3';
  return 'bin';
}

/** Uploads to `chat-media/{userId}/{uuid}.{ext}` and returns the object path. */
export async function uploadChatMedia(userId: string, blob: Blob, mimeHint?: string): Promise<string | null> {
  if (!isSupabaseConfigured()) return null;
  const mime = blob.type || mimeHint || 'application/octet-stream';
  const ext = extFromMime(mime);
  const path = `${userId}/${crypto.randomUUID()}.${ext}`;
  const sb = getSupabase();
  const { error } = await sb.storage.from(BUCKET).upload(path, blob, {
    contentType: mime,
    upsert: false,
  });
  if (error) {
    console.error('uploadChatMedia', error);
    return null;
  }
  return path;
}

function isSignedOrExternalUrl(value: string): boolean {
  return /^(https?:|blob:|data:)/i.test(value);
}

/** Returns a signed URL for private chat-media objects; passthrough for full URLs. */
export async function getSignedChatMediaUrl(pathOrUrl: string | null | undefined): Promise<string | undefined> {
  if (!pathOrUrl) return undefined;
  if (isSignedOrExternalUrl(pathOrUrl)) return pathOrUrl;
  if (!isSupabaseConfigured()) return undefined;
  const { data, error } = await getSupabase()
    .storage
    .from(BUCKET)
    .createSignedUrl(pathOrUrl, SIGNED_URL_TTL_SECONDS);
  if (error) {
    console.error('getSignedChatMediaUrl', error);
    return undefined;
  }
  return data?.signedUrl;
}

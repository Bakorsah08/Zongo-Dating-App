import { getSupabase, isSupabaseConfigured } from '../lib/supabaseClient';

const BUCKET = 'chat-media';

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

/** Uploads to `chat-media/{userId}/{uuid}.{ext}` — bucket is public; returns public URL. */
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
  const { data } = sb.storage.from(BUCKET).getPublicUrl(path);
  return data?.publicUrl ?? null;
}

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

type Json = Record<string, unknown>;

type MonitoringPayload = {
  kind?: string;
  domain?: string;
  operation?: string;
  message?: string;
  details?: Record<string, unknown>;
  countInWindow?: number;
  threshold?: number;
  windowMs?: number;
  timestamp?: string;
};

function json(status: number, body: Json) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      'Content-Type': 'application/json',
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Headers': 'content-type, x-zongo-monitoring-key',
      'Access-Control-Allow-Methods': 'POST, OPTIONS',
    },
  });
}

function getEnv(name: string): string {
  const value = Deno.env.get(name);
  if (!value) throw new Error(`Missing env: ${name}`);
  return value;
}

function toInt(v: unknown, fallback: number): number {
  const n = Number(v);
  if (!Number.isFinite(n)) return fallback;
  return Math.max(0, Math.round(n));
}

function sanitizeDetails(input: unknown): Record<string, unknown> {
  if (!input || typeof input !== 'object' || Array.isArray(input)) return {};
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(input)) {
    const key = k.toLowerCase();
    if (key.includes('token') || key.includes('password') || key.includes('key')) continue;
    out[k] = v;
  }
  return out;
}

function allowedDomain(v: unknown): v is 'auth' | 'rpc' | 'realtime' | 'storage' {
  return v === 'auth' || v === 'rpc' || v === 'realtime' || v === 'storage';
}

function getIp(req: Request): string | null {
  const forwarded = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim();
  if (forwarded) return forwarded;
  const realIp = req.headers.get('x-real-ip')?.trim();
  return realIp || null;
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return json(200, { ok: true });
  if (req.method !== 'POST') return json(405, { ok: false, error: 'method_not_allowed' });

  try {
    const sharedKey = Deno.env.get('MONITORING_INGEST_KEY')?.trim();
    if (sharedKey) {
      const provided = req.headers.get('x-zongo-monitoring-key')?.trim() ?? '';
      if (!provided || provided !== sharedKey) return json(401, { ok: false, error: 'unauthorized' });
    }

    const payload = (await req.json()) as MonitoringPayload;
    if (!allowedDomain(payload.domain)) return json(400, { ok: false, error: 'invalid_domain' });
    if (!payload.operation || typeof payload.operation !== 'string') return json(400, { ok: false, error: 'invalid_operation' });
    if (!payload.message || typeof payload.message !== 'string') return json(400, { ok: false, error: 'invalid_message' });

    const supabase = createClient(getEnv('SUPABASE_URL'), getEnv('SUPABASE_SERVICE_ROLE_KEY'));
    const source = req.headers.get('user-agent')?.includes('Mozilla') ? 'web' : 'unknown';
    const ts = payload.timestamp ? new Date(payload.timestamp) : new Date();
    const createdAt = Number.isNaN(ts.getTime()) ? new Date().toISOString() : ts.toISOString();

    const { error } = await supabase.from('monitoring_events').insert({
      kind: typeof payload.kind === 'string' ? payload.kind : 'failure',
      domain: payload.domain,
      operation: payload.operation.slice(0, 120),
      message: payload.message.slice(0, 500),
      details: {
        ...sanitizeDetails(payload.details),
        ip: getIp(req),
      },
      count_in_window: toInt(payload.countInWindow, 1),
      threshold: toInt(payload.threshold, 0),
      window_ms: toInt(payload.windowMs, 0),
      app_version: Deno.env.get('APP_VERSION') ?? null,
      source,
      created_at: createdAt,
    });

    if (error) {
      console.error('monitoring-ingest insert error', error);
      return json(500, { ok: false, error: 'insert_failed' });
    }

    return json(200, { ok: true });
  } catch (err) {
    console.error('monitoring-ingest fatal', err);
    return json(500, { ok: false, error: 'internal_error' });
  }
});

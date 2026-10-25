type FailureDomain = 'auth' | 'rpc' | 'realtime' | 'storage' | 'ai' | 'media';

type FailureEvent = {
  kind: 'failure';
  domain: FailureDomain;
  operation: string;
  message: string;
  details?: Record<string, unknown>;
  countInWindow: number;
  threshold: number;
  windowMs: number;
  timestamp: string;
};

const endpoint = import.meta.env.VITE_MONITORING_ENDPOINT?.trim() || '';
const ingestKey = import.meta.env.VITE_MONITORING_INGEST_KEY?.trim() || '';
const windowMs = Number(import.meta.env.VITE_MONITORING_ALERT_WINDOW_MS || 5 * 60 * 1000);
const threshold = Number(import.meta.env.VITE_MONITORING_ALERT_THRESHOLD || 5);

const failureTimestampsByKey = new Map<string, number[]>();
const lastAlertAtByKey = new Map<string, number>();

function nowMs(): number {
  return Date.now();
}

function toMessage(value: unknown): string {
  if (typeof value === 'string') return value;
  if (value instanceof Error) return value.message;
  if (value && typeof value === 'object' && 'message' in value && typeof (value as { message?: unknown }).message === 'string') {
    return (value as { message: string }).message;
  }
  return 'unknown_error';
}

function safeDetails(input: Record<string, unknown> | undefined): Record<string, unknown> | undefined {
  if (!input) return undefined;
  const next: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(input)) {
    if (k.toLowerCase().includes('token') || k.toLowerCase().includes('password') || k.toLowerCase().includes('key')) continue;
    next[k] = v;
  }
  return next;
}

function postEvent(event: FailureEvent): void {
  if (!endpoint) return;
  const body = JSON.stringify(event);
  try {
    if (typeof navigator !== 'undefined' && typeof navigator.sendBeacon === 'function') {
      const blob = new Blob([body], { type: 'application/json' });
      navigator.sendBeacon(endpoint, blob);
      return;
    }
  } catch {
    // Ignore sendBeacon errors and try fetch fallback.
  }
  void fetch(endpoint, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...(ingestKey ? { 'x-zongo-monitoring-key': ingestKey } : {}),
    },
    body,
    keepalive: true,
  }).catch(() => {
    // Intentionally swallow telemetry transport errors.
  });
}

export function trackFailure(
  domain: FailureDomain,
  operation: string,
  error: unknown,
  details?: Record<string, unknown>
): void {
  const key = `${domain}:${operation}`;
  const now = nowMs();
  const list = failureTimestampsByKey.get(key) ?? [];
  const active = list.filter((t) => now - t <= windowMs);
  active.push(now);
  failureTimestampsByKey.set(key, active);

  const countInWindow = active.length;
  const message = toMessage(error);
  const payload: FailureEvent = {
    kind: 'failure',
    domain,
    operation,
    message,
    details: safeDetails(details),
    countInWindow,
    threshold,
    windowMs,
    timestamp: new Date(now).toISOString(),
  };

  postEvent(payload);

  const lastAlertAt = lastAlertAtByKey.get(key) ?? 0;
  const canAlert = now - lastAlertAt > windowMs;
  if (countInWindow >= threshold && canAlert) {
    lastAlertAtByKey.set(key, now);
    console.error(`[monitoring] ${key} reached ${countInWindow} failures in ${Math.round(windowMs / 1000)}s`, payload);
  }
}

export function trackRealtimeStatus(
  operation: string,
  status: string,
  error?: Error
): void {
  if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT' || status === 'CLOSED') {
    trackFailure('realtime', operation, error ?? status, { status });
  }
}

import React, { useCallback, useEffect, useState } from 'react';
import InlineErrorBanner from '../components/InlineErrorBanner';
import { isSupabaseConfigured } from '../lib/supabaseClient';
import {
  REPORT_REASONS,
  adminDeleteReportedUser,
  adminListReports,
  adminResolveReport,
  type AdminReport,
  type ReportStatus,
} from '../services/supabaseSafety';

const STATUS_TABS: { id: ReportStatus; label: string }[] = [
  { id: 'open', label: 'Open' },
  { id: 'actioned', label: 'Actioned' },
  { id: 'dismissed', label: 'Dismissed' },
];

const reasonLabel = (id: string) => REPORT_REASONS.find((r) => r.id === id)?.label ?? id;

function timeAgo(ms: number): string {
  const mins = Math.round((Date.now() - ms) / 60_000);
  if (mins < 60) return `${Math.max(1, mins)}m ago`;
  const hours = Math.round(mins / 60);
  if (hours < 48) return `${hours}h ago`;
  return `${Math.round(hours / 24)}d ago`;
}

const ReportsPage: React.FC = () => {
  const [status, setStatus] = useState<ReportStatus>('open');
  const [reports, setReports] = useState<AdminReport[]>([]);
  const [canDeleteUsers, setCanDeleteUsers] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [notes, setNotes] = useState<Record<string, string>>({});

  const supabaseEnabled = isSupabaseConfigured();

  const load = useCallback(async () => {
    if (!supabaseEnabled) return;
    setLoading(true);
    setError(null);
    try {
      const res = await adminListReports(status);
      setReports(res.reports);
      setCanDeleteUsers(res.canDeleteUsers);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load reports.');
      setReports([]);
    } finally {
      setLoading(false);
    }
  }, [status, supabaseEnabled]);

  useEffect(() => {
    void load();
  }, [load]);

  const resolve = async (report: AdminReport, resolution: 'actioned' | 'dismissed') => {
    setBusyId(report.id);
    setError(null);
    const res = await adminResolveReport(report.id, resolution, notes[report.id]);
    setBusyId(null);
    if (res.ok === false) {
      setError(res.error);
      return;
    }
    setReports((prev) => prev.filter((r) => r.id !== report.id));
  };

  const deleteUser = async (report: AdminReport) => {
    if (
      !window.confirm(
        `Permanently delete ${report.reportedName}'s account? Their profile, messages and wallet are removed. This can't be undone.`
      )
    ) {
      return;
    }
    setBusyId(report.id);
    setError(null);
    const res = await adminDeleteReportedUser(report.id, notes[report.id]);
    setBusyId(null);
    if (res.ok === false) {
      setError(res.error === 'target_is_admin' ? 'That account is an admin. Remove it from Admins instead.' : res.error);
      return;
    }
    // Every report about the deleted member goes with them.
    setReports((prev) => prev.filter((r) => r.reportedId !== report.reportedId));
  };

  if (!supabaseEnabled) {
    return (
      <div className="p-8">
        <h1 className="text-3xl font-black text-zinc-900 dark:text-white">Reports</h1>
        <p className="text-zinc-500 mt-2">Connect Supabase to review member reports.</p>
      </div>
    );
  }

  return (
    <div className="p-8">
      <div className="mb-6">
        <h1 className="text-3xl font-black text-zinc-900 dark:text-white">Reports</h1>
        <p className="text-zinc-500 mt-1">
          Member reports, oldest first. App Store and Google Play expect reports to be reviewed promptly.
        </p>
      </div>

      <div className="flex gap-2 mb-6" role="tablist" aria-label="Report status">
        {STATUS_TABS.map((t) => (
          <button
            key={t.id}
            type="button"
            role="tab"
            aria-selected={status === t.id}
            onClick={() => setStatus(t.id)}
            className={`px-4 py-2 rounded-xl text-sm font-semibold transition-colors ${
              status === t.id
                ? 'bg-rose-600 text-white'
                : 'bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-300 hover:bg-zinc-200 dark:hover:bg-zinc-700'
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {error ? (
        <InlineErrorBanner message={error} onRetry={() => void load()} onDismiss={() => setError(null)} className="mb-4" />
      ) : null}

      {loading ? (
        <p className="text-zinc-500">Loading…</p>
      ) : reports.length === 0 ? (
        <p className="rounded-2xl border border-dashed border-zinc-300 dark:border-zinc-700 py-12 text-center text-zinc-500">
          No {status} reports.
        </p>
      ) : (
        <div className="grid gap-4">
          {reports.map((r) => (
            <div
              key={r.id}
              className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-2xl p-6"
            >
              <div className="flex items-start gap-4">
                {r.reportedAvatar ? (
                  <img src={r.reportedAvatar} alt="" className="h-12 w-12 rounded-full object-cover shrink-0" />
                ) : (
                  <div className="h-12 w-12 rounded-full bg-zinc-200 dark:bg-zinc-800 shrink-0" aria-hidden />
                )}
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="font-bold text-lg text-zinc-900 dark:text-white">{r.reportedName}</p>
                    <span className="rounded-full bg-red-100 dark:bg-red-900/40 px-2 py-0.5 text-xs font-semibold text-red-700 dark:text-red-300">
                      {reasonLabel(r.reason)}
                    </span>
                    {r.reportedOpenCount > 1 ? (
                      <span className="rounded-full bg-amber-100 dark:bg-amber-900/40 px-2 py-0.5 text-xs font-semibold text-amber-800 dark:text-amber-300">
                        {r.reportedOpenCount} open reports
                      </span>
                    ) : null}
                  </div>
                  <p className="text-zinc-500 text-sm mt-1">
                    Reported from {r.context} by {r.reporterName ?? 'a deleted member'} · {timeAgo(r.createdAt)}
                  </p>
                  <p className="text-zinc-400 text-xs mt-1 font-mono">{r.reportedId}</p>
                  {r.details ? (
                    <p className="mt-3 whitespace-pre-wrap rounded-xl bg-zinc-50 dark:bg-zinc-800/60 p-3 text-sm text-zinc-700 dark:text-zinc-200">
                      {r.details}
                    </p>
                  ) : null}
                  {r.resolutionNote ? (
                    <p className="mt-3 text-sm text-zinc-500">
                      <span className="font-semibold">Note:</span> {r.resolutionNote}
                    </p>
                  ) : null}
                </div>
              </div>

              {status === 'open' ? (
                <div className="mt-4 space-y-3">
                  <input
                    value={notes[r.id] ?? ''}
                    onChange={(e) => setNotes((n) => ({ ...n, [r.id]: e.target.value }))}
                    placeholder="Internal note (optional)"
                    aria-label={`Note for report on ${r.reportedName}`}
                    className="w-full px-4 py-2 bg-zinc-100 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-xl text-sm text-zinc-900 dark:text-white"
                  />
                  <div className="flex flex-wrap gap-2">
                    <button
                      type="button"
                      disabled={busyId === r.id}
                      onClick={() => void resolve(r, 'actioned')}
                      className="px-4 py-2 bg-rose-600 hover:bg-rose-500 text-white rounded-xl font-medium disabled:opacity-50"
                    >
                      Mark actioned
                    </button>
                    <button
                      type="button"
                      disabled={busyId === r.id}
                      onClick={() => void resolve(r, 'dismissed')}
                      className="px-4 py-2 bg-zinc-200 dark:bg-zinc-800 text-zinc-700 dark:text-zinc-200 hover:bg-zinc-300 dark:hover:bg-zinc-700 rounded-xl font-medium disabled:opacity-50"
                    >
                      Dismiss
                    </button>
                    {canDeleteUsers ? (
                      <button
                        type="button"
                        disabled={busyId === r.id}
                        onClick={() => void deleteUser(r)}
                        className="px-4 py-2 bg-red-600/20 text-red-500 hover:bg-red-600/30 rounded-xl font-medium disabled:opacity-50"
                      >
                        Delete account
                      </button>
                    ) : null}
                  </div>
                </div>
              ) : null}
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default ReportsPage;

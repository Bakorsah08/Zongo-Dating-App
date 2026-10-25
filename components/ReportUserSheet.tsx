import React, { useState } from 'react';
import { REPORT_REASONS, type ReportReason } from '../services/supabaseSafety';

interface ReportUserSheetProps {
  userName: string;
  onClose: () => void;
  /** Resolves with an error message, or nothing on success. */
  onSubmit: (input: { reason: ReportReason; details: string; alsoBlock: boolean }) => Promise<string | void>;
}

const ReportUserSheet: React.FC<ReportUserSheetProps> = ({ userName, onClose, onSubmit }) => {
  const [reason, setReason] = useState<ReportReason | null>(null);
  const [details, setDetails] = useState('');
  const [alsoBlock, setAlsoBlock] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [sent, setSent] = useState(false);

  const handleSubmit = async () => {
    if (!reason) {
      setError('Choose a reason.');
      return;
    }
    setBusy(true);
    setError('');
    const message = await onSubmit({ reason, details, alsoBlock });
    setBusy(false);
    if (message) setError(message);
    else setSent(true);
  };

  return (
    <div className="fixed inset-0 z-[120] flex items-end justify-center sm:items-center" role="dialog" aria-modal aria-labelledby="report-sheet-title">
      <button type="button" className="absolute inset-0 bg-black/50" aria-label="Close" onClick={onClose} />
      <div
        className="relative w-full max-w-md max-h-[90dvh] overflow-y-auto rounded-t-3xl sm:rounded-3xl bg-white p-6 text-zinc-900 shadow-xl"
        style={{ paddingBottom: 'max(1.5rem, env(safe-area-inset-bottom))' }}
      >
        {sent ? (
          <div className="text-center py-4">
            <h2 id="report-sheet-title" className="text-lg font-bold mb-2">
              Thanks for telling us
            </h2>
            <p className="text-sm text-zinc-600 mb-6">
              Our team will review your report. {alsoBlock ? `${userName} is blocked and can't contact you.` : ''}
              {' '}If you&apos;re in danger, contact local emergency services.
            </p>
            <button
              type="button"
              onClick={onClose}
              className="w-full min-h-[48px] rounded-2xl bg-pink-600 text-sm font-bold text-white"
            >
              Done
            </button>
          </div>
        ) : (
          <>
            <h2 id="report-sheet-title" className="text-lg font-bold">
              Report {userName}
            </h2>
            <p className="mt-1 mb-4 text-sm text-zinc-600">
              Reports are confidential. {userName} won&apos;t know who reported them.
            </p>

            <fieldset>
              <legend className="mb-2 text-xs font-bold uppercase tracking-widest text-zinc-500">What&apos;s wrong?</legend>
              <div className="divide-y divide-zinc-100 rounded-2xl border border-zinc-200">
                {REPORT_REASONS.map((r) => (
                  <label key={r.id} className="flex min-h-[48px] cursor-pointer items-center gap-3 px-4 py-3">
                    <input
                      type="radio"
                      name="report-reason"
                      value={r.id}
                      checked={reason === r.id}
                      onChange={() => setReason(r.id)}
                      className="h-5 w-5 accent-pink-600"
                    />
                    <span className="text-sm text-zinc-900">{r.label}</span>
                  </label>
                ))}
              </div>
            </fieldset>

            <label htmlFor="report-details" className="mt-4 mb-2 block text-xs font-bold uppercase tracking-widest text-zinc-500">
              Details (optional)
            </label>
            <textarea
              id="report-details"
              value={details}
              onChange={(e) => setDetails(e.target.value.slice(0, 1000))}
              rows={3}
              placeholder="Tell us what happened"
              className="w-full rounded-2xl border border-zinc-200 bg-zinc-50 px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-pink-500"
            />

            <label className="mt-4 flex min-h-[44px] cursor-pointer items-center gap-3">
              <input
                type="checkbox"
                checked={alsoBlock}
                onChange={(e) => setAlsoBlock(e.target.checked)}
                className="h-5 w-5 accent-pink-600"
              />
              <span className="text-sm text-zinc-900">Also block {userName}</span>
            </label>

            {error ? (
              <p className="mt-3 text-sm text-red-600" role="alert">
                {error}
              </p>
            ) : null}

            <div className="mt-6 flex gap-3">
              <button
                type="button"
                onClick={onClose}
                className="flex-1 min-h-[48px] rounded-2xl border border-zinc-200 text-sm font-semibold text-zinc-700"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => void handleSubmit()}
                disabled={busy}
                className="flex-1 min-h-[48px] rounded-2xl bg-red-600 text-sm font-bold text-white disabled:opacity-60"
              >
                {busy ? 'Sending…' : 'Send report'}
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
};

export default ReportUserSheet;

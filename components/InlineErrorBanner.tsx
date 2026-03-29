import React from 'react';

interface InlineErrorBannerProps {
  message: string;
  onRetry?: () => void;
  retryLabel?: string;
  onDismiss?: () => void;
  dismissLabel?: string;
  className?: string;
}

/**
 * Non-blocking error surface with optional retry — use instead of console-only failures.
 */
const InlineErrorBanner: React.FC<InlineErrorBannerProps> = ({
  message,
  onRetry,
  retryLabel = 'Retry',
  onDismiss,
  dismissLabel = 'Dismiss',
  className = '',
}) => {
  return (
    <div
      role="alert"
      className={`flex flex-col gap-2 rounded-2xl border border-red-200 bg-red-50/95 px-3 py-3 text-sm text-red-900 shadow-sm ${className}`}
    >
      <p className="font-medium leading-snug">{message}</p>
      <div className="flex flex-wrap gap-2">
        {onRetry ? (
          <button
            type="button"
            onClick={onRetry}
            className="rounded-full bg-red-600 px-4 py-1.5 text-xs font-bold text-white transition hover:bg-red-700 active:scale-[0.98]"
          >
            {retryLabel}
          </button>
        ) : null}
        {onDismiss ? (
          <button
            type="button"
            onClick={onDismiss}
            className="rounded-full border border-red-300 bg-white px-4 py-1.5 text-xs font-semibold text-red-800 transition hover:bg-red-100 active:scale-[0.98]"
          >
            {dismissLabel}
          </button>
        ) : null}
      </div>
    </div>
  );
};

export default InlineErrorBanner;

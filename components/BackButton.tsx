import React from 'react';

/** Matches profile (UserDetailView) back control — glass circle + chevron. */
export const backButtonClassName =
  'inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-black/40 backdrop-blur-md border border-white/10 text-white transition-colors hover:bg-black/55 active:scale-95';

/** Light surfaces (e.g. white chat header). */
export const backButtonLightClassName =
  'inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-zinc-100 border border-zinc-200 text-zinc-900 shadow-sm transition-colors hover:bg-zinc-200/70 active:scale-95';

export function BackChevron({ className = 'text-white' }: { className?: string }) {
  return (
    <svg
      width="22"
      height="22"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.25"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
      className={className}
    >
      <path d="M15 18l-6-6 6-6" />
    </svg>
  );
}

export interface BackButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  onClick: () => void;
  variant?: 'dark' | 'light';
}

const BackButton: React.FC<BackButtonProps> = ({
  onClick,
  className = '',
  type = 'button',
  variant = 'dark',
  ...rest
}) => (
  <button
    type={type}
    onClick={onClick}
    aria-label="Back"
    className={`${variant === 'light' ? backButtonLightClassName : backButtonClassName} ${className}`.trim()}
    {...rest}
  >
    <BackChevron className={variant === 'light' ? 'text-zinc-900' : 'text-white'} />
  </button>
);

export default BackButton;

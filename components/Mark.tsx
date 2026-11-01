// The Cently mark: an open coin "C" with the lime cent dot.
export function Mark({ size = 24, className }: { size?: number; className?: string }) {
  return (
    <svg viewBox="0 0 64 64" width={size} height={size} aria-hidden className={className}>
      <path d="M46.14 17.86 A20 20 0 1 0 46.14 46.14" fill="none" stroke="currentColor" strokeWidth="10" strokeLinecap="round" />
      <circle cx="51" cy="32" r="5.5" fill="var(--lime)" />
    </svg>
  );
}

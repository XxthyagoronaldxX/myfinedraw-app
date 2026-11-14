import Link from 'next/link';

/** Marca: dois nós ligados por um traço de pena — "diagramar com precisão". */
export function LogoMark({ size = 28 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 32 32" fill="none" aria-hidden>
      <rect x="1" y="1" width="30" height="30" rx="9" fill="var(--mfd-ink)" />
      <rect x="6.5" y="7" width="8" height="8" rx="2.2" fill="var(--mfd-bg)" />
      <circle cx="21.5" cy="21.5" r="4.5" fill="var(--mfd-brand)" />
      <path d="M14.5 11 H18.5 Q21.5 11 21.5 14 V17" stroke="var(--mfd-bg)" strokeWidth="1.8" strokeLinecap="round" fill="none" />
    </svg>
  );
}

export default function Logo({ href = '/', compact = false }: { href?: string; compact?: boolean }) {
  return (
    <Link href={href} className="flex shrink-0 items-center gap-2">
      <LogoMark />
      {!compact && (
        <span className="font-display text-[17px] font-bold tracking-tight text-ink">
          my<span className="text-brand">fine</span>draw
        </span>
      )}
    </Link>
  );
}

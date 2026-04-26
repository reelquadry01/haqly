import { useId, type CSSProperties } from "react";

type BrandMarkProps = {
  size?: number;
  className?: string;
};

export function BrandMark({ size = 40, className }: BrandMarkProps) {
  const id = useId().replace(/:/g, "");

  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 64 64"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
      aria-hidden="true"
    >
      <defs>
        <linearGradient id={`g1-${id}`} x1="0" y1="64" x2="64" y2="0" gradientUnits="userSpaceOnUse">
          <stop offset="0" stopColor="#0B1D51" />
          <stop offset="0.45" stopColor="#145C8A" />
          <stop offset="1" stopColor="#0EA5A0" />
        </linearGradient>
        <linearGradient id={`g2-${id}`} x1="32" y1="0" x2="32" y2="64" gradientUnits="userSpaceOnUse">
          <stop offset="0" stopColor="#0EA5A0" />
          <stop offset="1" stopColor="#2BC85A" />
        </linearGradient>
        <linearGradient id={`g3-${id}`} x1="0" y1="0" x2="64" y2="64" gradientUnits="userSpaceOnUse">
          <stop offset="0" stopColor="#1A56DB" />
          <stop offset="1" stopColor="#0B1D51" />
        </linearGradient>
      </defs>
      <rect x="4" y="4" width="56" height="56" rx="16" fill={`url(#g1-${id})`} />
      <rect x="4" y="4" width="56" height="56" rx="16" fill="rgba(255,255,255,0.06)" />
      <rect x="14" y="16" width="6" height="32" rx="3" fill="#fff" opacity="0.95" />
      <rect x="34" y="16" width="6" height="32" rx="3" fill="#fff" opacity="0.95" />
      <rect x="20" y="27" width="14" height="6" rx="3" fill={`url(#g2-${id})`} opacity="0.92" />
      <rect x="20" y="27" width="14" height="6" rx="3" fill="rgba(255,255,255,0.55)" />
      <circle cx="48" cy="16" r="4" fill={`url(#g2-${id})`} opacity="0.9" />
      <circle cx="48" cy="16" r="4" fill="rgba(255,255,255,0.45)" />
      <path d="M4 20C4 11.16 11.16 4 20 4H44C52.84 4 60 11.16 60 20V22C60 13.16 52.84 6 44 6H20C11.16 6 4 13.16 4 22V20Z" fill="rgba(255,255,255,0.12)" />
    </svg>
  );
}

type BrandLockupProps = {
  compact?: boolean;
  className?: string;
  subtitle?: string;
  color?: CSSProperties["color"];
};

export function BrandLockup({ compact = false, className, subtitle, color }: BrandLockupProps) {
  return (
    <span className={className} style={color ? { color } : undefined}>
      <BrandMark size={compact ? 28 : 40} className="haqly-brand-mark" />
      <span className="haqly-brand-copy">
        <strong>Haqly</strong>
        {subtitle ? <small>{subtitle}</small> : null}
      </span>
    </span>
  );
}

import { useId, type CSSProperties } from "react";

type BrandMarkProps = {
  size?: number;
  className?: string;
};

export function BrandMark({ size = 40, className }: BrandMarkProps) {
  const gradientId = useId().replace(/:/g, "");
  const clipId = useId().replace(/:/g, "");

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
        <linearGradient id={gradientId} x1="10" y1="54" x2="55" y2="10" gradientUnits="userSpaceOnUse">
          <stop offset="0" stopColor="#132B7A" />
          <stop offset="0.52" stopColor="#16708A" />
          <stop offset="1" stopColor="#2BC85A" />
        </linearGradient>
        <clipPath id={clipId}>
          <path d="M16 10H28V31H38V24H48V10L60 22H52V54H40V34H28V54H16V10Z" />
        </clipPath>
      </defs>
      <path d="M16 10H28V31H38V24H48V10L60 22H52V54H40V34H28V54H16V10Z" fill={`url(#${gradientId})`} />
      <g clipPath={`url(#${clipId})`}>
        <path d="M6 56C13 42 24 34 40 34C49 34 57 36 63 39V64H6V56Z" fill="rgba(9, 28, 96, 0.24)" />
      </g>
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

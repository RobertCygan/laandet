/** Wordmark «Laandet.» with the exchange mark from the prototype (D-003). */
export function LogoMark({ size = 34 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 40 40" aria-hidden="true" focusable="false">
      <rect width="40" height="40" rx="12" fill="#174d3c" />
      <g fill="none" stroke="#f7f5ef" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
        <path d="M29 12H17a9 9 0 0 0 0 18h2M11 28h12a9 9 0 0 0 0-18h-2" />
        <path d="m24 7 5 5-5 5M16 23l-5 5 5 5" />
      </g>
    </svg>
  );
}

export function Logo() {
  return (
    <span className="brand">
      <LogoMark />
      <span>
        Laandet<span className="brand-dot">.</span>
      </span>
    </span>
  );
}

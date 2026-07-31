type SparkLogoProps = {
  className?: string;
  markClassName?: string;
  showWordmark?: boolean;
};

/** Bare ignition mark: idea catching into a build. No tile behind it. */
export default function SparkLogo({
  className = "",
  markClassName = "h-8 w-8",
  showWordmark = true,
}: SparkLogoProps) {
  return (
    <div className={`flex items-center gap-3 ${className}`}>
      <svg
        className={markClassName}
        viewBox="0 0 40 40"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        aria-hidden="true"
      >
        <g className="spark-mark-spin">
          <circle cx="20" cy="20" r="2.6" className="fill-[var(--accent)]" />
          <path
            d="M20 5.5 L21.15 15.2 L20 14.1 L18.85 15.2 Z"
            className="fill-[var(--accent)]"
          />
          <path
            d="M34.5 20 L24.8 21.15 L25.9 20 L24.8 18.85 Z"
            className="fill-[var(--accent-soft)]"
          />
          <path
            d="M20 34.5 L18.85 24.8 L20 25.9 L21.15 24.8 Z"
            className="fill-[var(--accent)]"
          />
          <path
            d="M5.5 20 L15.2 18.85 L14.1 20 L15.2 21.15 Z"
            className="fill-[var(--accent-soft)]"
          />
          <path
            d="M30.2 9.8 L23.6 16.1 L24.9 15.1 L24.3 16.8 Z"
            className="fill-[var(--accent-deep)]"
          />
          <path
            d="M9.8 30.2 L16.1 23.6 L15.1 24.9 L16.8 24.3 Z"
            className="fill-[var(--accent-deep)]"
          />
        </g>
      </svg>
      {showWordmark ? (
        <p className="font-display text-[1.35rem] font-medium tracking-tight text-[var(--ink)]">
          Spark
        </p>
      ) : null}
    </div>
  );
}

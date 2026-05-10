const VIEW_W = 62;
const VIEW_H = 32;

/** Mark height (px); width is always derived from the 62×32 viewBox so there is no horizontal letterboxing. */
const SIZE = {
  sm: { h: 17, wordmarkClass: "vaultfit-logo--sm" },
  md: { h: 22, wordmarkClass: "vaultfit-logo--md" },
  lg: { h: 26, wordmarkClass: "vaultfit-logo--lg" },
} as const;

function markWidthForHeight(h: number): number {
  return Math.round((h * VIEW_W) / VIEW_H);
}

/** User-provided horizontal dumbbell mark (viewBox 0 0 62 32). */
const DUMBBELL_PATH_D =
  "M61 16L56.5789 16M5.42105 16L1 16M38.5789 16H23.4211M23.3768 5.61601C23.3768 4.39177 22.9062 3.21767 22.0685 2.352C21.2308 1.48633 20.0947 1 18.91 1C17.7253 1 16.5892 1.48633 15.7515 2.352C14.9138 3.21767 14.4432 4.39177 14.4432 5.61601L14.4447 11.384C14.4445 10.16 13.9738 8.98615 13.1361 8.12079C12.7213 7.6923 12.2289 7.35244 11.687 7.1206C11.1452 6.88877 10.5644 6.7695 9.97789 6.76961C9.3914 6.76971 8.81068 6.88919 8.26887 7.12123C7.72706 7.35326 7.23479 7.69331 6.82015 8.12195C6.40551 8.55058 6.07663 9.05942 5.85229 9.6194C5.62795 10.1794 5.51253 10.7795 5.51263 11.3856L5.51263 20.6144C5.51242 21.8384 5.98275 23.0124 6.82015 23.8781C7.65755 24.7437 8.79342 25.2302 9.97789 25.2304C11.1624 25.2306 12.2984 24.7446 13.1361 23.8792C13.9738 23.0138 14.4445 21.84 14.4447 20.616L14.4432 26.384C14.4432 26.9902 14.5587 27.5904 14.7832 28.1505C15.0077 28.7105 15.3367 29.2194 15.7515 29.648C16.1662 30.0766 16.6587 30.4167 17.2006 30.6486C17.7426 30.8806 18.3234 31 18.91 31C19.4966 31 20.0774 30.8806 20.6194 30.6486C21.1613 30.4166 21.6537 30.0766 22.0685 29.648C22.4833 29.2194 22.8123 28.7105 23.0368 28.1505C23.2613 27.5904 23.3768 26.9902 23.3768 26.384V5.61601ZM56.4874 11.3856C56.4876 10.1616 56.0172 8.98762 55.1798 8.12195C54.7652 7.69331 54.2729 7.35326 53.7311 7.12123C53.1893 6.88919 52.6086 6.76971 52.0221 6.76961C51.4356 6.7695 50.8548 6.88877 50.313 7.1206C49.7711 7.35244 49.2787 7.6923 48.8639 8.12079C48.4491 8.54927 48.1201 9.05799 47.8955 9.61789C47.671 10.1778 47.5554 10.7779 47.5553 11.384L47.5568 5.61601C47.5568 4.39177 47.0862 3.21767 46.2485 2.352C45.4108 1.48633 44.2747 1 43.09 1C41.9053 1 40.7692 1.48633 39.9315 2.352C39.0938 3.21767 38.6232 4.39177 38.6232 5.61601V26.384C38.6232 26.9902 38.7387 27.5904 38.9632 28.1505C39.1877 28.7105 39.5167 29.2194 39.9315 29.648C40.3462 30.0766 40.8387 30.4166 41.3806 30.6486C41.9226 30.8806 42.5034 31 43.09 31C43.6766 31 44.2574 30.8806 44.7994 30.6486C45.3413 30.4167 45.8338 30.0766 46.2485 29.648C46.6633 29.2194 46.9923 28.7105 47.2168 28.1505C47.4413 27.5904 47.5568 26.9902 47.5568 26.384L47.5553 20.616C47.5555 21.84 48.0262 23.0138 48.8639 23.8792C49.7016 24.7446 50.8376 25.2306 52.0221 25.2304C53.2066 25.2302 54.3424 24.7437 55.1798 23.8781C56.0172 23.0124 56.4876 21.8384 56.4874 20.6144V11.3856Z";

export type VaultFitLogoSize = keyof typeof SIZE;

export type VaultFitLogoTone = "default" | "admin";

type VaultFitLogoProps = {
  size?: VaultFitLogoSize;
  tone?: VaultFitLogoTone;
  className?: string;
};

function VaultFitDumbbellSvg({ widthPx, heightPx, className }: { widthPx: number; heightPx: number; className?: string }) {
  return (
    <svg
      className={className}
      width={widthPx}
      height={heightPx}
      viewBox={`0 0 ${VIEW_W} ${VIEW_H}`}
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      preserveAspectRatio="xMidYMid meet"
      aria-hidden
    >
      <path
        d={DUMBBELL_PATH_D}
        stroke="currentColor"
        strokeWidth={2}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

/**
 * Brand lockup: custom horizontal dumbbell SVG + “Vault” + “Fit”.
 */
export function VaultFitLogo({ size = "md", tone = "default", className }: VaultFitLogoProps) {
  const s = SIZE[size];
  const w = markWidthForHeight(s.h);
  return (
    <div
      className={`vaultfit-logo ${s.wordmarkClass} ${tone === "admin" ? "vaultfit-logo--tone-admin" : "vaultfit-logo--tone-default"} ${className ?? ""}`.trim()}
      aria-label="VaultFit"
    >
      <VaultFitDumbbellSvg widthPx={w} heightPx={s.h} className="vaultfit-logo__icon" />
      <span className="vaultfit-logo__wordmark">
        <span className="vaultfit-logo__vault">Vault</span>
        <span className="vaultfit-logo__fit">Fit</span>
      </span>
    </div>
  );
}

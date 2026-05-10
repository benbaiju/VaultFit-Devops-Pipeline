/**
 * Aligns with web `frontend/src/index.css` :root and VaultFit auth (App.css).
 */
export const colors = {
  bgMain: "#060913",
  bgAuth: "#050a14",
  /** Subtle lift for nested panels */
  surface: "#0f172a",
  surfaceMuted: "#0b1220",
  border: "rgba(255, 255, 255, 0.08)",
  borderLight: "rgba(255, 255, 255, 0.04)",
  borderStrong: "#1e293b",
  textPrimary: "#f8fafc",
  textSecondary: "#94a3b8",
  textMuted: "#64748b",
  /** Body on dark panels (slate-200/300) */
  textSection: "#cbd5e1",
  textBody: "#e2e8f0",
  textOnLight: "#0f172a",
  chipBorder: "#334155",
  secondaryButton: "#334155",
  inputLightBg: "#ffffff",
  inputLightBorder: "#e2e8f0",
  placeholder: "#94a3b8",
  primary: "#4f46e5",
  primaryHover: "#6366f1",
  primaryMuted: "#a5b4fc",
  primarySoft: "rgba(79, 70, 229, 0.2)",
  primarySoftStrong: "rgba(79, 70, 229, 0.25)",
  accent: "#06b6d4",
  vaultTeal: "#2dd4bf",
  vaultTealSoft: "rgba(45, 212, 191, 0.18)",
  success: "#10b981",
  successBright: "#22c55e",
  danger: "#ef4444",
  dangerDark: "#7f1d1d",
  dangerSoft: "#fda4af",
  warning: "#f59e0b",
  ctaOrangeTop: "#fb923c",
  ctaOrangeBottom: "#ea580c",
  linkAuth: "#fb923c",
  linkSoft: "#c7d2fe",
  navHeader: "#0b1220",
  tabBar: "#0b1220",
  blueAction: "#1d4ed8",
  bgDeep: "#020617",
} as const;

export type AppColors = typeof colors;

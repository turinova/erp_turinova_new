type Props = {
  variant?: "full" | "icon";
  height?: number;
  className?: string;
  /** Kept for call-site compat. */
  showParent?: boolean;
  tone?: "ink" | "inverse";
};

/** Canonical ProGate logo — vector `public/brand/progate-logo.svg` (transparent bg). */
export const PROGATE_LOGO_SRC = "/brand/progate-logo.svg";

/**
 * Full wordmark (mark + ProGate) or icon-only (left mark cropped).
 * Source: `src/progat_vegeleges_logo.svg` → `/brand/progate-logo.svg`.
 * `tone="inverse"`: white logo for dark backgrounds.
 */
export function TurinovaWordmark({
  variant = "full",
  height,
  className,
  tone = "ink",
}: Props) {
  const isIcon = variant === "icon";
  const h = height ?? (isIcon ? 28 : 36);
  const filter =
    tone === "inverse" ? "brightness(0) invert(1)" : undefined;

  if (isIcon) {
    return (
      <span
        className={className}
        style={{
          display: "inline-block",
          height: h,
          width: h,
          overflow: "hidden",
          lineHeight: 0,
          verticalAlign: "middle",
        }}
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={PROGATE_LOGO_SRC}
          alt="ProGate"
          height={h}
          style={{
            height: h,
            width: "auto",
            maxWidth: "none",
            display: "block",
            filter,
          }}
        />
      </span>
    );
  }

  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={PROGATE_LOGO_SRC}
      alt="ProGate"
      height={h}
      className={className}
      style={{ height: h, width: "auto", display: "block", filter }}
    />
  );
}

/** @deprecated Alias — same logo. */
export { TurinovaWordmark as ProGateWordmark };

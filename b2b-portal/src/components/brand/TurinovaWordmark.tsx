type Props = {
  variant?: "full" | "icon";
  height?: number;
  className?: string;
};

/** Fekete Turinova logó — világos Olvasó háttérre. */
export function TurinovaWordmark({
  variant = "full",
  height,
  className,
}: Props) {
  const isIcon = variant === "icon";
  const h = height ?? (isIcon ? 24 : 22);
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={
        isIcon ? "/brand/turinova-small-icon.png" : "/brand/turinova-logo.png"
      }
      alt="Turinova"
      height={h}
      className={className}
      style={{ height: h, width: "auto", display: "block" }}
    />
  );
}

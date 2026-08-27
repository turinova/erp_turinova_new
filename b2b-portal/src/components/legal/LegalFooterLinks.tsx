import Link from "next/link";

/** Compact legal links for auth / public footers. */
export function LegalFooterLinks({ className }: { className?: string }) {
  return (
    <p className={className ?? "mt-3 text-[11px] text-faint"}>
      <Link href="/aszf" className="underline underline-offset-2 hover:text-text">
        ÁSZF
      </Link>
      <span className="mx-1.5 text-line">·</span>
      <Link
        href="/adatkezeles"
        className="underline underline-offset-2 hover:text-text"
      >
        Adatkezelés
      </Link>
      <span className="mx-1.5 text-line">·</span>
      <Link
        href="/adatvedelem"
        className="underline underline-offset-2 hover:text-text"
      >
        Adatvédelem
      </Link>
      <span className="mx-1.5 text-line">·</span>
      <Link
        href="/adatvedelmi-nyilatkozat"
        className="underline underline-offset-2 hover:text-text"
      >
        Adatvédelmi nyilatkozat
      </Link>
    </p>
  );
}

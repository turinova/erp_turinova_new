import Link from "next/link";
import { TurinovaWordmark } from "@/components/brand/TurinovaWordmark";
import { COMPANY } from "@/lib/company";

type Props = {
  title: string;
  detail?: string;
  shopName?: string;
};

export function EmbedErrorState({ title, detail, shopName }: Props) {
  const isDev = process.env.NODE_ENV === "development";

  return (
    <div className="flex min-h-dvh flex-col bg-bg text-text">
      <header className="glass-bar flex h-12 items-center gap-3 px-4">
        <TurinovaWordmark height={22} />
        {shopName ? (
          <span className="truncate border border-line-strong px-2 py-1 text-[11px] font-semibold text-faint">
            {shopName}
          </span>
        ) : null}
      </header>

      <div className="mx-auto flex w-full max-w-[520px] flex-1 flex-col justify-center px-4 py-10">
        <h1 className="text-[18px] font-semibold tracking-tight">{title}</h1>
        {detail ? (
          <p className="mt-2 text-[13px] leading-relaxed text-faint">{detail}</p>
        ) : null}

        <div className="mt-6 flex flex-wrap gap-2">
          <Link
            href={`${COMPANY.productUrl}/signup`}
            className="tn-btn tn-btn-primary"
          >
            Regisztráció
          </Link>
          <a
            href={`mailto:${COMPANY.emails.support}`}
            className="tn-btn tn-btn-ghost"
          >
            {COMPANY.emails.support}
          </a>
        </div>

        {isDev ? (
          <p className="mt-10 text-[11px] leading-relaxed text-faint">
            Dev:{" "}
            <code className="bg-surface-2 px-1 font-mono text-[10px] text-text">
              /sr-embed?dev=1&amp;shopname=BOLTNEVED
            </code>
          </p>
        ) : null}
      </div>
    </div>
  );
}

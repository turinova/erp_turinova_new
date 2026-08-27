import Link from "next/link";
import type { ReactNode } from "react";
import { COMPANY, LEGAL_LINKS } from "@/lib/company";
import { TurinovaWordmark } from "@/components/brand/TurinovaWordmark";

/** Minimal markdown → React (headings, lists, paragraphs, bare URLs). */
export function renderLegalMarkdown(md: string): ReactNode[] {
  const lines = md.replace(/\r\n/g, "\n").split("\n");
  const out: ReactNode[] = [];
  let i = 0;
  let key = 0;

  const flushParagraph = (buf: string[]) => {
    const text = buf.join(" ").trim();
    if (!text) return;
    out.push(
      <p key={key++} className="mt-3 text-[14px] leading-relaxed text-text">
        {linkify(text)}
      </p>,
    );
  };

  while (i < lines.length) {
    const line = lines[i] ?? "";
    const trimmed = line.trim();

    if (!trimmed) {
      i += 1;
      continue;
    }

    const heading = trimmed.match(/^(#{1,5})\s+(.*)$/);
    if (heading) {
      const level = heading[1].length;
      const title = heading[2].trim();
      const cls =
        level <= 1
          ? "mt-10 text-[22px] font-semibold tracking-tight text-text first:mt-0"
          : level === 2
            ? "mt-8 text-[17px] font-semibold tracking-tight text-text"
            : "mt-6 text-[15px] font-semibold text-text";
      if (level <= 1) {
        out.push(
          <h1 key={key++} className={cls}>
            {title}
          </h1>,
        );
      } else if (level === 2) {
        out.push(
          <h2 key={key++} className={cls}>
            {title}
          </h2>,
        );
      } else {
        out.push(
          <h3 key={key++} className={cls}>
            {title}
          </h3>,
        );
      }
      i += 1;
      continue;
    }

    if (/^[-*]\s+/.test(trimmed)) {
      const items: string[] = [];
      while (i < lines.length) {
        const li = (lines[i] ?? "").trim();
        if (!/^[-*]\s+/.test(li)) break;
        items.push(li.replace(/^[-*]\s+/, ""));
        i += 1;
      }
      out.push(
        <ul
          key={key++}
          className="mt-3 list-disc space-y-2 pl-5 text-[14px] leading-relaxed text-text"
        >
          {items.map((item, idx) => (
            <li key={idx}>{linkify(item)}</li>
          ))}
        </ul>,
      );
      continue;
    }

    const buf: string[] = [trimmed];
    i += 1;
    while (i < lines.length) {
      const next = (lines[i] ?? "").trim();
      if (!next || /^(#{1,5})\s+/.test(next) || /^[-*]\s+/.test(next)) break;
      buf.push(next);
      i += 1;
    }
    flushParagraph(buf);
  }

  return out;
}

function linkify(text: string): ReactNode {
  const parts: ReactNode[] = [];
  const re = /(https?:\/\/[^\s)]+|www\.[^\s)]+)/gi;
  let last = 0;
  let m: RegExpExecArray | null;
  let k = 0;
  while ((m = re.exec(text)) !== null) {
    if (m.index > last) parts.push(text.slice(last, m.index));
    const raw = m[0];
    const href = raw.startsWith("http") ? raw : `https://${raw}`;
    parts.push(
      <a
        key={k++}
        href={href}
        className="underline underline-offset-2 hover:text-accent-ink"
        target="_blank"
        rel="noopener noreferrer"
      >
        {raw}
      </a>,
    );
    last = m.index + raw.length;
  }
  if (last < text.length) parts.push(text.slice(last));
  return parts.length === 1 ? parts[0] : parts;
}

export function LegalShell({
  children,
  activeHref,
}: {
  children: ReactNode;
  activeHref: string;
}) {
  return (
    <main className="min-h-dvh bg-bg">
      <header className="border-b border-line-strong bg-surface">
        <div className="mx-auto flex max-w-3xl items-center justify-between gap-4 px-4 py-4 sm:px-6">
          <Link
            href="/"
            className="inline-flex transition-opacity hover:opacity-80"
          >
            <TurinovaWordmark height={24} />
          </Link>
          <p className="text-[12px] text-faint">{COMPANY.shortName}</p>
        </div>
      </header>

      <div className="mx-auto max-w-3xl px-4 py-8 sm:px-6 sm:py-12">
        <nav
          aria-label="Jogi dokumentumok"
          className="mb-8 flex flex-wrap gap-x-3 gap-y-2 text-[12px] text-faint"
        >
          {LEGAL_LINKS.map((l) => (
            <Link
              key={l.href}
              href={l.href}
              className={
                l.href === activeHref
                  ? "font-medium text-text underline underline-offset-2"
                  : "underline underline-offset-2 hover:text-text"
              }
            >
              {l.label}
            </Link>
          ))}
        </nav>
        <article>{children}</article>
        <p className="mt-12 border-t border-line pt-6 text-[12px] text-faint">
          Kapcsolat:{" "}
          <a
            href={`mailto:${COMPANY.emails.central}`}
            className="underline underline-offset-2 hover:text-text"
          >
            {COMPANY.emails.central}
          </a>
          {" · "}
          {COMPANY.address.full}
        </p>
      </div>
    </main>
  );
}

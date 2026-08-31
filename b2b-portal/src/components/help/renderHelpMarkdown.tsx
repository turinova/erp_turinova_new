import Link from "next/link";
import type { ReactNode } from "react";

/** Merchant súgó markdown → React (headings, lists, paragraphs, links). */
export function renderHelpMarkdown(md: string): ReactNode[] {
  const lines = md.replace(/\r\n/g, "\n").split("\n");
  const out: ReactNode[] = [];
  let i = 0;
  let key = 0;

  const flushParagraph = (buf: string[]) => {
    const text = buf.join(" ").trim();
    if (!text) return;
    out.push(
      <p key={key++} className="mt-3 text-[13px] leading-relaxed text-text">
        {parseInline(text)}
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
          ? "mt-8 text-[20px] font-semibold tracking-tight text-text first:mt-0"
          : level === 2
            ? "mt-6 text-[16px] font-semibold tracking-tight text-text"
            : "mt-4 text-[14px] font-semibold text-text";
      if (level <= 1) {
        out.push(
          <h1 key={key++} className={cls}>
            {parseInline(title)}
          </h1>,
        );
      } else if (level === 2) {
        out.push(
          <h2 key={key++} className={cls}>
            {parseInline(title)}
          </h2>,
        );
      } else {
        out.push(
          <h3 key={key++} className={cls}>
            {parseInline(title)}
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
          className="mt-3 list-disc space-y-1.5 pl-5 text-[13px] leading-relaxed text-text"
        >
          {items.map((item, idx) => (
            <li key={idx}>{parseInline(item)}</li>
          ))}
        </ul>,
      );
      continue;
    }

    if (/^\d+\.\s+/.test(trimmed)) {
      const items: string[] = [];
      while (i < lines.length) {
        const li = (lines[i] ?? "").trim();
        if (!/^\d+\.\s+/.test(li)) break;
        items.push(li.replace(/^\d+\.\s+/, ""));
        i += 1;
      }
      out.push(
        <ol
          key={key++}
          className="mt-3 list-decimal space-y-1.5 pl-5 text-[13px] leading-relaxed text-text"
        >
          {items.map((item, idx) => (
            <li key={idx}>{parseInline(item)}</li>
          ))}
        </ol>,
      );
      continue;
    }

    const buf: string[] = [trimmed];
    i += 1;
    while (i < lines.length) {
      const next = (lines[i] ?? "").trim();
      if (
        !next ||
        /^(#{1,5})\s+/.test(next) ||
        /^[-*]\s+/.test(next) ||
        /^\d+\.\s+/.test(next)
      ) {
        break;
      }
      buf.push(next);
      i += 1;
    }
    flushParagraph(buf);
  }

  return out;
}

function parseInline(text: string): ReactNode {
  const parts: ReactNode[] = [];
  const re =
    /(\[([^\]]+)\]\(([^)]+)\)|\*\*([^*]+)\*\*|https?:\/\/[^\s)]+|www\.[^\s)]+)/gi;
  let last = 0;
  let m: RegExpExecArray | null;
  let k = 0;

  while ((m = re.exec(text)) !== null) {
    if (m.index > last) parts.push(text.slice(last, m.index));

    if (m[1]?.startsWith("[")) {
      const label = m[2];
      const href = m[3];
      parts.push(
        <InlineLink key={k++} href={href}>
          {label}
        </InlineLink>,
      );
    } else if (m[4]) {
      parts.push(
        <strong key={k++} className="font-semibold">
          {m[4]}
        </strong>,
      );
    } else {
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
    }
    last = m.index + m[0].length;
  }

  if (last < text.length) parts.push(text.slice(last));
  return parts.length === 1 ? parts[0] : parts;
}

function InlineLink({
  href,
  children,
}: {
  href: string;
  children: ReactNode;
}) {
  const cls = "font-semibold underline underline-offset-2 hover:text-accent-ink";
  if (href.startsWith("/")) {
    return (
      <Link href={href} className={cls}>
        {children}
      </Link>
    );
  }
  return (
    <a
      href={href}
      className={cls}
      target="_blank"
      rel="noopener noreferrer"
    >
      {children}
    </a>
  );
}

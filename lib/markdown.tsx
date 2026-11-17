import type {ReactNode} from "react";

/*
 * A small, safe Markdown subset for blog posts. No raw HTML is ever rendered.
 *   ## Heading / ### Smaller heading
 *   - bullet / 1. numbered
 *   > quote
 *   **bold**, *italic*, [link text](https://… or /path)
 * Blank lines separate blocks.
 */
function inline(text: string, key: string): ReactNode[] {
  const out: ReactNode[] = [];
  const pattern = /\*\*(.+?)\*\*|\*(.+?)\*|\[([^\]]+)\]\(([^)\s]+)\)/g;
  let last = 0, i = 0;
  for (const m of text.matchAll(pattern)) {
    if (m.index > last) out.push(text.slice(last, m.index));
    const k = `${key}-${i++}`;
    if (m[1]) out.push(<strong key={k}>{inline(m[1], k)}</strong>);
    else if (m[2]) out.push(<em key={k}>{inline(m[2], k)}</em>);
    else {
      const href = m[4];
      const safe = /^https?:\/\//i.test(href) || (href.startsWith("/") && !href.startsWith("//"));
      out.push(safe ? <a key={k} href={href} {...(href.startsWith("/") ? {} : {target: "_blank", rel: "noopener noreferrer"})}>{m[3]}</a> : m[3]);
    }
    last = m.index + m[0].length;
  }
  if (last < text.length) out.push(text.slice(last));
  return out;
}

export function Markdown({source}: {source: string}) {
  const blocks = source.replace(/\r\n?/g, "\n").split(/\n{2,}/).map(b => b.trim()).filter(Boolean);
  return <>{blocks.map((block, b) => {
    const key = `b${b}`;
    const lines = block.split("\n").map(l => l.trim());
    if (lines[0].startsWith("### ")) return <h3 key={key}>{inline(lines.join(" ").slice(4), key)}</h3>;
    if (lines[0].startsWith("## ")) return <h2 key={key}>{inline(lines.join(" ").slice(3), key)}</h2>;
    if (lines.every(l => /^[-*] /.test(l))) return <ul key={key}>{lines.map((l, i) => <li key={i}>{inline(l.slice(2), `${key}-${i}`)}</li>)}</ul>;
    if (lines.every(l => /^\d+[.)] /.test(l))) return <ol key={key}>{lines.map((l, i) => <li key={i}>{inline(l.replace(/^\d+[.)] /, ""), `${key}-${i}`)}</li>)}</ol>;
    if (lines.every(l => l.startsWith(">"))) return <blockquote key={key}><p>{inline(lines.map(l => l.replace(/^>\s?/, "")).join(" "), key)}</p></blockquote>;
    return <p key={key}>{inline(lines.join(" "), key)}</p>;
  })}</>;
}

/** Rough reading time for a post body. */
export const readingMinutes = (source: string) => Math.max(1, Math.ceil(source.split(/\s+/).filter(Boolean).length / 200));

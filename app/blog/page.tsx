import type {Metadata} from "next";
import Link from "next/link";
import {listPosts} from "@/lib/blog";
import {readingMinutes} from "@/lib/markdown";

export const metadata: Metadata = {
  title: "Health & fitness articles — RepCount",
  description: "Practical, beginner-friendly articles on strength training, home workouts, nutrition, sleep and building habits, from the RepCount team.",
  robots: {index: true, follow: true},
  alternates: {canonical: "/blog"},
  openGraph: {title: "Health & fitness articles — RepCount", description: "Practical articles on training, nutrition, sleep and habits.", type: "website", url: "/blog"},
};

const formatDate = (iso: string | null) => iso ? new Date(iso).toLocaleDateString("en-GB", {day: "numeric", month: "long", year: "numeric"}) : "";

export default async function BlogIndex() {
  const posts = await listPosts({publishedOnly: true});
  return <>
    <section className="rc-blog-hero">
      <p className="rc-eyebrow">RESOURCES</p>
      <h1>Health &amp; fitness, <em>made simple.</em></h1>
      <p>Practical guides on training, food, sleep and habits. Written for real life, not for athletes.</p>
    </section>
    {posts.length === 0 ? <p className="rc-blog-empty">New articles are on the way. Check back soon.</p>
      : <ul className="rc-blog-list">{posts.map(p => <li key={p.id}>
        <Link href={`/blog/${p.slug}`} className="rc-blog-card">
          {/* eslint-disable-next-line @next/next/no-img-element -- admin-provided external image */}
          {p.coverUrl && <img src={p.coverUrl} alt="" loading="lazy"/>}
          <span className="rc-blog-meta">{formatDate(p.publishedAt)} · {readingMinutes(p.body)} min read</span>
          <h2>{p.title}</h2>
          {p.excerpt && <p>{p.excerpt}</p>}
          <span className="rc-blog-more">Read article →</span>
        </Link>
      </li>)}</ul>}
  </>;
}

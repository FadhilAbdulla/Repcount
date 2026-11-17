import type {Metadata} from "next";
import Link from "next/link";
import {notFound} from "next/navigation";
import {publishedPost} from "@/lib/blog";
import {Markdown, readingMinutes} from "@/lib/markdown";

type Props = {params: Promise<{slug: string}>};

export async function generateMetadata({params}: Props): Promise<Metadata> {
  const post = await publishedPost((await params).slug);
  if (!post) return {title: "Article not found — RepCount", robots: {index: false}};
  const description = post.excerpt || post.body.replace(/[#*>[\]()-]/g, "").slice(0, 155);
  return {
    title: `${post.title} — RepCount`,
    description,
    robots: {index: true, follow: true},
    alternates: {canonical: `/blog/${post.slug}`},
    openGraph: {
      title: post.title, description, type: "article", url: `/blog/${post.slug}`,
      publishedTime: post.publishedAt ?? undefined, modifiedTime: post.updatedAt,
      ...(post.coverUrl ? {images: [{url: post.coverUrl}]} : {}),
    },
  };
}

export default async function BlogPost({params}: Props) {
  const post = await publishedPost((await params).slug);
  if (!post) notFound();
  const date = post.publishedAt ? new Date(post.publishedAt).toLocaleDateString("en-GB", {day: "numeric", month: "long", year: "numeric"}) : "";
  // Structured data so search engines understand this is an article.
  const jsonLd = {
    "@context": "https://schema.org", "@type": "Article", headline: post.title, description: post.excerpt,
    datePublished: post.publishedAt, dateModified: post.updatedAt, author: {"@type": "Organization", name: "RepCount"},
    publisher: {"@type": "Organization", name: "RepCount"}, ...(post.coverUrl ? {image: post.coverUrl} : {}),
  };
  return <article className="rc-article">
    <script type="application/ld+json" dangerouslySetInnerHTML={{__html: JSON.stringify(jsonLd).replace(/</g, "\\u003c")}}/>
    <Link className="rc-article-back" href="/blog">← All articles</Link>
    <header>
      <p className="rc-blog-meta">{date} · {readingMinutes(post.body)} min read</p>
      <h1>{post.title}</h1>
      {post.excerpt && <p className="rc-article-lede">{post.excerpt}</p>}
    </header>
    {/* eslint-disable-next-line @next/next/no-img-element -- admin-provided external image */}
    {post.coverUrl && <img className="rc-article-cover" src={post.coverUrl} alt=""/>}
    <div className="rc-article-body"><Markdown source={post.body}/></div>
    <aside className="rc-article-cta">
      <h2>Want a plan made for you?</h2>
      <p>RepCount pairs you with a personal trainer who plans your weeks and checks in on your progress.</p>
      <Link className="rc-button" href="/register">Find your starting point →</Link>
    </aside>
  </article>;
}

import type {MetadataRoute} from "next";
import {connection} from "next/server";
import {listPosts} from "@/lib/blog";

/** /sitemap.xml: the public pages and every published article, so search engines can find them. */
export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  await connection(); // articles change from the admin panel, so build this per request
  const base = process.env.SITE_URL || "http://localhost:3000";
  const posts = await listPosts({publishedOnly: true});
  return [
    {url: `${base}/`, changeFrequency: "weekly", priority: 1},
    {url: `${base}/blog`, changeFrequency: "weekly", priority: 0.8, lastModified: posts[0]?.updatedAt},
    ...posts.map(p => ({url: `${base}/blog/${p.slug}`, lastModified: p.updatedAt, changeFrequency: "monthly" as const, priority: 0.7})),
    {url: `${base}/privacy`, changeFrequency: "yearly", priority: 0.2},
  ];
}

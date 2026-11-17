import "server-only";
import {db} from "./db";

/* Blog / resources: articles the admin writes in Admin → Blog, shown publicly at /blog. */
export type Post = {
  id: number; slug: string; title: string; excerpt: string; body: string; coverUrl: string | null;
  published: boolean; publishedAt: string | null; updatedAt: string;
};
export type PostInput = {title: string; slug: string; excerpt: string; body: string; coverUrl: string; published: boolean};

type Row = {id: string; slug: string; title: string; excerpt: string; body: string; cover_url: string | null; published: boolean; published_at: Date | null; updated_at: Date};
const toPost = (r: Row): Post => ({
  id: Number(r.id), slug: r.slug, title: r.title, excerpt: r.excerpt, body: r.body, coverUrl: r.cover_url,
  published: r.published, publishedAt: r.published_at?.toISOString() ?? null, updatedAt: r.updated_at.toISOString(),
});

/** "How Much Protein?" → "how-much-protein". */
export const slugify = (s: string) => s.toLowerCase().normalize("NFKD").replace(/[̀-ͯ]/g, "").replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 80);

export async function listPosts({publishedOnly}: {publishedOnly: boolean}): Promise<Post[]> {
  const sql = await db();
  const rows = publishedOnly
    ? await sql<Row[]>`select * from posts where published order by published_at desc nulls last, id desc`
    : await sql<Row[]>`select * from posts order by published desc, coalesce(published_at, created_at) desc, id desc`;
  return rows.map(toPost);
}

export async function publishedPost(slug: string): Promise<Post | null> {
  const sql = await db();
  const [row] = await sql<Row[]>`select * from posts where slug = ${slug} and published`;
  return row ? toPost(row) : null;
}

export async function slugTaken(slug: string, exceptId: number | null) {
  const sql = await db();
  const [row] = await sql`select 1 from posts where slug = ${slug} and id <> ${exceptId ?? -1}`;
  return !!row;
}

/** Creates (id null) or updates a post. The publish date is set the first time it's published. */
export async function savePost(id: number | null, p: PostInput): Promise<Post | null> {
  const sql = await db();
  const cover = p.coverUrl || null;
  const [row] = id === null
    ? await sql<Row[]>`insert into posts (slug, title, excerpt, body, cover_url, published, published_at)
        values (${p.slug}, ${p.title}, ${p.excerpt}, ${p.body}, ${cover}, ${p.published}, ${p.published ? sql`now()` : null}) returning *`
    : await sql<Row[]>`update posts set slug = ${p.slug}, title = ${p.title}, excerpt = ${p.excerpt}, body = ${p.body}, cover_url = ${cover},
        published = ${p.published}, published_at = case when ${p.published} then coalesce(published_at, now()) else published_at end, updated_at = now()
        where id = ${id} returning *`;
  return row ? toPost(row) : null;
}

export async function deletePost(id: number) {
  const sql = await db();
  const rows = await sql`delete from posts where id = ${id} returning id`;
  return rows.length > 0;
}

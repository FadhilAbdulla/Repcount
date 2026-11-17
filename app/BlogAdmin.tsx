"use client";

import {useState} from "react";
import Modal from "./Modal";
import {Icon} from "./Media";
import {deletePost, savePost} from "./actions/data";
import type {Post} from "@/lib/blog";

type Run = (action: () => Promise<{ok?: string; error?: string}>) => void;
type Draft = {title: string; slug: string; excerpt: string; body: string; coverUrl: string; published: boolean};
const empty: Draft = {title: "", slug: "", excerpt: "", body: "", coverUrl: "", published: true};
const slugify = (s: string) => s.toLowerCase().normalize("NFKD").replace(/[̀-ͯ]/g, "").replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 80);
const formatDate = (iso: string | null) => iso ? new Date(iso).toLocaleDateString("en-GB", {day: "numeric", month: "short", year: "numeric"}) : "—";

/** Admin → Blog: write, edit, publish and delete the articles shown at /blog. */
export default function BlogAdmin({posts, pending, run}: {posts: Post[]; pending: boolean; run: Run}) {
  const [editing, setEditing] = useState<{id: number | null; draft: Draft; slugTouched: boolean} | null>(null);
  const [error, setError] = useState("");
  const d = editing?.draft;
  const set = (patch: Partial<Draft>) => setEditing(e => e && {...e, draft: {...e.draft, ...patch}});
  const published = posts.filter(p => p.published).length;

  return <>
    <section className="card">
      <div className="section-top"><h2>Articles <span className="pill">{published} PUBLISHED · {posts.length - published} DRAFT{posts.length - published === 1 ? "" : "S"}</span></h2><button type="button" className="button dark rc-blog-new" onClick={() => {setError(""); setEditing({id: null, draft: empty, slugTouched: false});}}><Icon name="plus" size={16}/> Post</button></div>
      <p className="small-note rc-blog-intro">Published articles appear at <a href="/blog" target="_blank" rel="noreferrer">/blog</a>, in the site menu and in the sitemap Google reads. Write for people first: clear titles and a one-line summary help search too.</p>
      {posts.length === 0 ? <p className="rc-staff-empty">No articles yet. Write your first one with “+ Post”.</p>
        : <div className="table-scroll"><table className="rc-cards"><thead><tr><th>Title</th><th>Status</th><th>Published</th><th><span className="visually-hidden">Actions</span></th></tr></thead><tbody>
          {posts.map(p => <tr key={p.id}>
            <td data-label="Title"><b>{p.title}</b><small className="rc-blog-slug">/blog/{p.slug}</small></td>
            <td data-label="Status"><span className="rc-pay-status" data-status={p.published ? "verified" : "unassigned"}>{p.published ? "Published" : "Draft"}</span></td>
            <td data-label="Published">{formatDate(p.publishedAt)}</td>
            <td data-label="" className="rc-row-actions">
              {p.published && <a className="small-button" href={`/blog/${p.slug}`} target="_blank" rel="noreferrer">View</a>}
              <button type="button" className="small-button" onClick={() => {setError(""); setEditing({id: p.id, draft: {title: p.title, slug: p.slug, excerpt: p.excerpt, body: p.body, coverUrl: p.coverUrl ?? "", published: p.published}, slugTouched: true});}}>Edit</button>
              <button type="button" className="small-button rc-danger" disabled={pending} onClick={() => { if (confirm(`Delete “${p.title}”? This can’t be undone.`)) run(() => deletePost(p.id)); }}>Delete</button>
            </td>
          </tr>)}
        </tbody></table></div>}
    </section>

    <Modal open={!!editing} eyebrow="BLOG" title={editing?.id === null ? "New article" : "Edit article"} onClose={() => setEditing(null)}>
      {d && <form className="rc-modal-form rc-blog-form" onSubmit={e => {e.preventDefault(); const id = editing!.id; run(async () => {const result = await savePost(id, d); if (result.ok) setEditing(null); else setError(result.error ?? ""); return result;});}}>
        <label className="field">Title<input value={d.title} required maxLength={120} onChange={e => set({title: e.target.value, ...(editing!.slugTouched ? {} : {slug: slugify(e.target.value)})})}/></label>
        <label className="field">Web address<span className="rc-input-prefix"><span>/blog/</span><input value={d.slug} maxLength={80} onChange={e => {setEditing(x => x && {...x, slugTouched: true}); set({slug: e.target.value});}} placeholder="made-from-the-title"/></span></label>
        <label className="field">Summary (shown in Google and on the blog list)<textarea value={d.excerpt} maxLength={300} rows={2} onChange={e => set({excerpt: e.target.value})}/></label>
        <label className="field">Cover image link (optional)<input type="url" value={d.coverUrl} onChange={e => set({coverUrl: e.target.value})} placeholder="https://…"/></label>
        <label className="field">Article<textarea className="rc-blog-body" value={d.body} required rows={14} onChange={e => set({body: e.target.value})}/></label>
        <p className="small-note">Leave a blank line between paragraphs. <code>## Heading</code>, <code>- bullet</code>, <code>1. numbered</code>, <code>**bold**</code>, <code>[link](https://…)</code>.</p>
        <label className="checkbox"><input type="checkbox" checked={d.published} onChange={e => set({published: e.target.checked})}/> Published (untick to keep it as a draft)</label>
        {error && <p className="rc-modal-error" role="alert">{error}</p>}
        <button className="button dark" type="submit" disabled={pending}>{pending ? "Saving…" : d.published ? "Publish" : "Save draft"} <Icon name="arrow" size={16}/></button>
      </form>}
    </Modal>
  </>;
}

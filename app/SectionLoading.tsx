/** Shown in place of a client's section while it loads; the sidebar, header and tabs around it stay on screen. */
export default function SectionLoading({label = "Loading"}: {label?: string}) {
  return <div className="rc-section-loading" role="status" aria-live="polite">
    <span className="visually-hidden">{label}…</span>
    <div className="three-grid" aria-hidden="true">{[0, 1, 2].map(i => <span key={i} className="rc-skel rc-skel-card"/>)}</div>
    <span className="rc-skel rc-skel-panel" aria-hidden="true"/>
  </div>;
}

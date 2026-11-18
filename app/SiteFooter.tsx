import Link from "next/link";
import Brand from "./Brand";
import {Icon} from "./Media";
import {PAYMENTS_ENABLED} from "@/lib/features";

/**
 * The public site's footer, shared by the homepage and the blog. Edit it here.
 * `note` adds a line above the copyright (the blog's "not medical advice" disclaimer); `topId` is what "Back to top" jumps to.
 */
export default function SiteFooter({note, topId = "rc-top"}: {note?: React.ReactNode; topId?: string}) {
  return <footer className="rc-footer">
    <div className="rc-footer-main">
      <div><Brand variant="footer"/><p>Personal training.<br/>A more thoughtful kind of support.</p></div>
      <div>
        <span>MAKE YOURSELF AT HOME</span>
        <Link href="/#experience">The experience</Link>
        <Link href="/#programme">Programme &amp; price</Link>
        <Link href="/blog">Health articles</Link>
        <Link href="/register">Create your account <Icon name="diagonal" size={14}/></Link>
        <Link href="/login">Log in <Icon name="diagonal" size={14}/></Link>
      </div>
      <div>
        <span>OUR STARTING POINT</span>
        <p>India · Online coaching<br/>Adults 18+ · 30-day pilot</p>
        <small>{PAYMENTS_ENABLED ? <>Enrol online. Payment is verified<br/>by the team before you start.</> : <>Enrol online. The team matches<br/>you with a trainer.</>}</small>
      </div>
    </div>
    {note && <p className="rc-footer-note">{note}</p>}
    <div className="rc-footer-bottom">
      <span>© {new Date().getFullYear()} RepCount. Make every rep count. · <Link href="/privacy">Privacy policy</Link></span>
      <details className="rc-credits"><summary>Image &amp; video credits</summary><p>Stock media from <a href="https://mixkit.co/free-stock-video/physical-education-teacher-recording-a-class-5055/" target="_blank" rel="noreferrer">Mixkit</a>, <a href="https://www.pexels.com/" target="_blank" rel="noreferrer">Pexels</a> and <a href="https://unsplash.com/photos/IGfIGP5ONV0" target="_blank" rel="noreferrer">Unsplash</a>. People shown are not presented as RepCount staff or clients.</p></details>
      <a href={`#${topId}`}>Back to top <Icon name="diagonal" size={15}/></a>
    </div>
  </footer>;
}

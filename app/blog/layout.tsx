import Link from "next/link";
import {connection} from "next/server";
import Brand from "../Brand";
import WhatsAppButton from "../WhatsAppButton";
import SiteFooter from "../SiteFooter";
import {getSettings} from "@/lib/store";
import "../landing-premium.css";
import "./blog.css";

/** Public header, footer and WhatsApp button around the blog list and articles. */
export default async function BlogLayout({children}: {children: React.ReactNode}) {
  await connection(); // the WhatsApp number is a live setting
  const {whatsapp} = await getSettings();
  return <div className="rc-site rc-blog-site">
    <a className="skip" href="#rc-main">Skip to content</a>
    <header className="rc-header">
      <Link href="/" aria-label="RepCount home"><Brand/></Link>
      <nav className="rc-main-nav" aria-label="Main navigation">
        <Link href="/#experience">The experience</Link>
        <Link href="/#programme">Programme &amp; price</Link>
        <Link href="/blog">Blog</Link>
      </nav>
      <div className="rc-header-actions">
        <Link className="rc-member-link" href="/login">Log in</Link>
        <Link className="rc-button rc-blog-join" href="/register">Join RepCount</Link>
      </div>
    </header>
    <main id="rc-main" className="rc-blog-main">{children}</main>
    <SiteFooter topId="rc-main" note="Articles are general information, not medical advice. Talk to a doctor before starting a new exercise or diet plan if you have a health condition."/>
    <WhatsAppButton number={whatsapp}/>
  </div>;
}

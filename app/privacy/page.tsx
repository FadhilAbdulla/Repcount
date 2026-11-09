import type {Metadata} from "next";
import Link from "next/link";
import Brand from "../Brand";
import "./privacy.css";

export const metadata: Metadata = {title: "Privacy policy — RepCount", description: "What RepCount collects, why, who can see it and how to have it corrected or deleted."};

const updated = "9 November 2026";

/** Public privacy policy, linked from sign-up, the password page and the footer. Contact via PRIVACY_CONTACT_EMAIL. */
export default function PrivacyPage() {
  const contact = process.env.PRIVACY_CONTACT_EMAIL;
  const reach = contact ? <a href={`mailto:${contact}`}>{contact}</a> : "your trainer or the RepCount team";
  return <main className="rc-privacy" id="rc-main">
    <Link href="/" aria-label="RepCount home"><Brand/></Link>
    <h1>Privacy policy</h1>
    <p className="rc-privacy-updated">Last updated {updated}</p>
    <p>RepCount is an online personal-training programme for adults. This page explains what we collect, why, who can see it and the choices you have. Questions or requests: {reach}.</p>

    <h2>What we collect</h2>
    <ul>
      <li><b>Account details:</b> name, email, phone number (optional) and a securely hashed password. If you sign in with Google we receive your Google email address only.</li>
      <li><b>Your starting point:</b> your main goal, where you train and how often you’d like to train.</li>
      <li><b>Profile details your trainer or the team may record:</b> date of birth, gender and height.</li>
      <li><b>Health and activity data you log:</b> weight and body-fat entries, water, steps, sleep, mood, workouts and meals completed, and weekly check-in answers.</li>
      <li><b>Messages</b> between you and your trainer, and the payment reference you submit. We never collect card or bank details.</li>
      <li><b>Security records:</b> sign-in attempts and an audit log of staff actions on your account.</li>
    </ul>

    <h2>Why we use it</h2>
    <p>To run your programme: so your trainer can plan your workouts and nutrition, follow your progress and answer your questions; to verify payment; to show your streak and rank on the member leaderboard; and to keep accounts secure. We do not sell your data or use it for advertising.</p>

    <h2>Who can see it</h2>
    <ul>
      <li><b>Your assigned trainer</b> and the <b>RepCount admin team</b>.</li>
      <li><b>Other members</b> see only your first name and initial, your streak and your leaderboard score.</li>
      <li><b>Service providers</b> who store or deliver data for us: our database host (Neon), our web host (Vercel), Google (if you use Google sign-in) and our email provider (Resend). Data may be processed outside India.</li>
    </ul>

    <h2>How long we keep it</h2>
    <p>For as long as your account is open, and up to 12 months after your programme ends so you can come back to your history. You can ask us to delete it sooner.</p>

    <h2>Your choices and rights</h2>
    <p>You can ask to see, correct or delete your data, or withdraw your consent, by contacting {reach}. Withdrawing consent ends your programme, because we can’t coach you without this information. You can raise a concern with the Data Protection Board of India under the Digital Personal Data Protection Act, 2023.</p>

    <h2>Security</h2>
    <p>Passwords are hashed, connections are encrypted, sessions expire after 7 days and can be revoked, and only staff with a role on your account can open it.</p>

    <h2>Changes</h2>
    <p>If this policy changes in a way that matters, we’ll tell you in the app before it takes effect.</p>
    <p className="rc-privacy-back"><Link href="/">← Back to RepCount</Link></p>
  </main>;
}

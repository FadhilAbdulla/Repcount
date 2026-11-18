import {connection} from "next/server";
import {listPosts} from "@/lib/blog";
import {getSettings} from "@/lib/store";
import {PAYMENTS_ENABLED} from "@/lib/features";
import {SITE_DESCRIPTION, SITE_NAME, siteLink} from "@/lib/site";

/**
 * /llms.txt (https://llmstxt.org): a plain summary of RepCount for AI assistants and AI search, with every published
 * article. Built per request so new articles and the live price appear straight away.
 */
export async function GET() {
  await connection();
  const [posts, {price, currency}] = await Promise.all([listPosts({publishedOnly: true}), getSettings()]);
  const lines = [
    `# ${SITE_NAME}`,
    "",
    `> ${SITE_DESCRIPTION}`,
    "",
    "## About the programme",
    "",
    "- Every member gets a 1:1 personal trainer who plans their workouts week by week and writes a nutrition plan.",
    "- Weekly check-ins and live video sessions with the trainer; members message their trainer any time.",
    "- Members track workouts, water, steps, sleep, mood and weight; the RepCount mobile app can sync steps, sleep and heart rate from Health Connect (Android) and Apple Health (iPhone), including fitness bands.",
    `- 30-day programme, ${Number(price).toLocaleString("en-IN")} ${currency}. Adults 18+, online across India, at home or in a gym.`,
    PAYMENTS_ENABLED ? "- Sign up online; the team verifies payment before you start." : "- Sign up online; the team matches you with a trainer.",
    "",
    "## Pages",
    "",
    `- [Home](${siteLink("/")}): what RepCount is, how it works and the price`,
    `- [Create an account](${siteLink("/register")}): sign up and answer three questions about your goal`,
    `- [Health articles](${siteLink("/blog")}): practical articles on training, nutrition, sleep and habits`,
    `- [Privacy policy](${siteLink("/privacy")}): what we collect, including phone health data, and how to delete it`,
    "",
    "## Articles",
    "",
    ...(posts.length ? posts.map(p => `- [${p.title}](${siteLink(`/blog/${p.slug}`)})${p.excerpt ? `: ${p.excerpt}` : ""}`) : ["- No articles published yet."]),
    "",
  ];
  return new Response(lines.join("\n"), {headers: {"content-type": "text/plain; charset=utf-8", "cache-control": "public, max-age=0, s-maxage=600"}});
}

import type {MetadataRoute} from "next";

/** /robots.txt: the public site is crawlable; the signed-in app areas and APIs are not. */
export default function robots(): MetadataRoute.Robots {
  const base = process.env.SITE_URL || "http://localhost:3000";
  return {
    rules: {userAgent: "*", allow: "/", disallow: ["/admin", "/trainer", "/member", "/onboarding", "/api/", "/reset-password"]},
    sitemap: `${base}/sitemap.xml`,
  };
}

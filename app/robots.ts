import type {MetadataRoute} from "next";
import {SITE_URL} from "@/lib/site";

/** /robots.txt: the public site is crawlable; the signed-in app areas and APIs are not. */
export default function robots(): MetadataRoute.Robots {
  return {
    rules: {userAgent: "*", allow: "/", disallow: ["/admin", "/trainer", "/member", "/onboarding", "/api/", "/reset-password"]},
    sitemap: `${SITE_URL}/sitemap.xml`,
    host: SITE_URL,
  };
}

/* The public site's address and description, shared by metadata, sitemap, robots, llms.txt, structured data and emails. */

/** e.g. https://www.tryrepcount.com (no trailing slash). Set SITE_URL in the environment. */
export const SITE_URL = (process.env.SITE_URL || "http://localhost:3000").replace(/\/$/, "");

/** Absolute link to a path on this site. */
export const siteLink = (path: string) => new URL(path, SITE_URL + "/").toString();

export const SITE_NAME = "RepCount";
export const SITE_TAGLINE = "Stronger, in your own space.";
export const SITE_DESCRIPTION = "Online personal training in India: a 1:1 personal trainer plans your weekly workouts and nutrition, checks in every week and follows your progress, for adults 18+ training at home or in a gym.";

/** schema.org description of RepCount, embedded on the homepage so search engines and AI assistants understand the service. */
export const organizationJsonLd = () => ({
  "@context": "https://schema.org",
  "@graph": [
    {"@type": "Organization", "@id": `${SITE_URL}/#org`, name: SITE_NAME, url: SITE_URL, logo: siteLink("/repcount-icon-512.png"), slogan: "Make every rep count."},
    {"@type": "WebSite", "@id": `${SITE_URL}/#site`, name: SITE_NAME, url: SITE_URL, publisher: {"@id": `${SITE_URL}/#org`}, inLanguage: "en-IN"},
    {"@type": "Service", name: "Online personal training", serviceType: "Personal training", provider: {"@id": `${SITE_URL}/#org`},
      areaServed: {"@type": "Country", name: "India"}, audience: {"@type": "PeopleAudience", suggestedMinAge: 18}, description: SITE_DESCRIPTION},
  ],
});

/** Embeds structured data safely in a page. */
export const jsonLdScript = (data: unknown) => ({__html: JSON.stringify(data).replace(/</g, "\\u003c")});

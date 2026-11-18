import type {Metadata} from "next";
import {connection} from "next/server";
import {getSettings} from "@/lib/store";
import HomeClient from "./HomeClient";
import WhatsAppButton from "./WhatsAppButton";
import {SITE_DESCRIPTION, jsonLdScript, organizationJsonLd} from "@/lib/site";

// The public home page is open to search engines (the app areas stay noindex from the root layout).
export const metadata: Metadata = {description: SITE_DESCRIPTION, robots: {index: true, follow: true}, alternates: {canonical: "/"}};

export default async function Home() {
  await connection(); // price and WhatsApp number come from the live settings, not the build
  const {price, currency, whatsapp} = await getSettings();
  return <>
    <script type="application/ld+json" dangerouslySetInnerHTML={jsonLdScript(organizationJsonLd())}/>
    <HomeClient price={{amount: price, currency}}/><WhatsAppButton number={whatsapp}/>
  </>;
}

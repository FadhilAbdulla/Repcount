import type {Metadata} from "next";
import {memberPage} from "../../../../memberPage";

export const metadata: Metadata = {title: "Nutrition — RepCount"};

export default async function AdminClientNutrition({params}: {params: Promise<{id: string}>}) {
  return memberPage("admin", (await params).id, "nutrition");
}

import {revalidatePath} from "next/cache";
import {json, mobileMember, readJson, unauthorized} from "@/lib/mobileAuth";
import {notifyQuestion} from "@/lib/memberNotify";
import {addMessage, audit, clientByUser, listMessages} from "@/lib/store";

/** The member's thread with their trainer. */
export async function GET(request: Request) {
  const user = await mobileMember(request);
  if (!user) return unauthorized();
  const client = await clientByUser(user.id);
  return json({messages: client ? await listMessages(client.id) : []});
}

/** Asks the trainer a question (the same as "Ask your trainer" on the website). Body: {body}. */
export async function POST(request: Request) {
  const user = await mobileMember(request);
  if (!user) return unauthorized();
  const input = await readJson(request) as {body?: unknown} | null;
  const text = String(input?.body ?? "").trim();
  if (text.length < 3 || text.length > 1000) return json({error: "Write your question (up to 1,000 characters)."}, 400);
  const client = await clientByUser(user.id);
  if (!client) return json({error: "Your client record isn’t set up yet. Please contact the team."}, 409);
  await addMessage(client.id, user.id, text);
  await audit(user.id, "ask_coach", `${client.name} asked a question (app)`, client.id);
  await notifyQuestion(client, text);
  revalidatePath("/trainer", "layout");
  revalidatePath("/admin", "layout");
  return json({messages: await listMessages(client.id)});
}

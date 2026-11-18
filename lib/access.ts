import "server-only";
import {revalidatePath} from "next/cache";
import {requireStaff} from "./dal";
import {getClient} from "./store";

/** Result of a server action, shown as a notice on the page. */
export type Result = {ok?: string; error?: string};

/**
 * Coaching data (workouts, sessions, nutrition) is managed by the client's trainer or an admin.
 * Returns the signed-in staff member and the client, or an error for anyone else's client.
 */
export async function coachAccess(clientId: string) {
  const user = await requireStaff();
  const client = await getClient(clientId);
  if (!client || (user.role === "trainer" && client.trainerId !== user.id)) return {error: "That client isn’t assigned to you."} as const;
  return {user, client} as const;
}

/** Refreshes every area that shows client data, after a change. */
export function refreshAll() {
  revalidatePath("/admin", "layout");
  revalidatePath("/trainer", "layout");
  revalidatePath("/member", "layout");
}

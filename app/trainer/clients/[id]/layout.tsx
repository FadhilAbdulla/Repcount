import ClientShell from "../../../ClientShell";

/*
 * Sidebar, member header and section tabs stay mounted across this member's pages. The member must be assigned to this
 * trainer, checked before anything streams, so anyone else's member is a real 404. The pages check again.
 */
export default async function TrainerMemberLayout({children, params}: {children: React.ReactNode; params: Promise<{id: string}>}) {
  return <ClientShell viewer="trainer" id={(await params).id}>{children}</ClientShell>;
}

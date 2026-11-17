import ClientShell from "../../../ClientShell";

/* Sidebar, client header and section tabs stay mounted across this client's pages; unknown clients are a real 404. */
export default async function AdminClientLayout({children, params}: {children: React.ReactNode; params: Promise<{id: string}>}) {
  return <ClientShell viewer="admin" id={(await params).id}>{children}</ClientShell>;
}

import { Sidebar } from "@/components/layout/Sidebar";
import { Topbar } from "@/components/layout/Topbar";
import { requireSession } from "@/lib/require-session";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const session = await requireSession();

  return (
    <div className="flex h-screen overflow-hidden bg-gray-100">
      <Sidebar userName={session.name} userRole={session.role} />
      <div className="flex min-w-0 flex-1 flex-col">
        <Topbar />
        <main className="scrollbar-thin flex-1 overflow-y-auto px-6 py-5">{children}</main>
      </div>
    </div>
  );
}

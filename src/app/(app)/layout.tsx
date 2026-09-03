import { AppShell } from "@/components/layout/AppShell";
import { Topbar } from "@/components/layout/Topbar";
import { requireSession } from "@/lib/require-session";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const session = await requireSession();

  return (
    <AppShell userName={session.name} userRole={session.role}>
      <Topbar />
      <main className="scrollbar-thin flex-1 overflow-y-auto overflow-x-hidden px-4 py-4 sm:px-6 sm:py-5">
        {children}
      </main>
    </AppShell>
  );
}

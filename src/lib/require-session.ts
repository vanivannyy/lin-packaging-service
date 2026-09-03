import { redirect } from "next/navigation";
import { destroySession, getSession, type SessionPayload } from "@/lib/session";
import { canAccessModule } from "@/lib/roles";
import { prisma } from "@/lib/prisma";

export async function requireSession(): Promise<SessionPayload> {
  const session = await getSession();
  if (!session) {
    redirect("/login");
  }

  // Jaga-jaga kalau DB pernah di-reset/re-seed sementara cookie session lama
  // masih tersimpan di browser - userId di token bisa jadi sudah tidak ada lagi
  // dan bikin foreign key error (mis. saat logAudit). Validasi ke DB, kalau
  // user sudah tidak ada/nonaktif, paksa re-login.
  const user = await prisma.user.findUnique({
    where: { id: session.userId },
    select: { isActive: true, isDeleted: true },
  });
  if (!user || user.isDeleted || !user.isActive) {
    // requireSession() dipanggil dari Server Component (page.tsx) maupun Server
    // Action/Route Handler. Cookie hanya boleh dihapus dari 2 konteks terakhir,
    // jadi bungkus try/catch agar tetap aman dipanggil saat render halaman -
    // cookie basi ini nanti otomatis tertimpa saat user login ulang.
    try {
      await destroySession();
    } catch {
      // diam-diam abaikan - tidak bisa hapus cookie saat render Server Component.
    }
    redirect("/login");
  }

  return session;
}

export async function requireModule(moduleKey: string): Promise<SessionPayload> {
  const session = await requireSession();
  if (!canAccessModule(session.role, moduleKey)) {
    redirect("/dashboard");
  }
  return session;
}

export async function denyIfNoModule(moduleKey: string): Promise<Response | null> {
  const session = await getSession();
  if (!session) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }
  if (!canAccessModule(session.role, moduleKey)) {
    return Response.json({ error: "Forbidden" }, { status: 403 });
  }
  return null;
}

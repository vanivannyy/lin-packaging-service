import { z } from "zod";
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/prisma";
import { signMobileToken } from "@/lib/mobile-auth";
import { logAudit } from "@/lib/audit";
import { canAccessModule } from "@/lib/roles";

const loginSchema = z.object({
  email: z.string().email("Email tidak valid"),
  password: z.string().min(1, "Password wajib diisi"),
});

export async function POST(req: Request) {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return Response.json({ error: "Body harus JSON" }, { status: 400 });
  }

  const parsed = loginSchema.safeParse(body);
  if (!parsed.success) {
    return Response.json({ error: parsed.error.issues[0]?.message ?? "Data tidak valid" }, { status: 422 });
  }

  const { email, password } = parsed.data;

  const user = await prisma.user.findUnique({ where: { email } });
  if (!user || user.isDeleted || !user.isActive) {
    return Response.json({ error: "Email atau password salah" }, { status: 401 });
  }

  const passwordValid = await bcrypt.compare(password, user.passwordHash);
  if (!passwordValid) {
    return Response.json({ error: "Email atau password salah" }, { status: 401 });
  }

  if (!canAccessModule(user.role, "material-stok")) {
    return Response.json(
      { error: "Akun ini tidak memiliki akses ke modul Material & Stok" },
      { status: 403 },
    );
  }

  const token = await signMobileToken({
    userId: user.id,
    code: user.code,
    name: user.name,
    email: user.email,
    role: user.role,
  });

  await prisma.user.update({ where: { id: user.id }, data: { lastLoginAt: new Date() } });
  await logAudit({
    userId: user.id,
    module: "auth",
    action: "STATUS_CHANGE",
    referenceCode: user.code,
    newValue: { event: "LOGIN_MOBILE" },
  });

  return Response.json({
    token,
    user: { id: user.id, code: user.code, name: user.name, role: user.role },
  });
}

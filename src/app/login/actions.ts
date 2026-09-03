"use server";

import { z } from "zod";
import bcrypt from "bcryptjs";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { createSession } from "@/lib/session";
import { logAudit } from "@/lib/audit";
import { canAccessPath } from "@/lib/roles";

const loginSchema = z.object({
  email: z.string().email("Email tidak valid"),
  password: z.string().min(1, "Password wajib diisi"),
  redirectTo: z.string().optional(),
});

export async function loginAction(formData: FormData) {
  const parsed = loginSchema.safeParse({
    email: formData.get("email"),
    password: formData.get("password"),
    redirectTo: formData.get("redirectTo"),
  });

  const fail = (message: string) => {
    const params = new URLSearchParams({ error: message });
    const redirectTo = formData.get("redirectTo");
    if (typeof redirectTo === "string" && redirectTo) params.set("redirect", redirectTo);
    redirect(`/login?${params.toString()}`);
  };

  if (!parsed.success) {
    fail(parsed.error.issues[0]?.message ?? "Data tidak valid");
    return;
  }

  const { email, password, redirectTo } = parsed.data;

  const user = await prisma.user.findUnique({ where: { email } });
  if (!user || user.isDeleted || !user.isActive) {
    fail("Email atau password salah");
    return;
  }

  const passwordValid = await bcrypt.compare(password, user.passwordHash);
  if (!passwordValid) {
    fail("Email atau password salah");
    return;
  }

  await createSession({
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
    newValue: { event: "LOGIN" },
  });

  const nextPath = redirectTo && redirectTo.startsWith("/") && !redirectTo.startsWith("//") ? redirectTo : "/dashboard";
  redirect(canAccessPath(user.role, nextPath) ? nextPath : "/dashboard");
}

export async function logoutAction() {
  const { destroySession, getSession } = await import("@/lib/session");
  const session = await getSession();
  if (session) {
    await logAudit({
      userId: session.userId,
      module: "auth",
      action: "STATUS_CHANGE",
      referenceCode: session.code,
      newValue: { event: "LOGOUT" },
    });
  }
  await destroySession();
  redirect("/login");
}

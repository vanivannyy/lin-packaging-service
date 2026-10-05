"use server";

import bcrypt from "bcryptjs";
import { redirect } from "next/navigation";
import { z } from "zod";
import { logAudit } from "@/lib/audit";
import { prisma } from "@/lib/prisma";
import { requireSession } from "@/lib/require-session";

const schema = z.object({
  currentPassword: z.string().min(1, "Password saat ini wajib diisi"),
  newPassword: z.string().min(6, "Password baru minimal 6 karakter"),
  confirmPassword: z.string().min(1, "Ulangi password baru"),
});

export async function changePasswordAction(formData: FormData) {
  const session = await requireSession();
  const parsed = schema.safeParse({
    currentPassword: formData.get("currentPassword"),
    newPassword: formData.get("newPassword"),
    confirmPassword: formData.get("confirmPassword"),
  });

  const fail = (message: string) => {
    redirect(`/akun?error=${encodeURIComponent(message)}`);
  };

  if (!parsed.success) {
    fail(parsed.error.issues[0]?.message ?? "Data tidak valid");
    return;
  }

  const { currentPassword, newPassword, confirmPassword } = parsed.data;
  if (newPassword !== confirmPassword) {
    fail("Password baru dan ulangi password tidak sama");
    return;
  }

  const user = await prisma.user.findUnique({ where: { id: session.userId } });
  if (!user || user.isDeleted || !user.isActive) {
    fail("Akun tidak ditemukan");
    return;
  }

  const currentOk = await bcrypt.compare(currentPassword, user.passwordHash);
  if (!currentOk) {
    fail("Password saat ini salah");
    return;
  }

  if (currentPassword === newPassword) {
    fail("Password baru harus berbeda dari password saat ini");
    return;
  }

  await prisma.user.update({
    where: { id: user.id },
    data: { passwordHash: await bcrypt.hash(newPassword, 10) },
  });

  await logAudit({
    userId: user.id,
    module: "akun",
    action: "UPDATE",
    referenceCode: user.code,
    newValue: { event: "PASSWORD_CHANGE" },
  });

  redirect("/akun?ok=1");
}

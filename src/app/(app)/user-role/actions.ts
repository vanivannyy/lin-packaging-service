"use server";

import { z } from "zod";
import bcrypt from "bcryptjs";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { generateCode } from "@/lib/codegen";
import { logAudit } from "@/lib/audit";
import { requireModule } from "@/lib/require-session";
import { createSession } from "@/lib/session";
import type { UserRole } from "@prisma/client";

const userSchema = z.object({
  name: z.string().min(2),
  email: z.string().email(),
  department: z.string().optional(),
  position: z.string().optional(),
  role: z.enum(["OWNER", "GENERAL_MANAGER", "SALES", "FINANCE", "WAREHOUSE", "QC", "PURCHASING", "PRODUCTION_PLANNER"]),
  password: z.string().min(6, "Password minimal 6 karakter"),
});

export async function createUserAction(formData: FormData) {
  const session = await requireModule("user-role");
  const parsed = userSchema.parse({
    name: formData.get("name"),
    email: formData.get("email"),
    department: formData.get("department") || undefined,
    position: formData.get("position") || undefined,
    role: formData.get("role") as UserRole,
    password: formData.get("password"),
  });

  const code = await generateCode("user");
  const passwordHash = await bcrypt.hash(parsed.password, 10);
  const user = await prisma.user.create({
    data: {
      code,
      name: parsed.name,
      email: parsed.email,
      department: parsed.department,
      position: parsed.position,
      role: parsed.role,
      passwordHash,
    },
  });

  await logAudit({
    userId: session.userId,
    module: "user-role",
    action: "CREATE",
    referenceCode: user.code,
    newValue: { name: parsed.name, email: parsed.email, role: parsed.role },
  });
  revalidatePath("/user-role");
}

const updateUserSchema = userSchema.omit({ password: true }).extend({
  userId: z.string().min(1),
  password: z.string().optional(),
});

export async function updateUserAction(formData: FormData) {
  const session = await requireModule("user-role");
  const passwordRaw = String(formData.get("password") ?? "").trim();
  const parsed = updateUserSchema.safeParse({
    userId: formData.get("userId"),
    name: formData.get("name"),
    email: formData.get("email"),
    department: formData.get("department") || undefined,
    position: formData.get("position") || undefined,
    role: formData.get("role") as UserRole,
    password: passwordRaw || undefined,
  });

  const fail = (message: string) => {
    redirect(`/user-role?error=${encodeURIComponent(message)}`);
  };

  if (!parsed.success) {
    fail(parsed.error.issues[0]?.message ?? "Data tidak valid");
    return;
  }

  if (parsed.data.password && parsed.data.password.length < 6) {
    fail("Password minimal 6 karakter");
    return;
  }

  const current = await prisma.user.findFirst({
    where: { id: parsed.data.userId, isDeleted: false },
  });
  if (!current) {
    fail("User tidak ditemukan");
    return;
  }

  const emailTaken = await prisma.user.findFirst({
    where: { email: parsed.data.email, id: { not: current.id }, isDeleted: false },
    select: { id: true },
  });
  if (emailTaken) {
    fail("Email sudah dipakai user lain");
    return;
  }

  if (current.role === "OWNER" && parsed.data.role !== "OWNER") {
    const otherOwners = await prisma.user.count({
      where: { role: "OWNER", isDeleted: false, isActive: true, id: { not: current.id } },
    });
    if (otherOwners === 0) {
      fail("Harus ada minimal satu Owner yang aktif");
      return;
    }
  }

  const user = await prisma.user.update({
    where: { id: current.id },
    data: {
      name: parsed.data.name,
      email: parsed.data.email,
      department: parsed.data.department ?? null,
      position: parsed.data.position ?? null,
      role: parsed.data.role,
      ...(parsed.data.password ? { passwordHash: await bcrypt.hash(parsed.data.password, 10) } : {}),
    },
  });

  if (session.userId === user.id) {
    await createSession({
      userId: user.id,
      code: user.code,
      name: user.name,
      email: user.email,
      role: user.role,
    });
  }

  await logAudit({
    userId: session.userId,
    module: "user-role",
    action: "UPDATE",
    referenceCode: user.code,
    oldValue: {
      name: current.name,
      email: current.email,
      department: current.department,
      position: current.position,
      role: current.role,
    },
    newValue: {
      name: user.name,
      email: user.email,
      department: user.department,
      position: user.position,
      role: user.role,
      passwordChanged: Boolean(parsed.data.password),
    },
  });

  revalidatePath("/user-role");
  redirect("/user-role?ok=1");
}

export async function toggleUserActiveAction(formData: FormData) {
  const session = await requireModule("user-role");
  const userId = formData.get("userId") as string;
  const user = await prisma.user.findUniqueOrThrow({ where: { id: userId } });
  await prisma.user.update({ where: { id: userId }, data: { isActive: !user.isActive } });

  await logAudit({
    userId: session.userId,
    module: "user-role",
    action: "STATUS_CHANGE",
    referenceCode: user.code,
    oldValue: { isActive: user.isActive },
    newValue: { isActive: !user.isActive },
  });
  revalidatePath("/user-role");
}

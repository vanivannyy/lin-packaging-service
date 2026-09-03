"use server";

import { z } from "zod";
import bcrypt from "bcryptjs";
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { generateCode } from "@/lib/codegen";
import { logAudit } from "@/lib/audit";
import { requireModule } from "@/lib/require-session";
import type { UserRole } from "@prisma/client";

const userSchema = z.object({
  name: z.string().min(2),
  email: z.string().email(),
  department: z.string().optional(),
  position: z.string().optional(),
  role: z.enum(["OWNER", "SALES_MANAGER", "SALES", "FINANCE", "WAREHOUSE", "QC", "PURCHASING", "PRODUCTION_PLANNER"]),
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

"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { generateCode } from "@/lib/codegen";
import { logAudit } from "@/lib/audit";
import { requireModule } from "@/lib/require-session";

const designSchema = z.object({
  name: z.string().min(2, "Nama design minimal 2 karakter"),
  driveUrl: z.string().url("URL Google Drive tidak valid"),
  productId: z.string().optional(),
  note: z.string().optional(),
});

export async function createDesignMasterAction(formData: FormData) {
  const session = await requireModule("design-master");
  const parsed = designSchema.parse({
    name: formData.get("name"),
    driveUrl: formData.get("driveUrl"),
    productId: formData.get("productId") || undefined,
    note: formData.get("note") || undefined,
  });

  const code = await generateCode("designMaster");
  const design = await prisma.designMaster.create({ data: { ...parsed, code } });

  await logAudit({
    userId: session.userId,
    module: "design-master",
    action: "CREATE",
    referenceCode: design.code,
    newValue: parsed,
  });
  revalidatePath("/design-master");
}

export async function updateDesignMasterAction(formData: FormData) {
  const session = await requireModule("design-master");
  const id = formData.get("id") as string;
  const parsed = designSchema.parse({
    name: formData.get("name"),
    driveUrl: formData.get("driveUrl"),
    productId: formData.get("productId") || undefined,
    note: formData.get("note") || undefined,
  });

  const design = await prisma.designMaster.update({
    where: { id },
    data: { ...parsed, productId: parsed.productId ?? null },
  });

  await logAudit({
    userId: session.userId,
    module: "design-master",
    action: "UPDATE",
    referenceCode: design.code,
    newValue: parsed,
  });
  revalidatePath("/design-master");
}

export async function deleteDesignMasterAction(formData: FormData) {
  const session = await requireModule("design-master");
  const id = formData.get("id") as string;
  const design = await prisma.designMaster.update({ where: { id }, data: { isDeleted: true } });

  await logAudit({
    userId: session.userId,
    module: "design-master",
    action: "DELETE",
    referenceCode: design.code,
    newValue: { isDeleted: true },
  });
  revalidatePath("/design-master");
}

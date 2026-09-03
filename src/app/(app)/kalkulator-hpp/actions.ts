"use server";

import { z } from "zod";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { generateCode } from "@/lib/codegen";
import { logAudit } from "@/lib/audit";
import { notifyStatusChange } from "@/lib/notify";
import { requireModule } from "@/lib/require-session";

const schema = z.object({
  customerId: z.string().optional(),
  productNote: z.string().min(1),
  qty: z.coerce.number().int().min(1),
  hppAmount: z.coerce.number().min(0),
  marginPercent: z.coerce.number().min(0).max(500),
  materialSpec: z.string().optional(),
  requestedDeliveryDate: z.string().optional(),
});

export async function createQuotationFromHppAction(formData: FormData) {
  const session = await requireModule("kalkulator-hpp");
  const customerRaw = String(formData.get("customerId") ?? "").trim();
  const parsed = schema.parse({
    customerId: customerRaw || undefined,
    productNote: formData.get("productNote"),
    qty: formData.get("qty"),
    hppAmount: formData.get("hppAmount"),
    marginPercent: formData.get("marginPercent"),
    materialSpec: formData.get("materialSpec") ?? undefined,
    requestedDeliveryDate: formData.get("requestedDeliveryDate") ?? undefined,
  });

  let materialSpec: object | undefined;
  if (parsed.materialSpec) {
    try {
      materialSpec = JSON.parse(parsed.materialSpec);
    } catch {
      materialSpec = undefined;
    }
  }

  const totalAmount = Math.ceil(parsed.hppAmount * (1 + parsed.marginPercent / 100));
  const code = await generateCode("quotation");
  const requestedDeliveryDate = parsed.requestedDeliveryDate ? new Date(parsed.requestedDeliveryDate) : undefined;

  const quotation = await prisma.quotation.create({
    data: {
      code,
      customerId: parsed.customerId || undefined,
      productNote: parsed.productNote,
      qty: parsed.qty,
      hppAmount: parsed.hppAmount,
      marginPercent: parsed.marginPercent,
      totalAmount,
      materialSpec,
      requestedDeliveryDate,
      salesId: session.userId,
      status: "DRAFT",
    },
  });

  await logAudit({
    userId: session.userId,
    module: "quotations",
    action: "CREATE",
    referenceCode: quotation.code,
    newValue: { fromHppCalculator: true, ...parsed },
  });
  await notifyStatusChange({
    excludeUserId: session.userId,
    moduleKeys: ["quotation"],
    module: "quotation",
    type: "ACTION",
    href: `/quotation/${quotation.id}`,
    referenceCode: quotation.code,
    title: "Quotation baru menunggu dikirim",
    message: `${session.name} membuat ${quotation.code} dari Kalkulator HPP. Silakan kirim ke customer.`,
  });

  redirect(`/quotation/${quotation.id}`);
}

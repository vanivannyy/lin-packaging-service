"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { logAudit } from "@/lib/audit";
import { requireModule } from "@/lib/require-session";

// Simulasi pengiriman rekap harian - integrasi email (mis. Resend) dapat dipasang di sini nanti.
export async function sendDailyRecapNowAction() {
  const session = await requireModule("laporan");
  const settings = await prisma.companySettings.findFirst();
  const recipient = settings?.dailyRecapEmail ?? "owner@lin-packaging.com";

  await prisma.dailyRecapLog.create({
    data: { recapDate: new Date(), recipientEmail: recipient, status: "SENT" },
  });

  await logAudit({ userId: session.userId, module: "export", action: "EXPORT", newValue: { event: "DAILY_RECAP_SENT", recipient } });
  revalidatePath("/laporan");
}

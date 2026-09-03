"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requireSession } from "@/lib/require-session";

export async function markNotificationReadAction(notificationId: string) {
  const session = await requireSession();
  await prisma.notification.updateMany({
    where: { id: notificationId, userId: session.userId, isRead: false },
    data: { isRead: true },
  });
  revalidatePath("/", "layout");
}

export async function markAllNotificationsReadAction() {
  const session = await requireSession();
  await prisma.notification.updateMany({
    where: { userId: session.userId, isRead: false },
    data: { isRead: true },
  });
  revalidatePath("/", "layout");
}

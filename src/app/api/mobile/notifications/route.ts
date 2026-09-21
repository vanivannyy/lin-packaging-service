import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireMobileSession } from "@/lib/mobile-auth";

export async function GET(req: Request) {
  const authResult = await requireMobileSession(req);
  if (authResult instanceof Response) return authResult;

  const [items, unreadCount] = await Promise.all([
    prisma.notification.findMany({
      where: { userId: authResult.userId },
      orderBy: { createdAt: "desc" },
      take: 30,
    }),
    prisma.notification.count({ where: { userId: authResult.userId, isRead: false } }),
  ]);

  return Response.json({
    unreadCount,
    items: items.map((n) => ({
      id: n.id,
      title: n.title,
      message: n.message,
      href: n.href,
      module: n.module,
      referenceCode: n.referenceCode,
      type: n.type,
      isRead: n.isRead,
      createdAt: n.createdAt.toISOString(),
    })),
  });
}

const patchSchema = z.object({
  id: z.string().optional(),
  all: z.boolean().optional(),
});

export async function PATCH(req: Request) {
  const authResult = await requireMobileSession(req);
  if (authResult instanceof Response) return authResult;

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return Response.json({ error: "Body harus JSON" }, { status: 400 });
  }

  const parsed = patchSchema.safeParse(body);
  if (!parsed.success) {
    return Response.json({ error: "Data tidak valid" }, { status: 422 });
  }

  if (parsed.data.all) {
    await prisma.notification.updateMany({
      where: { userId: authResult.userId, isRead: false },
      data: { isRead: true },
    });
  } else if (parsed.data.id) {
    await prisma.notification.updateMany({
      where: { id: parsed.data.id, userId: authResult.userId, isRead: false },
      data: { isRead: true },
    });
  } else {
    return Response.json({ error: "id atau all wajib diisi" }, { status: 422 });
  }

  const unreadCount = await prisma.notification.count({
    where: { userId: authResult.userId, isRead: false },
  });

  return Response.json({ success: true, unreadCount });
}

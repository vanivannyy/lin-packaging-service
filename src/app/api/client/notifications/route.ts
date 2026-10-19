import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireClientSession } from "@/lib/client-auth";

export async function GET(req: Request) {
  const session = await requireClientSession(req);
  if (session instanceof Response) return session;

  const [items, unreadCount] = await Promise.all([
    prisma.clientNotification.findMany({
      where: { clientAccountId: session.clientAccountId },
      orderBy: { createdAt: "desc" },
      take: 30,
    }),
    prisma.clientNotification.count({ where: { clientAccountId: session.clientAccountId, isRead: false } }),
  ]);

  return Response.json({
    unreadCount,
    items: items.map((n) => ({
      id: n.id,
      title: n.title,
      message: n.message,
      href: n.href,
      type: n.type,
      referenceCode: n.referenceCode,
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
  const session = await requireClientSession(req);
  if (session instanceof Response) return session;

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
    await prisma.clientNotification.updateMany({
      where: { clientAccountId: session.clientAccountId, isRead: false },
      data: { isRead: true },
    });
  } else if (parsed.data.id) {
    await prisma.clientNotification.updateMany({
      where: { id: parsed.data.id, clientAccountId: session.clientAccountId, isRead: false },
      data: { isRead: true },
    });
  } else {
    return Response.json({ error: "id atau all wajib diisi" }, { status: 422 });
  }

  const unreadCount = await prisma.clientNotification.count({
    where: { clientAccountId: session.clientAccountId, isRead: false },
  });

  return Response.json({ success: true, unreadCount });
}

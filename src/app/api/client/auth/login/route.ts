import { z } from "zod";
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/prisma";
import { signClientToken } from "@/lib/client-auth";
import { logAudit } from "@/lib/audit";

const loginSchema = z.object({
  email: z.string().email("Email tidak valid"),
  password: z.string().min(1, "Password wajib diisi"),
});

export async function POST(req: Request) {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return Response.json({ error: "Body harus JSON" }, { status: 400 });
  }

  const parsed = loginSchema.safeParse(body);
  if (!parsed.success) {
    return Response.json({ error: parsed.error.issues[0]?.message ?? "Data tidak valid" }, { status: 422 });
  }

  const { email, password } = parsed.data;

  const account = await prisma.clientAccount.findUnique({
    where: { email },
    include: { customer: true },
  });
  if (!account || account.isDeleted || !account.isActive) {
    return Response.json({ error: "Email atau password salah" }, { status: 401 });
  }

  const passwordValid = await bcrypt.compare(password, account.passwordHash);
  if (!passwordValid) {
    return Response.json({ error: "Email atau password salah" }, { status: 401 });
  }

  const token = await signClientToken({
    clientAccountId: account.id,
    customerId: account.customerId,
    customerName: account.customer.name,
    name: account.name,
    email: account.email,
  });

  await prisma.clientAccount.update({ where: { id: account.id }, data: { lastLoginAt: new Date() } });
  await logAudit({
    userId: null,
    module: "client-portal",
    action: "STATUS_CHANGE",
    referenceCode: account.customer.code,
    newValue: { event: "LOGIN_CLIENT_APP", clientAccountId: account.id },
  });

  return Response.json({
    token,
    account: {
      id: account.id,
      name: account.name,
      email: account.email,
      customerId: account.customerId,
      customerName: account.customer.name,
    },
  });
}

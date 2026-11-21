import { SignJWT, jwtVerify } from "jose";
import { getClientSecret } from "@/lib/secrets";
import { prisma } from "@/lib/prisma";

const CLIENT_TOKEN_EXPIRY = "30d";
const CLIENT_AUDIENCE = "client-apps";

export type ClientSessionPayload = {
  clientAccountId: string;
  customerId: string;
  customerName: string;
  name: string;
  email: string;
  tv?: number;
};

function getSecretKey() {
  return getClientSecret();
}

export async function signClientToken(payload: ClientSessionPayload): Promise<string> {
  return new SignJWT({ ...payload })
    .setProtectedHeader({ alg: "HS256" })
    .setAudience(CLIENT_AUDIENCE)
    .setIssuedAt()
    .setExpirationTime(CLIENT_TOKEN_EXPIRY)
    .sign(getSecretKey());
}

export async function verifyClientToken(token: string): Promise<ClientSessionPayload | null> {
  try {
    const { payload } = await jwtVerify(token, getSecretKey(), {
      audience: CLIENT_AUDIENCE,
    });
    return payload as unknown as ClientSessionPayload;
  } catch {
    return null;
  }
}

export async function requireClientSession(
  req: Request,
): Promise<ClientSessionPayload | Response> {
  const authHeader = req.headers.get("Authorization");
  if (!authHeader?.startsWith("Bearer ")) {
    return Response.json({ error: "Token diperlukan" }, { status: 401 });
  }

  const token = authHeader.slice(7);
  const session = await verifyClientToken(token);
  if (!session) {
    return Response.json({ error: "Token tidak valid atau sudah kedaluwarsa" }, { status: 401 });
  }

  // Validasi akun klien ke DB (token 30 hari): akun nonaktif/dihapus langsung kehilangan akses.
  const account = await prisma.clientAccount.findUnique({
    where: { id: session.clientAccountId },
    select: { isActive: true, isDeleted: true, customerId: true, tokenVersion: true },
  });
  if (!account || account.isDeleted || !account.isActive) {
    return Response.json({ error: "Akun tidak aktif" }, { status: 401 });
  }
  if ((session.tv ?? 0) !== account.tokenVersion) {
    return Response.json({ error: "Sesi telah dicabut, silakan login ulang" }, { status: 401 });
  }
  return { ...session, customerId: account.customerId };
}

import { SignJWT, jwtVerify } from "jose";
import type { UserRole } from "@prisma/client";
import { getSessionSecret } from "@/lib/secrets";
import { prisma } from "@/lib/prisma";

const MOBILE_TOKEN_EXPIRY = "30d";
const MOBILE_AUDIENCE = "mobile-scanner";

export type MobileSessionPayload = {
  userId: string;
  code: string;
  name: string;
  email: string;
  role: UserRole;
  tv?: number;
};

function getSecretKey() {
  return getSessionSecret();
}

export async function signMobileToken(payload: MobileSessionPayload): Promise<string> {
  return new SignJWT({ ...payload })
    .setProtectedHeader({ alg: "HS256" })
    .setAudience(MOBILE_AUDIENCE)
    .setIssuedAt()
    .setExpirationTime(MOBILE_TOKEN_EXPIRY)
    .sign(getSecretKey());
}

export async function verifyMobileToken(token: string): Promise<MobileSessionPayload | null> {
  try {
    const { payload } = await jwtVerify(token, getSecretKey(), {
      audience: MOBILE_AUDIENCE,
    });
    return payload as unknown as MobileSessionPayload;
  } catch {
    return null;
  }
}

export async function requireMobileSession(
  req: Request,
): Promise<MobileSessionPayload | Response> {
  const authHeader = req.headers.get("Authorization");
  if (!authHeader?.startsWith("Bearer ")) {
    return Response.json({ error: "Token diperlukan" }, { status: 401 });
  }

  const token = authHeader.slice(7);
  const session = await verifyMobileToken(token);
  if (!session) {
    return Response.json({ error: "Token tidak valid atau sudah kedaluwarsa" }, { status: 401 });
  }

  // Token berumur 30 hari: validasi ke DB agar user yang dinonaktifkan/dihapus langsung kehilangan akses,
  // dan role yang berubah memakai role terbaru (bukan role saat login).
  const user = await prisma.user.findUnique({
    where: { id: session.userId },
    select: { isActive: true, isDeleted: true, role: true, tokenVersion: true },
  });
  if (!user || user.isDeleted || !user.isActive) {
    return Response.json({ error: "Akun tidak aktif" }, { status: 401 });
  }
  if ((session.tv ?? 0) !== user.tokenVersion) {
    return Response.json({ error: "Sesi telah dicabut, silakan login ulang" }, { status: 401 });
  }
  return { ...session, role: user.role };
}

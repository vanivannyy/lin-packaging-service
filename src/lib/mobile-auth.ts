import { SignJWT, jwtVerify } from "jose";
import type { UserRole } from "@prisma/client";

const MOBILE_TOKEN_EXPIRY = "30d";
const MOBILE_AUDIENCE = "mobile-scanner";

export type MobileSessionPayload = {
  userId: string;
  code: string;
  name: string;
  email: string;
  role: UserRole;
};

function getSecretKey() {
  const secret = process.env.SESSION_SECRET ?? "dev-only-insecure-secret";
  return new TextEncoder().encode(secret);
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

  return session;
}

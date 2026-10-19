import { SignJWT, jwtVerify } from "jose";

const CLIENT_TOKEN_EXPIRY = "30d";
const CLIENT_AUDIENCE = "client-apps";

export type ClientSessionPayload = {
  clientAccountId: string;
  customerId: string;
  customerName: string;
  name: string;
  email: string;
};

function getSecretKey() {
  // Secret dipisah dari SESSION_SECRET staff internal (lihat mobile-auth.ts) supaya
  // token akun klien & token staff tidak bisa saling dipakai walau nama variabel beda.
  const secret = process.env.CLIENT_SESSION_SECRET ?? process.env.SESSION_SECRET ?? "dev-only-insecure-secret";
  return new TextEncoder().encode(secret);
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

  return session;
}

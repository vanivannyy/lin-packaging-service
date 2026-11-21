// Secret JWT wajib diisi lewat environment (tanpa fallback hardcoded).
// Nilai dibaca saat dipakai (bukan saat import) agar `next build` tidak gagal tanpa env.
const MIN_SECRET_LENGTH = 16;

function readSecret(name: string): string | undefined {
  const value = process.env[name]?.trim();
  return value ? value : undefined;
}

function assertSecret(name: string, value: string | undefined): string {
  if (!value) {
    throw new Error(`Environment variable ${name} wajib diisi.`);
  }
  if (value.length < MIN_SECRET_LENGTH || value === "REPLACE_ME") {
    throw new Error(`${name} terlalu lemah: gunakan string acak minimal ${MIN_SECRET_LENGTH} karakter.`);
  }
  return value;
}

/** Secret sesi staff web & mobile. */
export function getSessionSecret(): Uint8Array {
  return new TextEncoder().encode(assertSecret("SESSION_SECRET", readSecret("SESSION_SECRET")));
}

/** Secret token klien. Wajib terpisah dari SESSION_SECRET agar token staff & klien tidak saling berlaku. */
export function getClientSecret(): Uint8Array {
  const client = assertSecret("CLIENT_SESSION_SECRET", readSecret("CLIENT_SESSION_SECRET"));
  if (client === readSecret("SESSION_SECRET")) {
    throw new Error("CLIENT_SESSION_SECRET harus berbeda dari SESSION_SECRET.");
  }
  return new TextEncoder().encode(client);
}

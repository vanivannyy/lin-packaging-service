// Setup tes integrasi: arahkan Prisma ke database TEST dan tolak database non-lokal.
const url = process.env.TEST_DATABASE_URL;
if (!url) {
  throw new Error("TEST_DATABASE_URL wajib diisi untuk tes integrasi (database Postgres lokal/CI).");
}
const host = new URL(url).hostname;
if (!["localhost", "127.0.0.1", "postgres"].includes(host)) {
  throw new Error(`Tes integrasi menolak host "${host}": hanya database lokal/CI yang diizinkan.`);
}
process.env.DATABASE_URL = url;
process.env.DIRECT_DATABASE_URL = url;
process.env.SESSION_SECRET = "integration-test-session-secret-0123456789";
process.env.CLIENT_SESSION_SECRET = "integration-test-client-secret-9876543210";

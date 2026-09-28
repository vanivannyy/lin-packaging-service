// ============================================================
// PRODUCTION SEED
// Branch `main` = production: TIDAK ADA dummy data.
// Hanya membuat CompanySettings (profil perusahaan asli) dan
// 1 akun Owner untuk login pertama kali.
//
// Data dummy lengkap (users, customer, leads, quotation, dst)
// ada di branch `uat`, file prisma/seed.ts versi uat.
// ============================================================
import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();

function code(prefix: string, seq: number) {
  return `${prefix}-2026-${seq.toString().padStart(5, "0")}`;
}

async function main() {
  console.log("Seeding company settings (production)...");
  const existingSettings = await prisma.companySettings.findFirst();
  if (!existingSettings) {
    await prisma.companySettings.create({
      data: {
        companyName: "PT Lin Packaging Jakarta",
        address:
          "Jl. Kepu Barat no.26-K, RT.1/RW.2, Kemayoran, Jakarta Pusat, DKI Jakarta, 10620",
        phone: "08111-777-855",
        email: "info@lin-packaging.com",
        website: "lin-packaging.com",
        taxId: "01.234.567.8-091.000",
        bankName: "Bank Central Asia",
        bankAccountNo: "123-456-7890",
        bankAccountName: "PT Lin Packaging Jakarta",
        dailyRecapEmail: "delivered@resend.dev",
      },
    });
  } else {
    console.log("CompanySettings sudah ada, skip.");
  }

  console.log("Seeding owner account (production)...");
  const ownerEmail = process.env.SEED_OWNER_EMAIL ?? "owner@lin-packaging.com";
  const ownerName = process.env.SEED_OWNER_NAME ?? "Owner";
  const ownerPassword = process.env.SEED_OWNER_PASSWORD;

  if (!ownerPassword) {
    throw new Error(
      "SEED_OWNER_PASSWORD wajib diisi di .env sebelum menjalankan seed production (jangan hardcode password di kode)."
    );
  }

  const existingOwner = await prisma.user.findUnique({ where: { email: ownerEmail } });
  if (existingOwner) {
    console.log(`User owner (${ownerEmail}) sudah ada, skip.`);
  } else {
    const passwordHash = await bcrypt.hash(ownerPassword, 10);
    await prisma.user.create({
      data: {
        code: code("USR", 1),
        name: ownerName,
        email: ownerEmail,
        passwordHash,
        department: "Direksi",
        position: "Owner",
        role: "OWNER",
        lastLoginAt: null,
      },
    });
  }

  console.log("Seed production selesai. Tidak ada data dummy yang dibuat.");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });

# 00 — Repository Inventory

Status: Discovery fase 1 (2026-11-18). Label: **[V]** Verified, **[I]** Inferred, **[R]** Requires Confirmation.

## Tech Stack
| Aspek | Temuan | Sumber | Label |
|---|---|---|---|
| Framework | Next.js 14.2.35, React ^18 | `package.json` | V |
| Router | **App Router** saja (`src/app`, tidak ada `pages/`) | struktur `src/app` | V |
| Bahasa | TypeScript 5 (`"strict": true`) | `tsconfig.json` | V |
| Package manager | npm (`package-lock.json`) | root | V |
| UI | Tailwind CSS 3.4, lucide-react, recharts; komponen custom di `src/components/ui` | `package.json` | V |
| State management | Tidak ada library (tidak ada redux/zustand/react-query); Server Components + Server Actions + `revalidatePath` | `package.json`, `src/app/**/actions.ts` | V |
| Auth | Custom JWT HS256 via `jose`, cookie `lpc_session`; password `bcryptjs`. Bukan NextAuth | `src/lib/session.ts`, `src/app/login/actions.ts` | V |
| Database | PostgreSQL (provider `postgresql`), hosting Neon (pooled + direct URL) | `prisma/schema.prisma`, `.env.example` | V (Neon: dari komentar .env.example) |
| ORM | **Prisma ^6.19.3** (`@prisma/client`), singleton di `src/lib/prisma.ts` | `package.json` | V |
| Validasi | Zod ^4 (26 file memakai `z.object`) — tidak konsisten di semua action | `src/**` | V |
| Integrasi / library | `exceljs` (export Excel), `bwip-js` (barcode), `date-fns` | `package.json`, `src/app/api/export`, `src/app/api/barcode` | V |
| Email | **Tidak ada** integrasi nyata; daily recap hanya menulis `DailyRecapLog` | `src/app/(app)/laporan/actions.ts` | V |
| Testing | Tidak ditemukan file test / test runner | pencarian `*.test.*`, `package.json` | V |
| CI/CD & deploy | Tidak ada `.github`, `Dockerfile`, `vercel.json`. Komentar `.env.example` menyebut Vercel | root | V / R |
| Seed | `tsx prisma/seed.ts` | `package.json` | V |

## Environment Variables (nama saja)
`DATABASE_URL`, `DIRECT_DATABASE_URL`, `SESSION_SECRET` (`.env.example`); `CLIENT_SESSION_SECRET` (opsional, dipakai di `src/lib/client-auth.ts`). `.env` ada di `.gitignore`.

## Struktur Repository (tracked files ±135, tanpa lockfile)
- `prisma/` — `schema.prisma` (844 baris), 12 migrasi, `seed.ts`
- `src/app/(app)/` — 20 modul bisnis (page + `actions.ts`) di bawah layout terproteksi
- `src/app/api/` — `mobile/*`, `client/*`, `export/*`, `barcode/[sku]`
- `src/app/login`, `src/app/invoice/[id]`, `src/app/laporan/print`, `src/app/material-stok/barcode/[id]` — halaman di luar layout `(app)`
- `src/lib/` — auth, roles, nav, audit, notify, codegen, hpp-engine (924 baris), stok
- `src/server/` — `dashboard.ts`, `laporan.ts` (query agregasi)
- `src/middleware.ts` — gate autentikasi + RBAC path
- `public/uploads/` — target upload (hanya `.gitkeep`)

## Dokumentasi Existing (hint, bukan bukti)
`README.md` (daftar modul, 8 role) — sebagian **tidak sinkron**: README menyebut 8 role, kode punya 9 (`DESIGN`); README menyebut `.cursorrules` yang tidak ada di repo.

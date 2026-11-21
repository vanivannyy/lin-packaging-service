# 01 — System Architecture

## Pola Umum [V]
Monolit Next.js 14 App Router (full-stack) dengan Prisma → PostgreSQL. Tidak ada service/repository layer terpisah; **Server Action langsung memanggil `prisma`** (`src/app/(app)/*/actions.ts`). Helper bisnis ada di `src/lib/*`, agregasi baca di `src/server/*`.

## Lapisan
| Lapisan | Lokasi | Catatan |
|---|---|---|
| Edge gate | `src/middleware.ts` | Verifikasi JWT cookie, cek `canAccessPath`. Public: `/login`, `/api/mobile`, `/api/client` |
| UI (RSC + client components) | `src/app/(app)/**/page.tsx`, `src/components` | Kanban: `crm/LeadKanbanBoard`, `produksi/KanbanBoard`, `delivery/DeliveryKanbanBoard` |
| Mutasi | Server Actions (`"use server"`, 21 file) | Pola: `requireModule` → (zod) → prisma → `logAudit` → `notifyStatusChange` → `revalidatePath` |
| REST API | `src/app/api/**/route.ts` (26 handler) | 3 audiens: web (export/barcode), mobile staff (Bearer), client portal (Bearer) |
| Domain helper | `src/lib/` | `hpp-engine.ts` (kalkulasi HPP), `codegen.ts`, `material-stock.ts`, `client-stock.ts`, `purchase-auto.ts`, `delivery.ts`, `notify.ts`, `audit.ts` |
| Data | `src/lib/prisma.ts`, `prisma/schema.prisma` | Singleton PrismaClient |

## Tiga Jalur Autentikasi [V]
1. Web staff: cookie `lpc_session` (8 jam) — `src/lib/session.ts`
2. Mobile staff: Bearer JWT, audience `mobile-scanner`, 30 hari — `src/lib/mobile-auth.ts`
3. Client portal: Bearer JWT, audience `client-apps`, 30 hari — `src/lib/client-auth.ts`
Detail: lihat `05-auth-and-permissions.md`.

## Cross-cutting
- Audit: `logAudit()` ke `AuditTrail` (69 pemanggilan) — `src/lib/audit.ts`
- Notifikasi in-app: `notifyStatusChange()` → tabel `Notification` per role/user — `src/lib/notify.ts`
- Penomoran dokumen: `generateCode()` format `PREFIX-YYYY-00001` — `src/lib/codegen.ts`
- Export: Excel via `exceljs` di `api/export/*`; PDF = halaman print browser (`invoice/[id]`, `laporan/print`, `quotation/[id]` PrintActions) [V untuk Excel; PDF "print-to-PDF" dari README + file print]
- Upload file: `src/lib/upload.ts` → `public/uploads` (filesystem lokal) [V]

## Background Job [V: tidak ada]
Tidak ada cron/queue/worker. `DailyRecapLog` hanya ditulis manual via `sendDailyRecapNowAction` (simulasi, komentar kode menyatakan email belum terintegrasi).

## Catatan Risiko Arsitektur (temuan, bukan rekomendasi final)
- Upload ke `public/uploads` tidak cocok untuk serverless/Vercel (filesystem ephemeral) [I].
- Fallback secret `"dev-only-insecure-secret"` di 3 file auth bila env tidak diisi [V].

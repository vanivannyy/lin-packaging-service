# Technical Requirements Document (TRD) — LIN Packaging Service

Status: Draft 1 (2026-11-20). Dasar: `docs/reverse-engineering/analysis/00–07`.
Label: **[V]** Verified (kode dibaca), **[I]** Inferred, **[R]** Requires Confirmation.
Dokumen ini mendeskripsikan sistem **as-is** (termasuk perubahan 18–20 Nov 2026) dan menandai gap sebagai requirement teknis. Bukan bukti niat bisnis.

---

## 1. Ringkasan Sistem
ERP untuk bisnis percetakan/packaging: CRM → Quotation (Kalkulator HPP) → Sales Order → Work Order (produksi/QC/packing) → Delivery → Invoice/Payment, plus inventori material, purchasing, portal stok klien, dan API mobile staff. [V]

## 2. Tech Stack [V]
| Aspek | Keputusan |
|---|---|
| Runtime/Framework | Next.js 14.2.35 App Router, React 18, TypeScript strict |
| Database | PostgreSQL (Neon pooled + direct URL) |
| ORM | Prisma 6.19 (`prisma-client-js`) |
| Auth | JWT HS256 (`jose`), `bcryptjs` |
| Validasi | Zod 4 (tidak konsisten di semua handler) |
| UI | Tailwind 3.4, lucide-react, recharts |
| Export | `exceljs`, print-to-PDF via halaman print, `bwip-js` barcode |
| Package manager | npm |
Tidak ada: state library, test runner, CI/CD, Docker, queue/cron. [V]

## 3. Arsitektur
Monolit full-stack. Server Action memanggil Prisma langsung (tanpa repository layer); logika domain bersama di `src/lib`; query agregasi di `src/server`. Detail: `analysis/01-system-architecture.md`.

Pola mutasi standar: `requireModule` → validasi (Zod, sebagian) → Prisma → `logAudit` → `notifyStatusChange` → `revalidatePath`. [V]

### 3.1 Tiga Audiens Akses
| Audiens | Mekanisme | Token |
|---|---|---|
| Web staff | Cookie `lpc_session`, middleware + `requireModule` | JWT 8 jam |
| Mobile staff | `Authorization: Bearer`, `requireMobileSession` | JWT aud `mobile-scanner`, 30 hari |
| Client portal | Bearer, `requireClientSession` | JWT aud `client-apps`, 30 hari |

## 4. Functional Technical Requirements (as-is)

### TR-AUTH — Autentikasi & Otorisasi
- TR-AUTH-1: Login menolak user `isDeleted`/`!isActive`; audit LOGIN/LOGOUT. [V]
- TR-AUTH-2: RBAC modul-level via `ROLE_MODULES` (`src/lib/roles.ts`); 9 role; OWNER = `*`. Dicek di middleware, `requireModule`, `denyIfNoModule`, `canAccessModule` (mobile). [V]
- TR-AUTH-3: `QC_ROLES` = OWNER, GM, QC; Pengecekan role eksplisit: approve/reject Quotation (OWNER, GM); edit/hapus Material & update Produk (OWNER); OWNER tidak boleh diturunkan role; **keputusan & checklist QC hanya OWNER, GM & QC** (`canPerformQc`, web + mobile) [V, baru].
- TR-AUTH-4: Tidak ada permission granular per aksi, MFA, lockout, rate limit, password policy. [V]

### TR-CRM / TR-CUS — Lead & Customer
CRUD Lead (kanban stage NEW→…→WON/LOST), convert ke Customer; CRUD Customer. [V ada, I aturan]

### TR-QUO — Quotation & Kalkulator HPP
- Kalkulator HPP: fungsi murni `hitungHppProduksi` (`src/lib/hpp-engine.ts`) menghitung kertas, pond, laminating, foil, pelat, tinta, cetak digital, layout potong optimal. Konstanta harga ada di kode; kaitan ke `PriceMasterItem` hanya sebagai override opsional dari form. [V; rumus rinci R]
- Quotation: DRAFT→SENT→ACCEPTED/REJECTED (`QUOTATION_TRANSITIONS`; EXPIRED tidak dipakai). Accept/Reject hanya OWNER/GM. Transisi lain ditolak. [V]
- `Quotation.materialSpec` (JSON) menyimpan snapshot spesifikasi, kini termasuk `materialId` dan `jumlahPlano` (opsional) [V, baru].
- Convert ke Sales Order: syarat ACCEPTED, 1 SO per quotation; membuat SO `MATERIAL_CHECK` + Work Order `WAITING/PREPRESS` (deadline +7 hari hardcoded). SO + WO dibuat dalam satu transaksi. [V]

### TR-SO — Sales Order
- Status: MATERIAL_CHECK→PRODUCTION→READY_DELIVERY→DELIVERED; CANCELLED dari tiga status pertama; DELIVERED/CANCELLED final (`SALES_ORDER_TRANSITIONS`, enum divalidasi). Transisi otomatis sistem (packing selesai, Delivery DELIVERED) tidak melalui peta ini. [V]
- DELIVERED membuat Invoice (lihat TR-INV). CANCELLED melepas reservasi material. [V]

### TR-PROD — Produksi (Work Order)
- Stage: WAITING, READY, IN_PRODUCTION, QC, PACKING, REWORK, DONE; proses 10 nilai. [V]
- Masuk IN_PRODUCTION mensyaratkan prepress siap (`assertPrepressReady`; design diupload, tidak dalam revisi). [V]
- Step detail per proses dengan `WorkOrderStepProgress`; PREPRESS tidak bisa DONE tanpa design. [V]
- Production log mencatat `goodQty`, `rejectQty`, downtime; akumulasi di `WorkOrder.goodQtyTotal/rejectQtyTotal`. [V]
- QC: `qcResultAction` hanya saat stage QC; lulus → `qcPassed=true`; gagal → REWORK (progress 70, `rejectRatePercent`). [V]
- PACKING hanya dari QC dengan `qcPassed===true` (`moveToPackingAction`). [V]
- **DONE hanya via `completePackingAction`** dari stage PACKING; drag ke DONE ditolak (error) [V, baru].
- Selesai packing → `ensureDeliveryOrderForSalesOrder` (SO → READY_DELIVERY, buat DO `READY`, `recordProductionIn`). [V]

### TR-MAT — Material, Stok, Reservasi
- Stok tersedia = `stockQty − reservedQty`. Perubahan stok via `adjustMaterialStock` (transaksi update + `StockMovement`). [V]
- **BOM multi-material per SO** (`SalesOrderMaterial`, `src/lib/material-reservation.ts`) [V, baru 2026-11-20]:
  - Sumber BOM: Kalkulator HPP (`materialSpec.bom` = daftar `{materialId, qty}`; saran qty otomatis kertas = `planoProduksi`, tinta = `konsumsiTintaKg` untuk offset; laminating/foil/lainnya diisi manual) dan penambahan/penghapusan manual di halaman detail SO selama status `MATERIAL_CHECK`. Format lama (`materialId`+`jumlahPlano`) tetap dibaca.
  - `reserve` (`addBomLine`): saat convert Quotation→SO; `reservedQty` material bertambah; baris dengan material sama yang masih RESERVED digabung. Boleh melebihi stok (memicu Auto PR).
  - `consume`: saat WO masuk IN_PRODUCTION; per baris RESERVED→CONSUMED, `stockQty` & `reservedQty` berkurang, `StockMovement PRODUCTION_OUT` (ref kode SO).
  - `release`: SO CANCELLED atau baris dihapus; RESERVED→RELEASED, stok fisik tidak berubah.
  - Idempotensi/konkurensi: transisi status memakai `updateMany` bersyarat `status=RESERVED` dalam transaksi, sehingga klik ganda tidak menggandakan pengurangan.
  - Batasan: pemetaan komponen HPP→Material belum otomatis (kecuali saran qty di atas); tidak ada versi/alternatif material; konsumsi penuh saat produksi dimulai (tanpa konsumsi parsial/retur otomatis).
- Soft delete material menolak otomatis PR PENDING terkait dalam transaksi. [V]

### TR-PUR — Purchasing
- PR: PENDING→APPROVED/REJECTED→RECEIVED. Receive (syarat APPROVED) dalam `$transaction`: update PR, `stockQty += qty`, `StockMovement PURCHASE_IN`. Approve/reject tanpa cek status asal dan tanpa pemisahan requester/approver. [V]
- **Auto PR** (`autoCreatePurchaseRequestIfNeeded`): dibuat bila `minStockQty>0`, available ≤ min, belum ada PR PENDING/APPROVED; target qty = `max(2×min − available, min)`; requester = user aktif PURCHASING/OWNER pertama. Dipicu hanya saat stok/material berubah (adjust, buat/edit material, reserve, consume) — **tidak lagi saat render halaman** [V, baru].

### TR-DEL — Delivery
DO stage READY/IN_DELIVERY/PENDING/DELIVERED; PENDING wajib catatan; DELIVERED final. Saat DELIVERED: SO → DELIVERED (`deliveredAt`), **Invoice dibuat via `ensureInvoiceForSalesOrder`** (baru), `recordDeliveryOut`. [V]

### TR-INV — Invoice & Payment
- `ensureInvoiceForSalesOrder` (`src/lib/invoice.ts`) idempoten; dipanggil dari SO "Kirim" dan Delivery DELIVERED; due date +30 hari hardcoded (tidak memakai `CustomerTerm`). [V]
- Pembayaran: satu transaksi dengan optimistic lock pada `paidAmount`; PAID bila akumulasi ≥ total, selain itu PARTIAL; menolak overpayment dan invoice yang sudah lunas. [V]
- OVERDUE dibaca oleh dashboard, tetapi mekanisme yang menetapkannya tidak ditemukan. [R]

### TR-CLI — Stok Klien & Portal
- Item barang jadi per customer; `recordProductionIn` / `recordDeliveryOut` menambah/mengurangi `linWarehouseQty` memakai **qty good** `WorkOrder.goodQtyTotal`, fallback qty SO bila 0 [V, baru]. `decrement` tanpa guard stok negatif. Update item dan movement tanpa transaksi.
- API klien: login, dashboard, items, report-stock, notifications; ter-scope `customerId` token (items [V], lainnya I). [V/I]

### TR-AUD / TR-NOT — Audit & Notifikasi
- `AuditTrail` (module string bebas, action enum 10 nilai, old/new JSON) via `logAudit` manual (±70 pemanggilan); halaman audit read-only untuk OWNER. [V]
- Notifikasi in-app per role/user via `notifyStatusChange`; tipe STATUS/APPROVAL/ACTION. [V]

### TR-RPT — Laporan & Export
Dashboard (`server/dashboard.ts`), laporan per customer/produk/sales (`server/laporan.ts`), export Excel (5 route), halaman print. Daily recap hanya simulasi (`DailyRecapLog`, tanpa email). [V]

## 5. Data Requirements
Skema: 30 model, 19 enum, 15 migrasi (termasuk `20261120100000_sales_order_material_reservation` dan `20261120150000_sales_order_material_bom`, kedua migrasi sudah diaplikasikan ke database Neon (`migrate deploy`, 2026-11-20; status "up to date")). Detail: `analysis/03-database-schema.md`.

- PK `cuid()`; kode bisnis `PREFIX-YYYY-00001` dari `generateCode` (prefix di `CompanySettings`, nomor dari tabel `DocumentCounter` atomik).
- Soft delete via `isDeleted`; tidak ada Prisma `.delete()` di `src`. Payment `onDelete: Cascade` ke Invoice.
- Tidak ada konsep organisasi/cabang/tenant; kepemilikan data hanya `salesId`.
- Tidak ada view/function/trigger SQL.
- Transaksi eksplisit: 9 titik + 3 helper reservasi baru. Alur multi-langkah lain (convert quotation, ubah status SO, client stock) tidak transaksional.

## 6. Interface Requirements
26+ route handler: web export/barcode (cookie), mobile staff (13 file), client portal (6 file). Detail dan guard: `analysis/04-api-contracts.md`. Tanpa OpenAPI, versioning, atau rate limiting. Aplikasi mobile/klien konsumen API tidak ada di repo. [V]

## 7. Non-Functional Requirements (kondisi saat ini)
| Area | Temuan | Label |
|---|---|---|
| Keamanan sesi | Cookie httpOnly, sameSite lax, secure di production; secret wajib dari env (`lib/secrets.ts`), tanpa fallback | V |
| Revokasi | **Selesai 2026-11-21**: `User.tokenVersion` & `ClientAccount.tokenVersion` (claim `tv` di JWT). Naik otomatis saat ganti password/role, nonaktif/aktif, dan lewat tombol "Cabut Sesi" (user-role). Token dengan `tv` berbeda ditolak (web, mobile, klien). Pencabutan per perangkat tidak didukung | V |
| Auditabilitas | Audit manual per aksi; module string tidak seragam | V |
| Konkurensi | Penomoran (`DocumentCounter`), pembayaran (optimistic lock), reservasi/konsumsi BOM atomik | V |
| Upload | Dihapus; design prepress = link OneDrive (`WorkOrder.prepressDesignUrl`) | V |
| Observabilitas | Hanya `console.error`; tidak ada logging/monitoring terstruktur | V |
| Pengujian | Vitest (`npm test`): 17 unit test fungsi murni (transisi status, design link, role, BOM, secrets, term). Belum ada tes integrasi/e2e | V |
| Deploy | Target Vercel + Neon (konfirmasi stakeholder); tidak ada konfigurasi deploy di repo | V |

## 8. Gap & Technical Debt (urut prioritas usulan)
| ID | Gap | Dampak | Sumber |
|---|---|---|---|
| TR-GAP-1 | ~~Fallback secret hardcoded~~ — **teratasi** 2026-11-20 (`lib/secrets.ts`: wajib ada, min 16 karakter, `CLIENT_SESSION_SECRET` wajib dan harus beda) | — | `lib/secrets.ts` |
| TR-GAP-2 | **Teratasi penuh** 2026-11-21: validasi DB tiap request + revokasi via `tokenVersion` (migrasi `20261121100000_token_version`). Pencabutan per perangkat belum ada | — | `lib/session.ts`, `lib/mobile-auth.ts`, `lib/client-auth.ts`, `lib/require-session.ts`, `user-role/actions.ts` |
| TR-GAP-3 | ~~`generateCode` race~~ — **teratasi** 2026-11-20: tabel `DocumentCounter` + `UPDATE … RETURNING` atomik (diuji 20 request paralel → 20 nomor unik) | — | `lib/codegen.ts` |
| TR-GAP-4 | ~~Transisi tanpa validasi~~ — **teratasi** 2026-11-20 untuk SO & Quotation (`lib/status-transitions.ts`, enum divalidasi); PR sudah dibatasi ke PENDING | — | `lib/status-transitions.ts` |
| TR-GAP-5 | ~~Approve PR tidak dibatasi~~ — **teratasi** 2026-11-20 (PR lama berstatus PENDING tetap perlu approval GM/OWNER) | Kontrol internal lemah | `purchase-request/actions.ts` |
| TR-GAP-6 | ~~Payment tidak atomic~~ — **teratasi** 2026-11-20: transaksi + optimistic lock `paidAmount`, overpayment & invoice lunas ditolak | — | `invoice/actions.ts` |
| TR-GAP-7 | **Selesai (2026-11-20)**: convert quotation, SO status+invoice, delivery DELIVERED+invoice (web & mobile), client stock movement kini transaksional | — | `quotation/actions.ts`, `sales-order/actions.ts`, `delivery/actions.ts`, `lib/client-stock.ts` |
| TR-GAP-8 | ~~Konkurensi reservasi & 1 material~~ — **teratasi** 2026-11-20 (BOM multi-baris, transisi atomik) | — | `lib/material-reservation.ts` |
| TR-GAP-9 | ~~Due date hardcoded~~ — **teratasi** 2026-11-20 | — | `lib/invoice.ts` |
| TR-GAP-10 | ~~Dashboard OVERDUE kosong~~ — **teratasi** 2026-11-20: dashboard menghitung dari `dueDate < now` dan status ≠ PAID (tanpa job) | — | `server/dashboard.ts` |
| TR-GAP-11 | **Sebagian selesai**: vitest 17 unit test + 8 tes integrasi (`npm run test:integration`, `src/lib/business-flows.int.test.ts`: kode paralel, invoice idempoten & term, BOM reserve/consume/release, stok klien tidak negatif, revokasi token, pembayaran parsial/lunas/overpayment/balapan) dengan Postgres lokal/CI (`TEST_DATABASE_URL`, hanya host lokal); CI menjalankannya. Logika pembayaran kini di `src/lib/payment.ts` (`recordInvoicePayment`). Belum diuji: lapisan server action (cookie/redirect), end-to-end UI | Risiko regresi di action/UI | `vitest.integration.config.ts`, `.github/workflows/ci.yml` |
| TR-GAP-12 | **Selesai (2026-11-21)**: seluruh `actions.ts` memakai Zod atau `formId`/`formEnum`; cast enum sudah divalidasi `z.enum`; qty BOM manual dan catatan revisi divalidasi | — | `lib/form.ts`, berbagai `actions.ts` |
| TR-GAP-13 | **Selesai**: tombol/checklist QC disembunyikan untuk role tanpa `canPerformQc` (server tetap menolak) | — | `produksi/page.tsx`, `KanbanBoard.tsx`, `WorkOrderDetailModal.tsx` |
| TR-GAP-14 | **Selesai**: tombol manual "Cek stok minimum" (`scanLowStockAction`) memindai material yang sudah di bawah minimum | — | `purchase-request/actions.ts`, `page.tsx` |
| TR-GAP-15 | Selesai: structured logger `lib/logger.ts`; CI GitHub Actions `.github/workflows/ci.yml` (prisma validate, tsc, lint, test); FK schema diselaraskan dengan DB (ClientNotification Cascade, Quotation.customer Restrict, tanpa migrasi DB) | — | `lib/logger.ts`, `ci.yml`, `schema.prisma` |

## 9. Keputusan Stakeholder (2026-11-20) dan Requirement Turunan
Status kolom "Kode": **Belum** = belum diimplementasikan (as-is berbeda); **Sesuai** = kode sudah sejalan.

| # | Keputusan | Requirement turunan | Kode |
|---|---|---|---|
| 1 | GM boleh melakukan QC | TR-AUTH-3: `QC_ROLES` = OWNER, GENERAL_MANAGER, QC (web + mobile). Perlu menambahkan GM ke `canPerformQc` | Sesuai (diimplementasikan 2026-11-20) |
| 2 | Approve PR oleh GM dan OWNER. GM/OWNER boleh membuat PR; PR yang dibuat GM/OWNER **tanpa approval** | TR-PUR-A1: approve/reject hanya GM/OWNER. TR-PUR-A2: PR dibuat GM/OWNER langsung berstatus APPROVED (`approvedById` = pembuat). TR-PUR-A3: approve/reject hanya dari PENDING. Auto PR (requester sistem) tetap PENDING dan butuh approval. Role lain (WAREHOUSE, PURCHASING) membuat PR berstatus PENDING | Sesuai (diimplementasikan 2026-11-20: `canApprovePurchaseRequest`; PR GM/OWNER langsung APPROVED; approve/reject hanya dari PENDING; UI menyembunyikan tombol untuk role lain) |
| 3 | Due date invoice mengikuti `CustomerTerm`, bisa disesuaikan | TR-INV-D1: due date default = tanggal invoice + hari term customer (CBD=0, NET_15/30/45/60). TR-INV-D2: due date dapat diubah (siapa yang boleh: usulan role modul invoice, dengan audit old/new). Terkait TR-GAP-9 | Sesuai (diimplementasikan 2026-11-20: `termToDays` di `lib/invoice.ts`; `updateInvoiceDueDateAction` + modal "Jatuh Tempo" untuk role modul invoice, audit old/new) |
| 4 | Tidak perlu EXPIRED quotation dan OVERDUE invoice terjadwal | Tidak ada job terjadwal. Enum `EXPIRED`/`OVERDUE` tetap ada tetapi tidak dipakai otomatis. Dashboard yang membaca `OVERDUE` perlu dikaji (TR-GAP-10 diturunkan jadi cleanup) | Sesuai (tidak ada job); dashboard OVERDUE [R] |
| 5 | Reservasi memerlukan BOM multi-material (tinta, laminating, foil, dst.) | TR-MAT-B1: kebutuhan material per SO berupa daftar baris (material, qty, satuan) bukan satu material. TR-MAT-B2: reserve/consume/release per baris. TR-MAT-B3: sumber qty dari Kalkulator HPP (kertas = `planoProduksi`; tinta/laminating/foil dihitung engine) dan dapat diedit manual. Memerlukan model baru (mis. `SalesOrderMaterial`) dan pemetaan komponen HPP ke `Material`. Menggantikan field tunggal `SalesOrder.materialId/materialReservedQty` | Sesuai (diimplementasikan 2026-11-20; qty tinta/kertas disarankan otomatis, lainnya manual) |
| 6 | Deployment: Vercel + Neon | TR-DEP-1: tidak ada upload file; design prepress disimpan sebagai **link OneDrive/SharePoint** (`src/lib/design-link.ts`: wajib https, host 1drv.ms/onedrive.live.com/onedrive.com/sharepoint.com), sehingga filesystem Vercel yang ephemeral tidak jadi masalah. TR-DEP-2: `DATABASE_URL` pooled untuk runtime, `DIRECT_DATABASE_URL` untuk migrasi (sudah). TR-DEP-3: `SESSION_SECRET` & `CLIENT_SESSION_SECRET` wajib di env Vercel; hapus fallback hardcoded. TR-DEP-4: migrasi dijalankan lewat `prisma migrate deploy` di langkah deploy | Sesuai (upload file dihapus, diganti link) |
| 7 | Konstanta harga `hpp-engine.ts` berhubungan dengan `PriceMasterItem` | TR-QUO-P1: konstanta di engine adalah **default/fallback**; nilai di Price Master mengoverride (kertas, laminating, foil, digital sudah ada override dari form). Perlu audit konstanta mana yang belum bisa dioverride (pond, pelat, tinta, per-GSM) dan dipetakan ke kategori `PriceMasterCategory` | Parsial [V: override via form; R: cakupan] |
| 8 | Rumus HPP adalah rumus internal perusahaan | Rumus di `hpp-engine.ts` diperlakukan sebagai sumber kebenaran domain. Perlu dokumentasi rumus (reverse engineering terpisah) dan test unit untuk fungsi murni sebelum refactor | Sesuai (kode = spesifikasi); dokumentasi belum ada |

Pertanyaan yang masih terbuka: pembatasan role pengubah due date invoice (saat ini semua role modul invoice: OWNER, GM, FINANCE) (#3); apakah baris BOM bisa memakai lebih dari satu supplier/alternatif material (#5); apakah dashboard harus menyembunyikan indikator `OVERDUE` (#4).

## 10. Evidence Limitations
Tidak ada akses database hidup; kolom migrasi vs schema tidak dibandingkan (jumlah tabel cocok: 28). Perubahan 18–20 Nov hanya diverifikasi dengan `tsc` dan `next lint`, tanpa tes runtime. Rumus HPP, isi export Excel, rumus dashboard, dan handler REST tertentu belum dianalisis penuh.

## 11. Referensi
`analysis/00-repository-inventory.md` … `07-evidence-index.md`. Source utama: `prisma/schema.prisma`, `src/middleware.ts`, `src/lib/{roles,session,mobile-auth,client-auth,codegen,invoice,material-reservation,purchase-auto,client-stock,delivery,hpp-engine}.ts`, `src/app/(app)/*/actions.ts`, `src/app/api/**`.

# 07 — Evidence Index

Confidence: **V** Verified (kode dibaca), **I** Inferred (dari nama file/simbol), **U** Unknown.
Path relatif `src/app/(app)/` disingkat `A/`. Semua modul memakai pola `A/<modul>/page.tsx` + `actions.ts`.

| # | Modul | Route utama | File kunci | API handler | Service/logic | Entitas DB | Auth/permission | Conf. |
|---|---|---|---|---|---|---|---|---|
| 1 | Auth/Login | `/login` | `app/login/actions.ts`, `lib/session.ts`, `middleware.ts` | — | bcrypt+jose | User, AuditTrail | public; JWT | V |
| 2 | Dashboard | `/dashboard` | `A/dashboard/page.tsx` | `api/mobile/dashboard`, `api/client/dashboard` | `server/dashboard.ts` | Invoice, SO, WO, Material, dll. | modul dashboard | I |
| 3 | Laporan | `/laporan`, `/laporan/print` | `A/laporan/*` | `api/export/laporan` | `server/laporan.ts` | SO, Customer, Product, User | modul laporan | I |
| 4 | CRM | `/crm` | `A/crm/*`, `LeadKanbanBoard.tsx` | — | — | Lead, Customer | modul crm | I |
| 5 | Customer | `/customer` | `A/customer/*` | — | `generateCode` | Customer | modul customer | I |
| 6 | Quotation | `/quotation[/id]` | `A/quotation/*` | `api/export/quotation` | `codegen`, `notify` | Quotation, SalesOrder, WorkOrder | modul + OWNER/GM approve | V |
| 7 | Sales Order | `/sales-order[/id]` | `A/sales-order/*` | `api/export/sales-order`, `api/mobile/sales-orders*` | `codegen`, `notify` | SalesOrder, Invoice | modul sales-order | V |
| 8 | Produksi | `/produksi` | `A/produksi/{actions,KanbanBoard,WorkOrderDetailModal}` | `api/export/produksi`, `api/mobile/work-orders*` | `lib/mobile-work-order.ts` | WorkOrder, StepProgress, ProductionLog, QcCheck | modul produksi | V |
| 9 | Delivery | `/delivery` | `A/delivery/*` | `api/mobile/delivery*` | `lib/delivery.ts`, `mobile-delivery.ts` | DeliveryOrder | modul delivery | V |
| 10 | Purchase Request | `/purchase-request` | `A/purchase-request/*` | — | `lib/purchase-auto.ts` | PurchaseRequest, Material, StockMovement | modul purchase-request | V |
| 11 | Material & Stok | `/material-stok[/id]`, `/material-stok/barcode/[id]` | `A/material-stok/*` | `api/barcode/[sku]`, `api/mobile/materials*` | `lib/material-stock.ts`, `barcode.ts` | Material, StockMovement, Supplier | modul; edit/hapus OWNER | V (parsial) |
| 12 | Stok Klien | `/stok-klien` | `A/stok-klien/*` | `api/client/*` | `lib/client-stock.ts`, `client-auth.ts`, `client-notify.ts` | ClientAccount, ClientFinishedGoodsItem, ClientStockMovement, ClientNotification | modul client-stock; token klien | V (stok hooks), I (portal) |
| 13 | Invoice & Piutang | `/invoice`, `/invoice/[id]` | `A/invoice/*`, `app/invoice/[id]` | `api/export/invoice` | — | Invoice, Payment | modul invoice | V |
| 14 | Kalkulator HPP | `/kalkulator-hpp` | `A/kalkulator-hpp/*` | — | `lib/hpp-engine.ts` | Quotation, PriceMasterItem, Product | modul | V (struktur engine), R (rumus & kaitan Price Master) |
| 15 | Price Master | `/price-master` | `A/price-master/*` | — | — | PriceMasterItem | modul | I |
| 16 | Produk | `/produk` | `A/produk/*` | — | — | Product | modul; update OWNER | I |
| 17 | Kategori Produk | `/produk-kategori` | `A/produk-kategori/*` | — | — | ProductCategory | modul | V (soft delete) |
| 18 | Master Design | `/design-master` | `A/design-master/*` | — | — | DesignMaster | modul | I |
| 19 | User & Role | `/user-role` | `A/user-role/*` | — | — | User | OWNER | I |
| 20 | Audit Trail | `/audit-trail` | `A/audit-trail/page.tsx` | — | `lib/audit.ts` | AuditTrail | OWNER | I |
| 21 | Pengaturan | `/pengaturan` | `A/pengaturan/*` | — | `codegen` prefix | CompanySettings | OWNER | I |
| 22 | Akun | `/akun` | `A/akun/*` | — | — | User | session | I |
| 23 | Notifikasi | (bell) | `A/notifications/actions.ts`, `lib/notify.ts` | `api/mobile/notifications`, `api/client/notifications` | — | Notification, ClientNotification | session | I |
| 24 | Mobile staff API | `/api/mobile/*` | `lib/mobile-auth.ts` | 13 route file | — | multi | Bearer + modul | V (auth), I (rest) |
| 25 | Client portal API | `/api/client/*` | `lib/client-auth.ts` | 6 route | — | Client* | Bearer klien | V (auth), I (rest) |

Penghitungan: #2–#21 = 20 modul navigasi; #1 dan #22–#25 = 5 komponen pendukung; total 25.

## Evidence Gaps
1. Migrasi: jumlah tabel cocok (28), kolom belum dibandingkan; DB hidup tidak diakses.
2. `hpp-engine.ts`: hanya struktur fungsi dibaca (Pass 2); rumus detail & `HppCalculatorForm.tsx` belum dianalisis.
3. Pass 2 menutup: QC/rework/packing, delivery, client stock, auto-PR, migrasi (hitungan tabel). Masih terbuka: upload prepress, OVERDUE/EXPIRED, export Excel, dashboard formulas.
4. Handler REST: skema request/response belum diekstrak; scoping `customerId` pada API klien belum diverifikasi per query.
5. Tidak ada tes, CI, deployment config: perilaku produksi tidak terverifikasi (Vercel/Neon hanya dari komentar `.env.example`).
6. Aplikasi mobile & client yang mengonsumsi API tidak ada di repo.
7. Kebijakan bisnis (siapa boleh approve PR, aturan transisi status, term pembayaran vs due date) → Requires Confirmation.
8. `.cursorrules` dirujuk README tetapi tidak ada di repo.

## Requires Confirmation (dari Pass 2)
- Drag WO ke DONE melewati QC & Packing: disengaja?
- Invoice tidak dibuat dari Delivery DELIVERED, hanya dari ubah status SO manual: disengaja?
- QC action tidak dibatasi role QC.
- Reservasi material otomatis tidak ada: kebutuhan bisnis?
- Auto-PR berjalan saat render halaman: perilaku yang diinginkan?
- Qty client stock memakai qty SO, bukan qty good produksi.

## Keputusan Stakeholder (2026-11-18) — dicatat sebagai requirement, BELUM diimplementasikan
| # | Keputusan | Status kode saat ini | Gap |
|---|---|---|---|
| 1 | WO **wajib** lewat QC dan Packing sebelum DONE | `moveWorkOrderStageAction` mengizinkan drag ke DONE (set `qcPassed=true`) | Gap: perlu guard di server |
| 2 | (pertanyaan) Invoice dibuat kapan? | Hanya di `updateSalesOrderStatusAction` saat SO → `DELIVERED` (tombol "Kirim" di `sales-order/page.tsx` & `[id]/page.tsx`); satu-satunya `invoice.create` di `src` | Delivery `DELIVERED` hanya set status SO, tidak membuat invoice |
| 3 | QC action **dibatasi** ke role QC (dan OWNER; GM = [R]) | Semua role bermodul `produksi` bisa | Gap: perlu role check pada `qcResultAction`, `submitQcCheckAction`, `/api/mobile/work-orders/*/qc-*` |
| 4 | Reservasi material: lihat rekomendasi di percakapan | Manual saja (`reservedQty`) | Menunggu keputusan |
| 5, 6 | Penjelasan diberikan di percakapan | — | Menunggu keputusan #5 (auto-PR) & #6 (qty client stock) |

## Status Implementasi Keputusan (2026-11-18, kode diubah atas permintaan eksplisit)
| # | Perubahan | File |
|---|---|---|
| 1 | Drag WO ke `DONE` ditolak (error); `DONE` hanya via `completePackingAction`. `qcResultAction` kini hanya jalan bila stage `QC` | `produksi/actions.ts` |
| 2 | Invoice kini idempoten via `ensureInvoiceForSalesOrder`, dipanggil dari SO "Kirim" **dan** Delivery `DELIVERED` | `lib/invoice.ts`, `sales-order/actions.ts`, `delivery/actions.ts` |
| 3 | `canPerformQc` (OWNER, QC) di `qcResultAction`, `submitQcCheckAction`, mobile `qc-check`/`qc-result` (403) | `lib/roles.ts` + 4 file |
| 4 | Reservasi material (opsi a) diimplementasikan: Kalkulator HPP menyimpan `materialId` + `jumlahPlano` (`planoProduksi`) di `Quotation.materialSpec`; convert ke SO → `reserveMaterialForSalesOrder`; WO masuk `IN_PRODUCTION` → `consumeMaterialForSalesOrder` (kurangi stok + reservasi, `StockMovement PRODUCTION_OUT`); SO `CANCELLED` → `releaseMaterialForSalesOrder`. Migrasi baru `20261120100000_sales_order_material_reservation` (`SalesOrder.materialId`, `materialReservedQty`) — sudah dijalankan ke DB Neon (2026-11-20) | `lib/material-reservation.ts`, `kalkulator-hpp/*`, `quotation/actions.ts`, `sales-order/actions.ts`, `produksi/actions.ts`, `prisma/schema.prisma` |
| 5 | Auto-PR tidak lagi dipicu saat render halaman; tetap saat stok berubah (adjust, buat/edit material) | `material-stok/page.tsx`, `purchase-request/page.tsx`, `purchase-auto.ts` |
| 6 | Stok klien memakai `WorkOrder.goodQtyTotal`; fallback ke qty SO bila 0 | `lib/client-stock.ts` |
Verifikasi: `tsc --noEmit` bersih, `next lint` tanpa error. Tidak ada tes otomatis.

Catatan reservasi: hanya 1 material kertas per SO; reservasi boleh melebihi stok (memicu Auto PR); SO lama & quotation tanpa `materialId` tidak direservasi; konsumsi bergantung pada WO masuk IN_PRODUCTION (kanban/tombol Proses); race condition konkuren belum ditangani.

## Keputusan Stakeholder Putaran 2 (2026-11-20) — requirement, belum diimplementasikan
Lihat `TRD.md` bagian 9. Ringkas: GM boleh QC; approve PR hanya GM/OWNER dan PR buatan GM/OWNER tanpa approval; due date invoice ikut `CustomerTerm` (bisa diadjust); tanpa job EXPIRED/OVERDUE; reservasi BOM multi-material; deploy Vercel + Neon (upload perlu object storage); konstanta HPP berhubungan dengan Price Master; rumus HPP = rumus internal.

Perubahan 2026-11-20: upload file prepress diganti input link OneDrive/SharePoint (`lib/design-link.ts`, `uploadPrepressDesignAction`, `WorkOrderDetailModal.tsx`); `lib/upload.ts` dihapus. Nilai `prepressDesignUrl` lama berupa path `/uploads/...` tetap tampil sebagai link tetapi filenya tidak dijamin ada.

Implementasi 2026-11-20 (putaran 2): GM boleh QC (`QC_ROLES`); PR approve/reject hanya GM/OWNER dan PR buatan mereka auto-APPROVED (`purchase-request/actions.ts`, `page.tsx`, `lib/roles.ts`); due date invoice ikut `CustomerTerm` + ubah manual (`lib/invoice.ts`, `invoice/actions.ts`, `invoice/page.tsx`). `tsc`/`lint` bersih; belum ada tes runtime. Catatan: invoice lama tetap berjatuh tempo +30 hari.

Implementasi 2026-11-20 (putaran 3): secret wajib (`lib/secrets.ts`; `CLIENT_SESSION_SECRET` kini wajib, beda dari `SESSION_SECRET`); dashboard OVERDUE dihitung dari `dueDate`; BOM multi-material (`SalesOrderMaterial`, `lib/material-reservation.ts`, UI di Kalkulator HPP & detail SO, actions `addSalesOrderMaterialAction`/`removeSalesOrderMaterialAction`). Menggantikan implementasi reservasi satu material sebelumnya. `tsc`/`lint` bersih; belum ada tes runtime.

Implementasi 2026-11-20 (putaran 4): `DocumentCounter` untuk `generateCode`; `lib/status-transitions.ts` (SO & Quotation); pembayaran atomik + tolak overpayment; convert quotation→SO+WO transaksional; validasi DB pada token mobile/klien dan role terbaru pada sesi web; vitest (17 tes). Sisa gap: TR-GAP-7 (SO status+invoice, client stock), TR-GAP-12, TR-GAP-13, TR-GAP-14, revokasi token per-sesi, tes integrasi, CI.

## Implementasi & Dokumen 2026-11-21 (putaran 5)
| Area | Perubahan | File |
|---|---|---|
| Transaksi | Delivery DELIVERED (web & mobile) + SO + invoice satu transaksi; mobile kini membuat invoice; `ensureInvoiceForSalesOrder` memakai `createMany skipDuplicates` (aman konkuren); client stock transaksional, tanpa stok negatif | `delivery/actions.ts`, `api/mobile/delivery/[code]/advance/route.ts`, `lib/invoice.ts`, `lib/client-stock.ts` |
| Input | `formId`/`formEnum`; Zod untuk qty BOM manual & catatan revisi | `lib/form.ts`, `sales-order/actions.ts`, `produksi/actions.ts` |
| Logging & CI | `lib/logger.ts`; `.github/workflows/ci.yml` (validate, tsc, lint, unit + integration test dengan Postgres service) | root |
| UI | Tombol/checklist QC disembunyikan untuk non-QC role; tombol "Cek stok minimum" (`scanLowStockAction`) | `produksi/*`, `purchase-request/*` |
| Revokasi token | `tokenVersion` (claim `tv`), aksi "Cabut Sesi" | `lib/session.ts`, `lib/mobile-auth.ts`, `lib/client-auth.ts`, `lib/require-session.ts`, `user-role/*`, `stok-klien/actions.ts` |
| Tes | 17 unit + 6 integrasi (`npm run test:integration`, `TEST_DATABASE_URL` hanya host lokal) | `src/lib/business-flows.int.test.ts`, `vitest.integration.config.ts`, `src/test/setup-integration.ts` |
| Dokumen | `TRD.md` diperbarui (TR-GAP-2, 7, 11–15); `PRD.md` dibuat | `docs/reverse-engineering/` |
Belum tercakup: tes server action berbasis cookie (mis. pembayaran), e2e UI, revokasi per perangkat. Pertanyaan terbuka produk: `PRD.md` bagian 10. [V]

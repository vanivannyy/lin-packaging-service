# 02 — Modules and Features

Sumber daftar modul: `src/lib/nav.ts` (key modul) + `src/app/(app)/*`. Setiap modul = `page.tsx` + `actions.ts` (Server Actions), kecuali dicatat. Total: **20 modul navigasi + 5 komponen pendukung = 25**.

## Modul Navigasi (20) — [V] untuk keberadaan route & action; perilaku detail = [I] kecuali di `06`
| # | Key / Route | Fitur (dari nama action/page) | Role (`ROLE_MODULES`) |
|---|---|---|---|
| 1 | dashboard `/dashboard` | KPI, tren revenue (`server/dashboard.ts`, `RevenueTrendChart`) | semua 9 role |
| 2 | laporan `/laporan` | Report per customer/produk/sales (`server/laporan.ts`), export Excel, print, daily recap (simulasi) | OWNER, GM, FINANCE |
| 3 | crm `/crm` | Lead kanban: create/advance/move/lost/convert→Customer | OWNER, GM, SALES |
| 4 | customer `/customer` | CRUD, toggle aktif | OWNER, GM, SALES, FINANCE, PLANNER, DESIGN |
| 5 | quotation `/quotation[/id]` | Create, status DRAFT→SENT→ACCEPTED/REJECTED, convert→SO, print, export | idem + PLANNER/DESIGN |
| 6 | sales-order `/sales-order[/id]` | Ubah status SO, auto Invoice saat DELIVERED, export | OWNER, GM, SALES, PLANNER, DESIGN |
| 7 | produksi `/produksi` | Kanban Work Order, prepress upload/revisi, step, production log, QC check/result, packing, export | OWNER, GM, SALES, QC, PLANNER, DESIGN |
| 8 | delivery `/delivery` | Kanban Delivery Order, catatan pengiriman | OWNER, GM, SALES, WAREHOUSE, PLANNER, DESIGN |
| 9 | purchase-request `/purchase-request` | Create, approve, reject, receive (+stok), auto-PR stok minimum | OWNER, WAREHOUSE, PURCHASING |
| 10 | material-stok `/material-stok[/id]` | Master material, adjust stok, barcode; edit/hapus hanya OWNER | OWNER, WAREHOUSE, PURCHASING, PLANNER, DESIGN |
| 11 | client-stock `/stok-klien` | Akun klien, item barang jadi klien, adjust stok Lin/klien | OWNER, GM, SALES, WAREHOUSE, PLANNER, DESIGN |
| 12 | invoice `/invoice` | Aging piutang, catat pembayaran, print, export | OWNER, GM, FINANCE |
| 13 | kalkulator-hpp `/kalkulator-hpp` | Engine HPP (`lib/hpp-engine.ts`), buat Quotation dari hasil | OWNER, GM, SALES, PLANNER, DESIGN |
| 14 | price-master `/price-master` | Master komponen biaya | OWNER, GM, SALES |
| 15 | produk `/produk` | Master produk; edit hanya OWNER (page `canEdit`) | OWNER, GM, PURCHASING, PLANNER, DESIGN |
| 16 | produk-kategori `/produk-kategori` | CRUD kategori (soft delete) | idem |
| 17 | design-master `/design-master` | Master design | OWNER, GM, DESIGN |
| 18 | user-role `/user-role` | CRUD user, ubah role, toggle aktif | OWNER saja (implisit "*") |
| 19 | audit-trail `/audit-trail` | Tampilan log (read-only) | OWNER saja |
| 20 | pengaturan `/pengaturan` | Profil perusahaan, prefix penomoran | OWNER saja |

## Komponen Pendukung (5)
| Komponen | Lokasi | Catatan |
|---|---|---|
| Login/logout | `src/app/login` | Server action, audit LOGIN/LOGOUT |
| Akun saya | `(app)/akun` | Ganti password (session apa pun) |
| Notifikasi in-app | `(app)/notifications`, `lib/notify.ts`, `NotificationBell` | Per user/role |
| Mobile staff API | `src/app/api/mobile/*` | Scanner/QC/delivery/stok mobile (klien aplikasi mobile **tidak ada** di repo) |
| Client portal API | `src/app/api/client/*` | Akun customer: lihat item & lapor stok |

## Evidence Check Enterprise
| Fitur | Status | Bukti |
|---|---|---|
| User & role mgmt | Ada | `user-role/actions.ts`, enum `UserRole` |
| Permission check | Ada (modul-level, bukan granular per aksi) | `lib/roles.ts` |
| Approval workflow | Parsial: Quotation accept/reject (OWNER/GM), PR approve/reject (modul-level), QC pass/reject | `quotation/actions.ts:66`, `purchase-request/actions.ts` |
| Business states | Ada | enum di `03` |
| Audit logging | Ada, via helper manual | `lib/audit.ts` |
| Data ownership/org access | Tidak ditemukan (hanya `salesId` informatif) | schema |
| Transaction handling | Parsial (9 titik) | `03` |
| Reporting/export | Ada: Excel (5 route), print page, dashboard | `api/export/*` |
| Background jobs | Tidak ada | `01` |
| Server-side tests | Tidak ada | — |

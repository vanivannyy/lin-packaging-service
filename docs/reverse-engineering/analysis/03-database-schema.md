# 03 — Database Schema

Sumber: `prisma/schema.prisma` (844 baris), `prisma/migrations/*` (16 migrasi + lock `postgresql`). Datasource: `DATABASE_URL` + `directUrl=DIRECT_DATABASE_URL`. **Label: Verified** kecuali dinyatakan lain.

## Keterbatasan
- Tidak ada SQL view/function/trigger di migrasi (pencarian `CREATE VIEW|FUNCTION|TRIGGER` kosong).
- Kolom detail per model tidak disalin penuh; hanya yang relevan. Cek `schema.prisma` untuk definisi lengkap.
- Pass 2: jumlah `CREATE TABLE` di 12 migrasi = 28 (17+1+3+3+4), cocok dengan 28 model. Perubahan enum lewat `ALTER TYPE` (DESIGN, REWORK, COMPLETED, LAMINATING, PACKING, rename SALES_MANAGER→GENERAL_MANAGER); tidak ada `DROP TABLE/COLUMN`. Kesesuaian kolom-per-kolom belum diverifikasi (`prisma migrate diff` tidak dijalankan).
- Tidak ada akses ke DB hidup.

## Model (28) dan Enum (18)
| Domain | Model | Relasi kunci |
|---|---|---|
| Auth | `User` (role enum, isActive, isDeleted) | → Lead, Customer, Quotation, PurchaseRequest (requestedBy/approvedBy), AuditTrail, Notification |
| CRM | `Lead` | → User(sales); Customer.leadId |
| Customer | `Customer` | → User(sales), Lead? |
| Katalog | `Product`, `ProductCategory`, `DesignMaster` | Product → Category?, Material(default)? |
| Inventori | `Material`, `StockMovement`, `Supplier` | Material → Supplier?; StockMovement → Material, User? |
| Harga | `PriceMasterItem` | — |
| Sales | `Quotation`, `SalesOrder` | Quotation → Customer?, Product?, User; SalesOrder → Quotation?, Customer, Product? |
| Produksi | `WorkOrder` (1:1 SalesOrder), `WorkOrderStepProgress`, `WorkOrderProductionLog`, `WorkOrderQcCheck` | → WorkOrder, User? |
| Purchasing | `PurchaseRequest` | → Material, Supplier?, User (requestedBy), User? (approvedBy) |
| Finance | `Invoice`, `Payment` | Invoice → SalesOrder, Customer; Payment → Invoice (`onDelete: Cascade`) |
| Delivery | `DeliveryOrder` | → SalesOrder |
| Client portal | `ClientAccount`, `ClientFinishedGoodsItem`, `ClientStockMovement`, `ClientNotification` | → Customer, Product?, User?/ClientAccount? (actor) |
| Sistem | `AuditTrail`, `Notification`, `DailyRecapLog`, `CompanySettings` (single row) | AuditTrail → User? |

## Enum Status Penting
- `UserRole`: OWNER, GENERAL_MANAGER, SALES, FINANCE, WAREHOUSE, QC, PURCHASING, PRODUCTION_PLANNER, DESIGN
- `LeadStage`: NEW→CONTACTED→QUALIFIED→MEETING→QUOTATION→NEGOTIATION→WON/LOST
- `QuotationStatus`: DRAFT, SENT, ACCEPTED, REJECTED, EXPIRED
- `SalesOrderStatus`: MATERIAL_CHECK, PRODUCTION, READY_DELIVERY, DELIVERED, CANCELLED
- `WorkOrderStage`: WAITING, READY, IN_PRODUCTION, QC, PACKING, REWORK, DONE; `WorkOrderProcess`: PREPRESS…COMPLETED (10 nilai)
- `PurchaseRequestStatus`: PENDING, APPROVED, REJECTED, RECEIVED
- `InvoiceStatus`: UNPAID, PARTIAL, PAID, OVERDUE; `DeliveryStage`: READY, IN_DELIVERY, PENDING, DELIVERED
- `AuditAction`: CREATE, UPDATE, DELETE, STATUS_CHANGE, EXPORT, START, COMPLETE, QC, APPROVE, REJECT
- `ClientStockMovementType`: PRODUCTION_IN, DELIVERY_OUT, ADMIN_ADJUSTMENT, CLIENT_REPORT

## Pola Data
- Primary key `String @default(cuid())`; kode bisnis `code @unique` (mis. `WO-2026-00001`).
- Soft delete: flag `isDeleted` di sebagian model (User, WorkOrder, dll.); tidak ada pemanggilan Prisma `.delete()`/`deleteMany()` di `src` (verified via grep). Verified soft-delete: `deleteMaterialAction`, `deleteProductCategoryAction`. `deleteProductAction` & `deleteDesignMasterAction` belum dibaca [R].
- Uang `Decimal(15,2)`: 11 kolom terverifikasi di schema (audit seluruh kolom uang belum dilakukan).
- 43 `@@index/@@unique`.
- Tidak ada kolom organisasi/cabang/tenant → tidak ada data ownership multi-organisasi [V: tidak ditemukan]. Kepemilikan hanya `salesId` pada Lead/Customer/Quotation.

## Transaksi (Prisma `$transaction`) — 9 titik
| Lokasi | Tujuan |
|---|---|
| `purchase-request/actions.ts:127` | Receive PR: update status + stok + StockMovement |
| `invoice/actions.ts:30` | Payment + update Invoice |
| `material-stok/actions.ts:136, 202` | Update material + StockMovement (136); soft-delete material + auto-reject PR PENDING (202) |
| `produksi/actions.ts:247, 310, 362` | Revisi prepress, start step, production log |
| `produk/actions.ts:81` | Update produk |
| `lib/material-stock.ts:32` | Adjust stok |
Tidak dibungkus transaksi (verified dari kode yang dibaca): `updateSalesOrderStatusAction` (update SO + create Invoice + audit terpisah), `convertQuotationToSalesOrderAction` (create SO + WO + audit terpisah), `generateCode` (lihat risiko).

## Temuan Risiko Data (Verified dari kode)
- `generateCode` memakai `count()+1` tanpa transaksi/sequence → potensi duplikasi kode saat konkurensi (kolom `code @unique` akan menolak, error di runtime).
- `recordPaymentAction` menghitung `paidAmount` dari nilai yang dibaca sebelum transaksi (read-then-write, bukan atomic increment).
- Status `OVERDUE` dibaca di `src/server/dashboard.ts`, tetapi mekanisme yang menetapkannya (job/aksi) **tidak ditemukan** di file yang diperiksa [R].

## Perubahan 2026-11-20
Migrasi `20261120100000_sales_order_material_reservation`: `SalesOrder.materialId` (FK → Material, SET NULL) dan `SalesOrder.materialReservedQty Decimal(15,3) default 0`. Total migrasi menjadi 13. Sudah diaplikasikan ke Neon via `prisma migrate deploy` (2026-11-20).

Perubahan 2026-11-20 (migrasi 14): `20261120150000_sales_order_material_bom` menambah model `SalesOrderMaterial` (BOM per SO: material, qty, reservedQty, status RESERVED/CONSUMED/RELEASED, source HPP/MANUAL) dan enum `SalesOrderMaterialStatus`, memigrasikan data reservasi tunggal, lalu menghapus `SalesOrder.materialId/materialReservedQty`. Diaplikasikan ke Neon. `prisma migrate diff` setelahnya hanya menunjukkan drift FK lama pada `ClientNotification.clientAccountId` dan `Quotation.customerId` (tidak terkait perubahan ini; perlu ditelaah).

Perubahan 2026-11-20 (migrasi 15): `20261120170000_document_counter` menambah `DocumentCounter(key, value)` untuk penomoran dokumen atomik; diaplikasikan ke Neon. Counter disemai dari kode terbesar yang ada pada pemakaian pertama tiap prefix-tahun.

Perubahan 2026-11-21 (migrasi 16): `20261121100000_token_version` menambah `User.tokenVersion` dan `ClientAccount.tokenVersion` (Int, default 0) untuk revokasi token; diaplikasikan ke Neon. Total 16 migrasi. Penyelarasan schema (tanpa perubahan DB): `ClientNotification.clientAccount` `onDelete: Cascade`, `Quotation.customer` `onDelete: Restrict` agar sesuai FK di database. [V]

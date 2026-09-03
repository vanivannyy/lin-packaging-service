# LIN Packaging - Service

Replika ERP full-modul untuk bisnis percetakan & packaging (`lin-packaging-service`). Dibangun sebagai project baru terpisah dari backend `erp-application` yang sudah ada, memakai stack sesuai `.cursorrules`: Next.js 14 App Router, TypeScript, Tailwind, Prisma + PostgreSQL.

## Modul

- **Dashboard** - KPI keuangan, produksi, purchasing, tren revenue/profit, pipeline CRM ringkas
- **Laporan** - Business intelligence per Customer / Produk / Sales, rekap harian owner, export Excel & PDF
- **CRM / Leads** - Kanban pipeline (New → Contacted → Qualified → Meeting → Quotation → Negotiation), convert ke Customer
- **Customer** - Database customer, credit limit, term pembayaran
- **Quotation** - Draft → Sent → Accepted/Rejected, convert ke Sales Order
- **Sales Order** - Material Check → Production → Ready Delivery → Delivered (auto generate Invoice)
- **Papan Produksi** - Kanban Work Order (Waiting/Ready/In Production/QC), tracking proses & progress
- **Purchase Request** - Approval workflow (Pending → Approved/Rejected → Received), auto stock movement
- **Material & Stok** - Stok, reserved, tersedia, alert stok minimum
- **Invoice & Piutang** - Aging piutang, pencatatan pembayaran, cetak invoice (print-to-PDF)
- **Kalkulator HPP** - Versi awal pricing engine (akan disesuaikan dengan kalkulator HPP yang sudah dibuat sebelumnya)
- **Price Master** - Master komponen biaya (paper, finishing, labor, outsourcing, overhead)
- **Produk** - Master produk & material default
- **User & Role** - RBAC 8 role (Owner, Sales Manager, Sales, Finance, Warehouse, QC, Purchasing, Production Planner)
- **Audit Trail** - Log semua aksi penting (tidak ada hard delete, sesuai `.cursorrules`)
- **Pengaturan** - Profil perusahaan & format penomoran dokumen

## Setup

```bash
npm install
npx prisma migrate dev --name init
npm run db:seed
npm run dev
```

Login demo: `owner@lin-packaging.com` / `password123` (lihat `prisma/seed.ts` untuk user role lain).

## Struktur

```
prisma/
  schema.prisma       # skema database
  seed.ts             # data dummy (users, customer, leads, quotation, dst)
src/
  app/
    login/            # halaman & server action login
    (app)/             # semua modul (dilindungi auth), berbagi layout sidebar+topbar
    api/export/        # endpoint Excel export (protected)
    invoice/[id]/      # invoice printable (PDF via print)
    laporan/print/     # laporan printable
  components/
    layout/           # Sidebar, Topbar
    ui/                # PageHeader, StatCard, StatusBadge, Table, Modal, FormField
    dashboard/        # chart tren revenue
  lib/                 # prisma client, session/auth, codegen nomor dokumen, audit log, format, roles
  server/              # query aggregasi dashboard & laporan
```

## Konvensi (mengikuti `.cursorrules`)

- Tidak ada hard delete - semua model memakai `isDeleted` / status, plus `AuditTrail` mencatat setiap aksi penting.
- Semua kolom uang memakai `Decimal(15,2)`.
- Validasi input server action memakai Zod sebelum masuk database.
- Setiap perubahan status Sales Order / Work Order / Purchase Request tercatat di Audit Trail.

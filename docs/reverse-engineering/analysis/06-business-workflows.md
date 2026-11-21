# 06 — Business Workflows

Hanya alur yang terbaca langsung di kode. Alur lain ditandai belum diperiksa. Aturan transisi = apa yang dikode, bukan bukti kebijakan bisnis.

## Alur End-to-End (Verified sebagian)
Lead → Customer → Quotation → Sales Order (+Work Order) → Produksi/QC → Delivery → Invoice → Payment

| Langkah | Implementasi | Sumber | Label |
|---|---|---|---|
| Lead stage | `advance/move/markLost/convertLeadToCustomer` | `crm/actions.ts` | V (ada), I (aturan) |
| Quotation DRAFT→SENT | Siapa pun dengan modul quotation; notifikasi tipe APPROVAL | `quotation/actions.ts:59` | V |
| Quotation ACCEPTED/REJECTED | Hanya OWNER/GM; **tanpa cek status asal** (tidak ada validasi transisi) | `quotation/actions.ts:66` | V |
| Convert Quotation→SO | Syarat status ACCEPTED, 1 SO per quotation; buat SO `MATERIAL_CHECK` + WO `WAITING/PREPRESS` deadline +7 hari (hardcoded); **tanpa transaksi** | `quotation/actions.ts:124` | V |
| SO status | Set bebas dari FormData (tanpa validasi enum/transisi); DELIVERED → auto buat Invoice UNPAID, jatuh tempo +30 hari (hardcoded, tidak memakai `CustomerTerm`); audit + notifikasi | `sales-order/actions.ts:11` | V |
| Work Order | `advanceWorkOrderAction` urutan `STEPS`; masuk IN_PRODUCTION butuh prepress ready (`assertPrepressReady`); REWORK→QC; drag stage terbatas `DRAGGABLE_STAGES`; PACKING hanya via `moveToPackingAction`; QC via `submitQcCheckAction`/`qcResultAction`; `completePackingAction` | `produksi/actions.ts` | V (sebagian fungsi dibaca), I (detail QC/packing) |
| Purchase Request | PENDING→APPROVED/REJECTED→RECEIVED. Receive: syarat APPROVED; `$transaction` update PR + stok + `StockMovement(PURCHASE_IN)`. Approve/reject **tanpa cek status asal** | `purchase-request/actions.ts` | V |
| Auto PR stok minimum | `autoCreatePurchaseRequestIfNeeded` / `...ForAllLowStock` | `lib/purchase-auto.ts` | V (ada), R (pemicu) |
| Delivery | `moveDeliveryStageAction`; `ensureDeliveryOrderForSalesOrder`; mobile advance | `delivery/actions.ts`, `lib/delivery.ts` | V (ada), R (aturan) |
| Client stock | WO selesai → `recordProductionIn`; Delivery DELIVERED → `recordDeliveryOut`; adjust admin/klien | `lib/client-stock.ts` | V (fungsi), R (pemanggil lengkap) |
| Payment | `$transaction` Payment + Invoice; status PAID bila akumulasi ≥ total, selain itu PARTIAL; tidak menolak overpayment; read-then-write | `invoice/actions.ts` | V |
| Material soft-delete | Auto-REJECT PR PENDING terkait dalam transaksi | `material-stok/actions.ts:186` | V |

## Audit
Setiap aksi di atas memanggil `logAudit` (module string tidak seragam: `quotations`, `quotation`, `sales-order`, `purchasing`, `production`, `finance`, `auth`, `export`) — `AuditTrail.module` bebas string [V].

## Notifikasi
`notifyStatusChange` (`lib/notify.ts`) menarget role via `rolesForModule(moduleKeys)` + `extraUserIds`; tipe STATUS/APPROVAL/ACTION [V].

## Aturan Bisnis Terkode (hardcoded)
WO deadline +7 hari; invoice due +30 hari; reject rate/QC (belum dibaca); HPP formula di `lib/hpp-engine.ts` (924 baris, **belum dianalisis**) [R].

## Pass 2 — Temuan Tambahan (Verified, 2026-11-18)

### Produksi / QC (`src/app/(app)/produksi/actions.ts`)
- Step detail (`startWorkOrderStepAction`): toggle WAITING→IN_PROGRESS→DONE per proses; PREPRESS tidak boleh DONE tanpa `prepressDesignUrl`. Dalam `$transaction`.
- `submitQcCheckAction`: catat `WorkOrderQcCheck` (PRINTING/FINISHING, passed, note) — hanya log, **tidak mengubah stage**.
- `qcResultAction`: lulus → `qcPassed=true` (tetap di QC); gagal → stage `REWORK`, progress 70, `rejectRatePercent` (0–100) diisi. Tidak ada cek stage asal (bisa dipanggil pada WO manapun).
- `moveToPackingAction`: syarat `stage==QC` dan `qcPassed===true`.
- `completePackingAction`: syarat `stage==PACKING` → `DONE`, `completedAt`; panggil `ensureDeliveryOrderForSalesOrder`.
- **Bypass QC**: `moveWorkOrderStageAction` (drag kanban) ke `DONE` menetapkan `qcPassed=true`, memanggil `ensureDeliveryOrderForSalesOrder`, tanpa melewati QC/PACKING (`produksi/actions.ts` ±L121–185). Hanya `assertPrepressReady` yang dicek untuk IN_PRODUCTION. Apakah ini disengaja = [R].
- Semua aksi produksi hanya `requireModule("produksi")`; QC action tidak dibatasi ke role QC (SALES, GM, PLANNER, DESIGN juga punya modul ini) [V].

### Delivery & Client Stock
- `ensureDeliveryOrderForSalesOrder` (`lib/delivery.ts`): idempoten per SO; SO MATERIAL_CHECK/PRODUCTION otomatis → `READY_DELIVERY`; buat DO stage `READY`; panggil `recordProductionIn` (try/catch, kegagalan hanya `console.error`).
- `moveDeliveryStageAction`: DO yang sudah DELIVERED tidak bisa diubah; PENDING butuh note; DELIVERED → SO ikut `DELIVERED`, `recordDeliveryOut` (try/catch). **Tidak otomatis membuat Invoice** — Invoice hanya dibuat di `updateSalesOrderStatusAction`, sehingga jalur delivery → invoice **tidak terhubung** [V]; apakah SO-status manual wajib dijalankan juga = [R].
- `recordProductionIn` menambah `linWarehouseQty += SalesOrder.qty`; `recordDeliveryOut` mengurangi (`decrement`, tanpa guard stok negatif); keduanya memakai `qty` SO penuh, bukan qty good WO [V]. Keduanya update item lalu `createMovement` tanpa transaksi.
- Sisi klien: `notifyClientAccounts` ke akun customer terkait.

### Material & Purchasing
- `autoCreatePurchaseRequestIfNeeded`: available = `stockQty − reservedQty`; PR dibuat bila `minStockQty>0` dan available ≤ min, tanpa PR aktif (PENDING/APPROVED). Requester = user aktif role PURCHASING/OWNER pertama (`orderBy role asc`).
- Dipicu saat: `adjustMaterialStock` (`lib/material-stock.ts:65`) **dan** setiap render halaman `/material-stok` dan `/purchase-request` (`autoCreatePurchaseRequestsForAllLowStock`) → operasi tulis pada GET render [V].
- `reservedQty`: hanya terlihat diedit manual (`MaterialForm`, `updateMaterialAction`); **tidak ditemukan** kode yang mereservasi material otomatis saat SO/WO [V: tidak ditemukan]. Status SO `MATERIAL_CHECK` tidak punya pemeriksaan material otomatis.

### HPP (`src/lib/hpp-engine.ts`)
- Fungsi murni (tanpa DB): `hitungHppProduksi(input)` → hasil atau `{error}`. Komponen: harga kertas (rim/kg/plano override, per GSM/ukuran plano), pond, laminating (none/glossy/doff/softtouch/holo), foil, pelat, tinta, cetak digital (offset/digital; per_lembar/per_order), layout pemotongan (`cariLayoutTerbaik`, orientasi H/V, mixed layout).
- Konstanta harga ada di dalam kode (mis. `tentukanHargaDariGSM`, `getHargaLaminatingPerCm`) — kaitan dengan `PriceMasterItem` **belum diverifikasi** [R]; `createQuotationFromHppAction` membuat `Quotation` via Prisma (`kalkulator-hpp/actions.ts:47`).
- Rumus rinci tidak didokumentasikan di fase ini (butuh analisis khusus untuk TRD).

## Belum Diperiksa
Isi export Excel/laporan, rumus agregasi dashboard, `uploadPrepressDesignAction`/`assertPrepressReady` detail, `updateUserAction` detail, mekanisme OVERDUE/EXPIRED, lead convert detail, `deleteProductAction`/`deleteDesignMasterAction`.

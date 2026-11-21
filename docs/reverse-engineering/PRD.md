# Product Requirements Document (PRD) — LIN Packaging Service

Status: Draft 1 (2026-11-21). Dasar: `analysis/00–07`, `TRD.md`, dan keputusan stakeholder (TRD bagian 9).
Label: **[V]** Verified (kode dibaca / keputusan stakeholder tercatat), **[I]** Inferred, **[R]** Requires Confirmation.

> PRD ini disusun **mundur dari kode (reverse-engineering)**. Isinya menggambarkan produk *as-is* beserta aturan yang sudah dikonfirmasi stakeholder. Tujuan bisnis, target angka (KPI), dan prioritas roadmap **tidak ditemukan di repository** dan ditandai [R]; jangan dianggap sebagai niat bisnis resmi sebelum dikonfirmasi.

---

## 1. Ringkasan Produk
**LIN Packaging Service** adalah aplikasi ERP internal untuk usaha percetakan/packaging. Satu sistem mengelola siklus dari prospek sampai pembayaran: Lead → Customer → Quotation (dengan Kalkulator HPP) → Sales Order → Produksi (prepress, cetak, QC, packing) → Pengiriman → Invoice & Pembayaran. Sistem juga mengelola stok material, purchasing, stok barang jadi milik klien, serta API untuk aplikasi mobile staff dan portal klien. [V]

## 2. Latar Belakang & Masalah yang Diselesaikan
| Masalah | Bukti dalam produk | Label |
|---|---|---|
| Harga jual harus dihitung dari banyak komponen biaya (kertas, pond, laminating, foil, pelat, tinta, cetak) | Kalkulator HPP dengan layout potong optimal | V (fitur), I (motivasi) |
| Pesanan harus ditelusuri antar departemen | Status SO/WO/DO terhubung, notifikasi per role | V (fitur), I (motivasi) |
| Stok material harus terjaga dan pembelian tepat waktu | Reservasi BOM, stok minimum, Auto PR | V (fitur), I (motivasi) |
| Klien ingin tahu stok barang jadi mereka di gudang Lin | Portal klien (API) dan modul Stok Klien | V (fitur), I (motivasi) |
| Piutang harus dipantau | Invoice, aging, pembayaran parsial | V (fitur), I (motivasi) |
| Tujuan bisnis & target terukur | Tidak ditemukan | R |

## 3. Pengguna & Peran
Sembilan role staff (`src/lib/roles.ts`) dan satu pengguna eksternal. [V]

| Persona | Kebutuhan utama (dari modul yang diizinkan) |
|---|---|
| Owner | Akses penuh; kelola user, pengaturan, audit trail; approve quotation & PR |
| General Manager | Pantau seluruh operasional, laporan; approve quotation & PR; boleh melakukan QC |
| Sales | Lead, customer, quotation, kalkulator HPP, pantau SO/produksi/delivery |
| Production Planner | Quotation, SO, produksi, delivery, material, stok klien |
| Design | Seperti Planner, plus master design dan link desain prepress |
| QC | Produksi: checklist dan keputusan QC |
| Warehouse | Material, purchase request, delivery, stok klien |
| Purchasing | Purchase request, material, produk |
| Finance | Invoice, pembayaran, laporan, customer |
| Klien (eksternal) | Melihat item barang jadi dan stok, melaporkan stok sendiri, menerima notifikasi (via API; aplikasinya tidak ada di repo) |

Matriks modul per role: `analysis/05-auth-and-permissions.md`. Aplikasi mobile staff dan aplikasi klien **tidak ada di repo**; hanya API-nya. [V]

## 4. Tujuan Produk
Tujuan di bawah **diturunkan dari fitur yang ada** [I]; belum ada dokumen tujuan resmi [R].
1. Satu sumber data untuk alur order-to-cash.
2. Harga yang konsisten lewat kalkulator HPP.
3. Kontrol proses: produksi tidak bisa melompati prepress, QC, dan packing.
4. Visibilitas stok material dan stok klien, dengan pembelian otomatis saat stok menipis.
5. Jejak audit untuk setiap perubahan penting.

### Di luar cakupan saat ini (Non-goals) [V: tidak ditemukan di kode / keputusan stakeholder]
- Multi-cabang / multi-tenant (tidak ada konsep organisasi).
- Upload file desain (diganti link OneDrive).
- Job terjadwal: quotation `EXPIRED` dan invoice `OVERDUE` tidak diotomasi.
- Pengiriman email (daily recap hanya simulasi).
- Aplikasi mobile/klien (hanya API).
- MFA, lockout, dan password policy ketat: belum ada [R apakah dibutuhkan].

## 5. Kebutuhan Fungsional per Modul
Format: *Sebagai [peran], saya ingin …, sehingga …* + aturan bisnis. Semua aturan di bawah terverifikasi di kode kecuali ditandai lain. Detail teknis: `TRD.md`.

### 5.1 CRM & Customer
- Sales mengelola Lead di papan kanban (NEW sampai WON/LOST), menandai lost, dan mengonversi Lead menjadi Customer. [V]
- Customer punya **term pembayaran** (CBD, NET_15, 30, 45, 60) dan limit kredit; bisa dinonaktifkan. [V]
- Aturan stage Lead = [I].

### 5.2 Kalkulator HPP & Quotation
- Sales menghitung HPP dari spesifikasi cetak; sistem memilih layout potong terbaik dan menampilkan rincian biaya. Rumus adalah **rumus internal perusahaan**. [V keputusan stakeholder]
- Konstanta HPP berhubungan dengan Price Master. [V keputusan; mekanisme sinkronisasi penuh R]
- Dari hasil HPP, Sales membuat Quotation, termasuk daftar **BOM material** (qty disarankan: kertas = jumlah plano produksi; tinta = konsumsi tinta offset; lainnya diisi manual). [V]
- Alur Quotation: DRAFT → SENT → ACCEPTED/REJECTED. **Hanya Owner/GM yang boleh Accept/Reject.** [V]
- Quotation ACCEPTED dapat dikonversi menjadi Sales Order (maksimal satu SO per quotation). [V]

### 5.3 Sales Order
- Konversi membuat SO (status Material Check) dan Work Order sekaligus dalam satu transaksi, lalu mereservasi material. Deadline WO default +7 hari (nilai tetap di kode). [V; apakah +7 hari sesuai kebijakan = R]
- Status SO: Material Check → Production → Ready Delivery → Delivered; Cancelled dari tiga status pertama. Delivered dan Cancelled bersifat final. [V]
- Staff dapat menambah/menghapus baris BOM material selama status Material Check. Pembatalan SO melepas reservasi. [V]

### 5.4 Material & Stok
- Master material dengan kategori (kertas, film, foil, tinta, lainnya), stok, stok minimum, harga, dan barcode. [V]
- Stok tersedia = stok fisik − reservasi. Reservasi boleh melebihi stok (memicu pembelian). [V]
- **BOM multi-material** per SO: reservasi saat SO dibuat, konsumsi penuh saat produksi dimulai, pelepasan saat batal/hapus baris. Konsumsi parsial/retur otomatis tidak tersedia. [V]
- Edit dan hapus material hanya Owner. [V]

### 5.5 Purchasing
- Staff membuat Purchase Request (PR). Alur: PENDING → APPROVED/REJECTED → RECEIVED. Penerimaan barang menambah stok dan mencatat pergerakan stok. [V]
- **Approval PR hanya Owner dan GM.** PR yang dibuat Owner/GM langsung APPROVED tanpa persetujuan lagi. [V keputusan stakeholder]
- **Auto PR:** PR dibuat otomatis saat stok tersedia ≤ stok minimum dan belum ada PR aktif; pemicunya perubahan stok/material. Tersedia tombol manual **"Cek stok minimum"** untuk material yang sudah di bawah minimum. [V]

### 5.6 Produksi (Work Order)
- Kanban Work Order dengan stage Waiting, Ready, In Production, QC, Packing, Rework, Done. [V]
- **Prepress:** WO baru boleh masuk produksi setelah desain siap. Desain berupa **link OneDrive/SharePoint (https)**; ada alur revisi. [V]
- Pencatatan produksi: jumlah baik, reject, dan downtime per proses. [V]
- **QC:** checklist QC dan keputusan lulus/gagal hanya untuk Owner, GM, dan QC (GM boleh QC sesuai keputusan stakeholder). Gagal QC → Rework dengan persentase reject. Tombol QC disembunyikan untuk role lain. [V]
- **Packing hanya setelah QC lulus; status Done hanya lewat penyelesaian Packing** (tidak bisa dengan drag kanban). [V keputusan stakeholder]
- Selesai packing memicu pembuatan Delivery Order dan penambahan stok barang jadi klien. [V]

### 5.7 Delivery
- Kanban Delivery Order: Ready → In Delivery → Pending (wajib catatan) → Delivered. Delivered final. [V]
- Saat Delivered: SO menjadi Delivered, **Invoice dibuat otomatis**, dan stok klien berkurang. Berlaku di web dan mobile. Seluruhnya satu transaksi. [V]

### 5.8 Invoice & Pembayaran
- Invoice dibuat saat pengiriman selesai (satu invoice per SO). **Jatuh tempo mengikuti term customer dan dapat disesuaikan** Finance/Owner/GM. [V keputusan stakeholder]
- Pembayaran parsial diizinkan; status UNPAID → PARTIAL → PAID. Pembayaran melebihi sisa tagihan ditolak. [V]
- Dashboard menghitung piutang terlambat dari jatuh tempo (status OVERDUE tidak dijadwalkan). [V]
- Aging piutang, cetak, dan export Excel. [V]

### 5.9 Stok Klien & Portal Klien
- Staff membuat akun klien dan item barang jadi; stok bertambah saat WO selesai (jumlah baik) dan berkurang saat pengiriman, tanpa negatif. [V]
- Koreksi stok: admin (sisi Lin atau sisi klien) dan klien (lapor stok sendiri). Setiap perubahan tercatat sebagai movement. [V]
- Klien mendapat notifikasi saat barangnya dikirim. [V]

### 5.10 Master Data
Produk, kategori produk, price master, design master, supplier. Edit produk hanya Owner. [V]

### 5.11 Laporan, Dashboard, Notifikasi
- Dashboard KPI dan tren revenue. Laporan per customer/produk/sales (Owner, GM, Finance), export Excel dan cetak. [V]
- Notifikasi in-app per role/user untuk perubahan status dan permintaan persetujuan. [V]

### 5.12 Administrasi & Keamanan
- Owner mengelola user dan role (minimal satu Owner aktif), pengaturan perusahaan dan prefix penomoran, serta melihat audit trail. [V]
- Login web (8 jam), mobile dan klien (30 hari). Owner dapat **mencabut seluruh sesi** seorang user; sesi juga dicabut saat password/role berubah atau akun dinonaktifkan. [V]
- Setiap pengguna bisa mengganti password sendiri. [V]

## 6. Aturan Bisnis Terkonfirmasi (Ringkas)
| # | Aturan | Sumber |
|---|---|---|
| 1 | Tidak boleh lompat ke Done; wajib lewat QC dan Packing | Stakeholder |
| 2 | GM boleh melakukan QC | Stakeholder |
| 3 | Approval PR: GM/Owner; PR buatan GM/Owner otomatis disetujui | Stakeholder |
| 4 | Jatuh tempo invoice mengikuti term customer, dapat diubah | Stakeholder |
| 5 | Tidak ada job terjadwal untuk EXPIRED/OVERDUE | Stakeholder |
| 6 | Satu SO dapat memakai banyak material (BOM) | Stakeholder |
| 7 | Deployment di Vercel dan Neon | Stakeholder |
| 8 | Konstanta HPP berhubungan dengan Price Master | Stakeholder |
| 9 | Rumus HPP adalah rumus internal | Stakeholder |
| 10 | Desain prepress berupa link OneDrive | Stakeholder |
| 11 | Auto PR untuk material yang sudah di bawah minimum perlu tersedia (tombol manual) | Stakeholder |

## 7. Kebutuhan Non-Fungsional (sudut pandang produk)
| Area | Kondisi | Label |
|---|---|---|
| Keamanan | RBAC modul, sesi httpOnly, secret wajib dari env, revokasi token | V |
| Auditabilitas | Perubahan penting tercatat; nama modul audit belum seragam | V |
| Integritas data | Transaksi untuk alur multi-langkah, penomoran atomik, soft delete | V |
| Keandalan | Pembayaran dan BOM aman terhadap klik ganda/konkurensi | V |
| Pengujian | 17 unit test, 6 tes integrasi, CI GitHub Actions | V |
| Performa/kapasitas/SLA, jumlah pengguna | Tidak ditemukan | R |
| Retensi dan backup data, kepatuhan (mis. pajak/NPWP) | Tidak ditemukan | R |
| Bahasa antarmuka | Bahasa Indonesia [I] | I |

## 8. Dependensi & Asumsi
- Neon PostgreSQL (pooled + direct URL), Vercel, OneDrive (host link desain). [V]
- Aplikasi mobile staff dan aplikasi klien dikembangkan di luar repo ini dan memakai API yang ada. [V/I]
- Environment `SESSION_SECRET` dan `CLIENT_SESSION_SECRET` harus diisi di Vercel sebelum deploy. [V]

## 9. Risiko & Gap Produk yang Diketahui
| Risiko | Dampak | Label |
|---|---|---|
| Tanpa MFA/lockout/rate limit | Brute force login | V |
| Pencabutan token tidak per perangkat | Semua perangkat user ikut keluar | V |
| Konsumsi material penuh saat produksi mulai | Tidak mengakomodasi konsumsi parsial/retur | V |
| Pemetaan komponen HPP → material belum otomatis (hanya saran qty) | Input manual BOM | V |
| Validasi data pada beberapa field bergantung pada skema form masing-masing | Risiko minor | I |
| Tes e2e/UI dan tes server action berbasis cookie belum ada | Regresi UI | V |
| Password database Neon pernah dibagikan di chat | Perlu rotasi | V |

## 10. Pertanyaan Terbuka (Requires Confirmation)
1. Apa tujuan bisnis dan KPI keberhasilan (mis. waktu siklus order, akurasi stok, DSO)?
2. Berapa jumlah pengguna, volume order per bulan, dan kebutuhan performa?
3. Apakah deadline Work Order default +7 hari sesuai kebijakan, atau sebaiknya mengikuti tanggal kirim di SO/Quotation?
4. Apakah diperlukan batas kredit yang benar-benar memblokir SO/Quotation (field `creditLimit` ada, penegakannya belum diperiksa)?
5. Bagaimana kebijakan retur dan konsumsi parsial material?
6. Apakah klien membutuhkan aplikasi sendiri, dan siapa pemiliknya? Apakah aplikasi mobile staff sudah ada?
7. Apakah perlu pembatasan data per sales (hanya melihat customer/quotation miliknya)?
8. Apakah perlu pengiriman email/WhatsApp nyata untuk notifikasi dan rekap harian?
9. Kebijakan retensi audit trail, backup, dan kepatuhan pajak.
10. Apakah perlu MFA/password policy untuk Owner/Finance?

## 11. Traceability
| Bagian PRD | TRD | Analisis |
|---|---|---|
| 5.1–5.3 | TR-CRM, TR-QUO, TR-SO | `06-business-workflows.md` |
| 5.4–5.5 | TR-MAT, TR-PUR | `06`, `03-database-schema.md` |
| 5.6–5.7 | TR-PROD, TR-DEL | `06` |
| 5.8 | TR-INV | `06` |
| 5.9 | TR-CLI | `04-api-contracts.md` |
| 5.12 | TR-AUTH, NFR | `05-auth-and-permissions.md` |

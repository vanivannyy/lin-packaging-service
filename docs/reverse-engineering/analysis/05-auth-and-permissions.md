# 05 — Authentication & Permissions

## Autentikasi
| Aspek | Temuan | Sumber |
|---|---|---|
| Web login | `loginAction`: Zod, `bcrypt.compare`, tolak `isDeleted`/`!isActive`, set cookie, update `lastLoginAt`, audit LOGIN | `src/app/login/actions.ts` |
| Session web | JWT HS256, cookie `lpc_session`, httpOnly, sameSite=lax, secure di production, 8 jam | `src/lib/session.ts` |
| Validasi per request | Middleware hanya verifikasi JWT (tanpa DB). `requireSession()` (Server Component/Action) cek DB `isActive/isDeleted` | `middleware.ts`, `lib/require-session.ts` |
| Mobile token | HS256, aud `mobile-scanner`, 30 hari, Bearer. **Tidak ada pengecekan DB isActive per request** di `requireMobileSession` | `lib/mobile-auth.ts` |
| Client token | HS256, aud `client-apps`, 30 hari; secret `CLIENT_SESSION_SECRET` fallback `SESSION_SECRET` | `lib/client-auth.ts` |
| Fallback secret | `"dev-only-insecure-secret"` bila env kosong (3 file) | session/mobile-auth/client-auth |
| Password policy / lockout / MFA / rate limit | Tidak ditemukan | — |
| Ganti password | `changePasswordAction` | `(app)/akun/actions.ts` |

## Otorisasi (RBAC modul-level)
Mekanisme: `ROLE_MODULES: Record<UserRole,string[]>` di `src/lib/roles.ts`. Dicek di 3 tempat: (1) `middleware.ts` → `canAccessPath` (path → modul via `NAV_GROUPS` + `API_MODULE_PREFIXES`), (2) `requireModule()` di page/action, (3) `denyIfNoModule()` di route export & `canAccessModule` di route mobile.

| Role | Modul |
|---|---|
| OWNER | `*` (semua) |
| GENERAL_MANAGER | dashboard, laporan, crm, customer, quotation, sales-order, produksi, delivery, invoice, produk, produk-kategori, design-master, kalkulator-hpp, price-master, client-stock |
| SALES | dashboard, crm, customer, quotation, sales-order, kalkulator-hpp, price-master, produksi, delivery, client-stock |
| FINANCE | dashboard, laporan, invoice, customer |
| WAREHOUSE | dashboard, material-stok, purchase-request, delivery, client-stock |
| QC | dashboard, produksi |
| PURCHASING | dashboard, purchase-request, material-stok, produk, produk-kategori |
| PRODUCTION_PLANNER | dashboard, customer, quotation, kalkulator-hpp, produk, produk-kategori, sales-order, produksi, delivery, material-stok, client-stock |
| DESIGN | PLANNER + design-master |

Modul `user-role`, `audit-trail`, `pengaturan` tidak muncul di role non-OWNER → hanya OWNER (via `"*"`).

## Pengecekan Role Eksplisit (di luar modul)
- Quotation ACCEPTED/REJECTED hanya OWNER/GENERAL_MANAGER — `quotation/actions.ts:66` (juga UI `canApprove`).
- Material: edit & hapus hanya OWNER — `material-stok/actions.ts:96,187`.
- Produk: update hanya OWNER — `produk/actions.ts:60`.
- User: OWNER tidak boleh diturunkan role-nya — `user-role/actions.ts:108`.

## Temuan / Gap (Verified dari kode)
1. Tidak ada permission granular per aksi; approve/reject Purchase Request tidak dibatasi role khusus — semua role dengan modul `purchase-request` (WAREHOUSE, PURCHASING) bisa approve; tidak ada pemisahan requester vs approver [V]. Kebijakan bisnis: [R].
2. `updateSalesOrderStatusAction` menerima `status` dari FormData tanpa validasi enum maupun aturan transisi, dan bisa dipanggil role manapun dengan modul `sales-order` (termasuk SALES) [V].
3. Middleware menandai `/api/mobile` & `/api/client` public; keamanan bergantung pada guard di tiap handler. Dari 12 handler mobile non-login, 10 memakai `canAccessModule`; `mobile/dashboard` dan `mobile/notifications` hanya `requireMobileSession` (tanpa guard modul) [V].
4. Token mobile/client 30 hari tanpa revocation; user dinonaktifkan tetap bisa memakai token mobile (hanya login yang cek `isActive`) [V untuk mobile-auth.ts; perilaku tiap handler belum dicek penuh].
5. Data scoping: tidak ada pembatasan baris per user/organisasi untuk staff. Client API ter-scope `customerId` dari token [I — belum diverifikasi di tiap query client].

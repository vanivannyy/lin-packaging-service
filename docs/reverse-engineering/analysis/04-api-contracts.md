# 04 — API Contracts

Hanya route handler (`src/app/api/**/route.ts`, 26 handler). Server Actions (mutasi web, 21 file `actions.ts`) bukan REST; lihat `02`. Schema request/response rinci belum diekstrak (belum membaca semua handler) — [R].

## Web (cookie session via middleware; handler juga `denyIfNoModule`)
| Method | Path | Modul guard |
|---|---|---|
| GET | `/api/export/invoice` | invoice |
| GET | `/api/export/laporan` | laporan |
| GET | `/api/export/quotation` | quotation |
| GET | `/api/export/sales-order` | sales-order |
| GET | `/api/export/produksi` | produksi |
| GET | `/api/barcode/[sku]` | material-stok |

## Mobile staff (public di middleware; Bearer JWT `requireMobileSession`; guard modul `canAccessModule` di handler)
| Method | Path | Catatan |
|---|---|---|
| POST | `/api/mobile/auth/login` | email+password → token 30 hari |
| GET | `/api/mobile/dashboard` | tanpa guard modul |
| GET | `/api/mobile/sales-orders`, `/[code]` | |
| GET | `/api/mobile/work-orders`, `/[code]` | |
| POST | `/api/mobile/work-orders/[code]/qc-check`, `/qc-result` | QC |
| GET | `/api/mobile/delivery/[code]` | |
| POST | `/api/mobile/delivery/[code]/advance` | maju stage delivery |
| GET | `/api/mobile/materials/[id]` | |
| POST | `/api/mobile/materials/[id]/adjust` | zod `{quantity≠0, note?, referenceCode?}`; source `MOBILE` |
| GET/PATCH | `/api/mobile/notifications` | `requireMobileSession` saja (tanpa guard modul) |

## Client portal (public di middleware; Bearer JWT `requireClientSession`)
| Method | Path |
|---|---|
| POST | `/api/client/auth/login` |
| GET | `/api/client/dashboard` |
| GET | `/api/client/items`, `/items/[id]` |
| POST | `/api/client/items/[id]/report-stock` |
| GET/PATCH | `/api/client/notifications` |

## Pola
- Error JSON `{ error: string }`; status 401/403/404/422 (verified di handler yang dibaca: adjust, login client).
- Validasi body: Zod `safeParse` (login client, mobile adjust). Handler lain belum diperiksa [R].
- Tidak ada OpenAPI/Swagger, tidak ada versioning path, tidak ada rate limiting yang ditemukan [V: tidak ditemukan].
- Tidak ada webhook / integrasi pihak ketiga outbound.

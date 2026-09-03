type NumberLike = number | string | { toString(): string };

function toNumber(value: NumberLike): number {
  return typeof value === "number" ? value : Number(value.toString());
}

// Format compact ala dashboard: Rp 371.5 Jt / Rp 2.9 M / Rp 850 Rb
export function formatRupiahCompact(value: NumberLike): string {
  const n = toNumber(value);
  const abs = Math.abs(n);
  const sign = n < 0 ? "-" : "";

  if (abs >= 1_000_000_000) {
    return `${sign}Rp ${(abs / 1_000_000_000).toFixed(1)} M`;
  }
  if (abs >= 1_000_000) {
    return `${sign}Rp ${(abs / 1_000_000).toFixed(1)} Jt`;
  }
  if (abs >= 1_000) {
    return `${sign}Rp ${(abs / 1_000).toFixed(1)} Rb`;
  }
  return `${sign}Rp ${abs.toFixed(0)}`;
}

// Format lengkap dengan pemisah ribuan: Rp 15.000.000
export function formatRupiah(value: NumberLike): string {
  const n = toNumber(value);
  return `Rp ${Math.round(n).toLocaleString("id-ID")}`;
}

export function formatNumber(value: NumberLike): string {
  const n = toNumber(value);
  return n.toLocaleString("id-ID");
}

// Angka desimal maks 2 digit di belakang koma, ala kalkulator HPP (mis. 43.5, 1234.56)
export function formatDecimal(value: NumberLike, maximumFractionDigits = 2): string {
  const n = toNumber(value);
  return n.toLocaleString("id-ID", { maximumFractionDigits });
}

export function formatPercent(value: NumberLike, digits = 2): string {
  const n = toNumber(value);
  return `${n.toFixed(digits)}%`;
}

export function formatDate(value: Date | string, withYear = true): string {
  const d = typeof value === "string" ? new Date(value) : value;
  const months = [
    "Jan", "Feb", "Mar", "Apr", "Mei", "Jun",
    "Jul", "Agu", "Sep", "Okt", "Nov", "Des",
  ];
  const day = d.getDate();
  const month = months[d.getMonth()];
  if (!withYear) return `${day} ${month}`;
  return `${day} ${month} ${d.getFullYear()}`;
}

export function formatDateTime(value: Date | string): string {
  const d = typeof value === "string" ? new Date(value) : value;
  const hh = d.getHours().toString().padStart(2, "0");
  const mm = d.getMinutes().toString().padStart(2, "0");
  return `${formatDate(value, false)}, ${hh}.${mm}`;
}

export function formatRelativeTime(value: Date | string): string {
  const d = typeof value === "string" ? new Date(value) : value;
  const diffSec = Math.max(0, Math.floor((Date.now() - d.getTime()) / 1000));
  if (diffSec < 60) return "baru saja";
  const diffMin = Math.floor(diffSec / 60);
  if (diffMin < 60) return `${diffMin} menit lalu`;
  const diffHour = Math.floor(diffMin / 60);
  if (diffHour < 24) return `${diffHour} jam lalu`;
  const diffDay = Math.floor(diffHour / 24);
  if (diffDay === 1) return "kemarin";
  if (diffDay < 7) return `${diffDay} hari lalu`;
  return formatDateTime(d);
}

export function daysBetween(from: Date, to: Date): number {
  const ms = to.getTime() - from.getTime();
  return Math.floor(ms / (1000 * 60 * 60 * 24));
}

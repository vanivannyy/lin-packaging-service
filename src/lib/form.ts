// Pembacaan FormData yang aman: menggantikan cast `formData.get(...) as string`.

/** Ambil field teks wajib (tidak kosong). Melempar Error bila hilang/bukan string. */
export function formId(formData: FormData, key: string): string {
  const value = formData.get(key);
  if (typeof value !== "string" || value.trim() === "") {
    throw new Error(`Field "${key}" wajib diisi.`);
  }
  return value.trim();
}

/** Ambil field enum wajib dari daftar nilai yang diizinkan. */
export function formEnum<T extends string>(formData: FormData, key: string, allowed: readonly T[]): T {
  const value = formData.get(key);
  if (typeof value !== "string" || !(allowed as readonly string[]).includes(value)) {
    throw new Error(`Nilai "${key}" tidak valid.`);
  }
  return value as T;
}

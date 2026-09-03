import { mkdir, writeFile } from "fs/promises";
import path from "path";

const MAX_UPLOAD_BYTES = 8 * 1024 * 1024; // 8 MB

// Simpan file upload (screenshot design, dsb.) ke /public/uploads/<subdir>/ dan kembalikan path publiknya.
export async function saveUploadedFile(file: File, subdir: string): Promise<string> {
  if (file.size <= 0) throw new Error("File kosong.");
  if (file.size > MAX_UPLOAD_BYTES) throw new Error("Ukuran file maksimal 8 MB.");

  const bytes = Buffer.from(await file.arrayBuffer());
  const dir = path.join(process.cwd(), "public", "uploads", subdir);
  await mkdir(dir, { recursive: true });

  const ext = path.extname(file.name).toLowerCase() || ".png";
  const safeExt = /^\.[a-z0-9]{1,5}$/.test(ext) ? ext : ".png";
  const filename = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}${safeExt}`;
  await writeFile(path.join(dir, filename), bytes);

  return `/uploads/${subdir}/${filename}`;
}

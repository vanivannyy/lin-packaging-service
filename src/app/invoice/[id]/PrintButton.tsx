"use client";

async function waitForImages() {
  const images = Array.from(document.images);
  await Promise.all(
    images.map((img) =>
      img.complete
        ? Promise.resolve()
        : new Promise<void>((resolve) => {
            img.addEventListener("load", () => resolve(), { once: true });
            img.addEventListener("error", () => resolve(), { once: true });
          }),
    ),
  );
}

export function PrintButton() {
  return (
    <button
      onClick={async () => {
        await waitForImages();
        window.print();
      }}
      className="rounded-md bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700"
    >
      Print / Simpan sebagai PDF
    </button>
  );
}

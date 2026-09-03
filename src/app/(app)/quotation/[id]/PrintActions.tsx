"use client";

import { FileDown, Printer } from "lucide-react";

export function PrintActions() {
  return (
    <>
      <button
        type="button"
        onClick={() => window.print()}
        className="rounded-md border border-gray-200 p-2 text-gray-600 hover:bg-gray-50"
        title="Print"
      >
        <Printer size={14} />
      </button>
      <button
        type="button"
        onClick={() => window.print()}
        className="flex items-center gap-1.5 rounded-md border border-gray-200 px-3 py-2 text-sm font-semibold text-gray-600 hover:bg-gray-50"
      >
        <FileDown size={14} /> PDF
      </button>
    </>
  );
}

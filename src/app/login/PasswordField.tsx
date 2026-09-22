"use client";

import { useState } from "react";
import { Eye, EyeOff } from "lucide-react";

export function PasswordField({ defaultValue }: { defaultValue?: string }) {
  const [visible, setVisible] = useState(false);

  return (
    <div className="relative">
      <input
        id="password"
        name="password"
        type={visible ? "text" : "password"}
        required
        defaultValue={defaultValue}
        className="w-full rounded-md border border-gray-300 px-3 py-2 pr-10 text-sm outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
      />
      <button
        type="button"
        onClick={() => setVisible((v) => !v)}
        className="absolute right-2 top-1/2 -translate-y-1/2 rounded p-1 text-gray-400 hover:text-gray-600"
        aria-label={visible ? "Sembunyikan password" : "Lihat password"}
      >
        {visible ? <EyeOff size={16} /> : <Eye size={16} />}
      </button>
    </div>
  );
}

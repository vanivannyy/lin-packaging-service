"use client";

export function AutoSubmitSelect({
  name,
  defaultValue,
  options,
  placeholder,
  className,
}: {
  name: string;
  defaultValue?: string;
  options: { value: string; label: string }[];
  placeholder: string;
  className?: string;
}) {
  return (
    <select
      name={name}
      defaultValue={defaultValue ?? ""}
      onChange={(e) => e.currentTarget.form?.submit()}
      className={`rounded-md border border-gray-200 bg-white px-3 py-2 text-sm outline-none focus:border-blue-400 ${className ?? ""}`}
    >
      <option value="">{placeholder}</option>
      {options.map((o) => (
        <option key={o.value} value={o.value}>
          {o.label}
        </option>
      ))}
    </select>
  );
}

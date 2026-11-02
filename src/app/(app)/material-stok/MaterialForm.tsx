import { Field, Input, Select, SubmitButton } from "@/components/ui/FormField";

export type MaterialFormValues = {
  id: string;
  name: string;
  category: string;
  gsm: number | null;
  size: string | null;
  supplierId: string | null;
  supplierName?: string | null;
  pricePerUnit: unknown;
  unit: string;
  minStockQty: unknown;
};

export function MaterialForm({
  action,
  suppliers,
  submitLabel,
  defaultValues,
}: {
  action: (formData: FormData) => void | Promise<void>;
  suppliers: { id: string; name: string }[];
  submitLabel: string;
  defaultValues?: MaterialFormValues;
}) {
  return (
    <form action={action} className="space-y-3">
      {defaultValues ? <input type="hidden" name="materialId" value={defaultValues.id} /> : null}
      <Field label="Nama Material">
        <Input name="name" required defaultValue={defaultValues?.name} placeholder="Art Carton 260 GSM" />
      </Field>
      <div className="grid grid-cols-2 gap-3">
        <Field label="Kategori">
          <Select name="category" defaultValue={defaultValues?.category ?? "PAPER"}>
            <option value="PAPER">Paper</option>
            <option value="FILM">Film</option>
            <option value="FOIL">Foil</option>
            <option value="INK">Ink</option>
            <option value="OTHER">Other</option>
          </Select>
        </Field>
        <Field label="GSM">
          <Input name="gsm" type="number" defaultValue={defaultValues?.gsm ?? ""} placeholder="260" />
        </Field>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <Field label="Ukuran">
          <Input name="size" defaultValue={defaultValues?.size ?? ""} placeholder="65x100 cm" />
        </Field>
        <Field label="Unit">
          <Input name="unit" defaultValue={defaultValues?.unit ?? "LEMBAR"} placeholder="LEMBAR / ROLL / KG" />
        </Field>
      </div>
      <Field label="Supplier">
        <Select name="supplierId" defaultValue={defaultValues?.supplierId ?? ""}>
          <option value="">- Pilih Supplier -</option>
          {suppliers.map((s) => (
            <option key={s.id} value={s.id}>
              {s.name}
            </option>
          ))}
          {defaultValues?.supplierId && !suppliers.some((s) => s.id === defaultValues.supplierId) ? (
            <option value={defaultValues.supplierId}>{defaultValues.supplierName ?? "Supplier saat ini"}</option>
          ) : null}
        </Select>
      </Field>
      <div className="grid grid-cols-2 gap-3">
        <Field label="Harga / Unit (Rp)">
          <Input
            name="pricePerUnit"
            type="number"
            min={0}
            required
            defaultValue={defaultValues ? Number(defaultValues.pricePerUnit) : 0}
          />
        </Field>
        <Field label="Stok Minimum">
          <Input
            name="minStockQty"
            type="number"
            min={0}
            defaultValue={defaultValues ? Number(defaultValues.minStockQty) : 0}
          />
        </Field>
      </div>
      {defaultValues ? (
        <p className="text-xs text-gray-400">Stok tetap diubah lewat tombol Adjust.</p>
      ) : null}
      <SubmitButton>{submitLabel}</SubmitButton>
    </form>
  );
}

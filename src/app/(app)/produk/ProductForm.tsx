import { Field, Input, Select, SubmitButton, TextArea } from "@/components/ui/FormField";

const CATEGORY_OPTIONS = ["BOX", "FOLDING_CARTON", "BROCHURE", "PAPER_BAG", "STICKER", "WOBBLER", "CUSTOM"];

export type ProductFormValues = {
  id: string;
  code: string;
  name: string;
  category: string;
  categoryId: string | null;
  categoryName?: string | null;
  unit: string;
  defaultMaterialId: string | null;
  defaultMaterialName?: string | null;
  specification: string | null;
  isActive: boolean;
};

export function ProductForm({
  action,
  categories,
  materials,
  submitLabel,
  defaultValues,
}: {
  action: (formData: FormData) => void | Promise<void>;
  categories: { id: string; name: string }[];
  materials: { id: string; name: string }[];
  submitLabel: string;
  defaultValues?: ProductFormValues;
}) {
  const categoryOptions = CATEGORY_OPTIONS.includes(defaultValues?.category ?? "")
    ? CATEGORY_OPTIONS
    : defaultValues?.category
      ? [defaultValues.category, ...CATEGORY_OPTIONS]
      : CATEGORY_OPTIONS;

  return (
    <form action={action} className="space-y-3">
      {defaultValues ? <input type="hidden" name="productId" value={defaultValues.id} /> : null}
      {defaultValues ? (
        <Field label="Kode">
          <Input name="code" required defaultValue={defaultValues.code} placeholder="PRD-2026-00001" />
        </Field>
      ) : null}
      <Field label="Nama Produk">
        <Input name="name" required defaultValue={defaultValues?.name} placeholder="Custom Food Packaging Box" />
      </Field>
      <div className="grid grid-cols-2 gap-3">
        <Field label="Kategori (legacy)">
          <Select name="category" defaultValue={defaultValues?.category ?? "BOX"}>
            {categoryOptions.map((c) => (
              <option key={c} value={c}>
                {c.replaceAll("_", " ")}
              </option>
            ))}
          </Select>
        </Field>
        <Field label="Unit">
          <Input name="unit" required defaultValue={defaultValues?.unit ?? "PCS"} />
        </Field>
      </div>
      <Field label="Kategori Produk (Master Kategori)">
        <Select name="categoryId" defaultValue={defaultValues?.categoryId ?? ""}>
          <option value="">- Tanpa Kategori Master -</option>
          {categories.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
          {defaultValues?.categoryId && !categories.some((c) => c.id === defaultValues.categoryId) ? (
            <option value={defaultValues.categoryId}>{defaultValues.categoryName ?? "Kategori saat ini"}</option>
          ) : null}
        </Select>
      </Field>
      <Field label="Material Default">
        <Select name="defaultMaterialId" defaultValue={defaultValues?.defaultMaterialId ?? ""}>
          <option value="">- Pilih Material -</option>
          {materials.map((m) => (
            <option key={m.id} value={m.id}>
              {m.name}
            </option>
          ))}
          {defaultValues?.defaultMaterialId && !materials.some((m) => m.id === defaultValues.defaultMaterialId) ? (
            <option value={defaultValues.defaultMaterialId}>
              {defaultValues.defaultMaterialName ?? "Material saat ini"}
            </option>
          ) : null}
        </Select>
      </Field>
      <Field label="Spesifikasi">
        <TextArea
          name="specification"
          rows={2}
          defaultValue={defaultValues?.specification ?? ""}
          placeholder="Sesuai artwork customer"
        />
      </Field>
      {defaultValues ? (
        <Field label="Status">
          <Select name="isActive" defaultValue={defaultValues.isActive ? "true" : "false"}>
            <option value="true">Aktif</option>
            <option value="false">Nonaktif</option>
          </Select>
        </Field>
      ) : null}
      <SubmitButton>{submitLabel}</SubmitButton>
    </form>
  );
}

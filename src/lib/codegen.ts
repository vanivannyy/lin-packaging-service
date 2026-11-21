import { prisma } from "@/lib/prisma";

type CodeModel =
  | "lead"
  | "customer"
  | "quotation"
  | "salesOrder"
  | "workOrder"
  | "invoice"
  | "purchaseRequest"
  | "user"
  | "material"
  | "product"
  | "supplier"
  | "productCategory"
  | "deliveryOrder"
  | "designMaster";

const DEFAULT_PREFIX: Record<CodeModel, string> = {
  lead: "LEAD",
  customer: "CUS",
  quotation: "QT",
  salesOrder: "SO",
  workOrder: "WO",
  invoice: "INV",
  purchaseRequest: "PR",
  user: "USR",
  material: "MTR",
  product: "PRD",
  supplier: "SUP",
  productCategory: "CAT",
  deliveryOrder: "DO",
  designMaster: "DSG",
};

async function getPrefix(model: CodeModel): Promise<string> {
  const settings = await prisma.companySettings.findFirst();
  if (!settings) return DEFAULT_PREFIX[model];

  switch (model) {
    case "quotation":
      return settings.quotationPrefix;
    case "salesOrder":
      return settings.salesOrderPrefix;
    case "workOrder":
      return settings.workOrderPrefix;
    case "invoice":
      return settings.invoicePrefix;
    case "customer":
      return settings.customerPrefix;
    case "lead":
      return settings.leadPrefix;
    case "productCategory":
      return settings.productCategoryPrefix;
    case "deliveryOrder":
      return settings.deliveryOrderPrefix;
    case "designMaster":
      return settings.designPrefix;
    default:
      return DEFAULT_PREFIX[model];
  }
}

// Nomor terakhir yang sudah terpakai pada tahun berjalan (dibaca dari kode terbesar; kode berpadding 5 digit
// sehingga urutan leksikografis = urutan numerik). Dipakai hanya untuk menyemai counter baru.
async function lastUsedSequence(model: CodeModel, yearPrefix: string): Promise<number> {
  const where = { startsWith: yearPrefix };
  const pick = (row: { code?: string; sku?: string } | null) => {
    const code = row?.code ?? row?.sku;
    const n = code ? Number.parseInt(code.slice(yearPrefix.length), 10) : 0;
    return Number.isFinite(n) ? n : 0;
  };
  switch (model) {
    case "lead": return pick(await prisma.lead.findFirst({ where: { code: where }, orderBy: { code: "desc" } }));
    case "customer": return pick(await prisma.customer.findFirst({ where: { code: where }, orderBy: { code: "desc" } }));
    case "quotation": return pick(await prisma.quotation.findFirst({ where: { code: where }, orderBy: { code: "desc" } }));
    case "salesOrder": return pick(await prisma.salesOrder.findFirst({ where: { code: where }, orderBy: { code: "desc" } }));
    case "workOrder": return pick(await prisma.workOrder.findFirst({ where: { code: where }, orderBy: { code: "desc" } }));
    case "invoice": return pick(await prisma.invoice.findFirst({ where: { code: where }, orderBy: { code: "desc" } }));
    case "purchaseRequest": return pick(await prisma.purchaseRequest.findFirst({ where: { code: where }, orderBy: { code: "desc" } }));
    case "user": return pick(await prisma.user.findFirst({ where: { code: where }, orderBy: { code: "desc" } }));
    case "material": return pick(await prisma.material.findFirst({ where: { sku: where }, orderBy: { sku: "desc" } }));
    case "product": return pick(await prisma.product.findFirst({ where: { code: where }, orderBy: { code: "desc" } }));
    case "supplier": return pick(await prisma.supplier.findFirst({ where: { code: where }, orderBy: { code: "desc" } }));
    case "productCategory": return pick(await prisma.productCategory.findFirst({ where: { code: where }, orderBy: { code: "desc" } }));
    case "deliveryOrder": return pick(await prisma.deliveryOrder.findFirst({ where: { code: where }, orderBy: { code: "desc" } }));
    case "designMaster": return pick(await prisma.designMaster.findFirst({ where: { code: where }, orderBy: { code: "desc" } }));
  }
}

// Generate kode berformat PREFIX-YYYY-00001. Sequence diambil dari tabel DocumentCounter dengan
// UPDATE ... RETURNING atomik, sehingga dua request bersamaan tidak mendapat nomor yang sama.
export async function generateCode(model: CodeModel): Promise<string> {
  const year = new Date().getFullYear();
  const prefix = await getPrefix(model);
  const yearPrefix = `${prefix}-${year}-`;

  // Semai counter dari kode terbesar yang sudah ada (sekali per prefix-tahun; konkuren aman: DO NOTHING).
  const seeded = await prisma.documentCounter.findUnique({ where: { key: yearPrefix } });
  if (!seeded) {
    const last = await lastUsedSequence(model, yearPrefix);
    await prisma.$executeRaw`
      INSERT INTO "DocumentCounter" ("key", "value", "updatedAt")
      VALUES (${yearPrefix}, ${last}, NOW())
      ON CONFLICT ("key") DO NOTHING`;
  }

  const rows = await prisma.$queryRaw<{ value: number }[]>`
    UPDATE "DocumentCounter"
    SET "value" = "value" + 1, "updatedAt" = NOW()
    WHERE "key" = ${yearPrefix}
    RETURNING "value"`;
  const sequence = rows[0].value.toString().padStart(5, "0");
  return `${yearPrefix}${sequence}`;
}

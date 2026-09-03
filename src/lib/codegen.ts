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

// Generate kode berformat PREFIX-YYYY-00001, sequence berdasarkan jumlah baris tahun berjalan.
export async function generateCode(model: CodeModel): Promise<string> {
  const year = new Date().getFullYear();
  const prefix = await getPrefix(model);
  const yearPrefix = `${prefix}-${year}-`;

  const countFns: Record<CodeModel, () => Promise<number>> = {
    lead: () => prisma.lead.count({ where: { code: { startsWith: yearPrefix } } }),
    customer: () => prisma.customer.count({ where: { code: { startsWith: yearPrefix } } }),
    quotation: () => prisma.quotation.count({ where: { code: { startsWith: yearPrefix } } }),
    salesOrder: () => prisma.salesOrder.count({ where: { code: { startsWith: yearPrefix } } }),
    workOrder: () => prisma.workOrder.count({ where: { code: { startsWith: yearPrefix } } }),
    invoice: () => prisma.invoice.count({ where: { code: { startsWith: yearPrefix } } }),
    purchaseRequest: () => prisma.purchaseRequest.count({ where: { code: { startsWith: yearPrefix } } }),
    user: () => prisma.user.count({ where: { code: { startsWith: yearPrefix } } }),
    material: () => prisma.material.count({ where: { sku: { startsWith: yearPrefix } } }),
    product: () => prisma.product.count({ where: { code: { startsWith: yearPrefix } } }),
    supplier: () => prisma.supplier.count({ where: { code: { startsWith: yearPrefix } } }),
    productCategory: () => prisma.productCategory.count({ where: { code: { startsWith: yearPrefix } } }),
    deliveryOrder: () => prisma.deliveryOrder.count({ where: { code: { startsWith: yearPrefix } } }),
    designMaster: () => prisma.designMaster.count({ where: { code: { startsWith: yearPrefix } } }),
  };

  const existing = await countFns[model]();
  const sequence = (existing + 1).toString().padStart(5, "0");
  return `${yearPrefix}${sequence}`;
}

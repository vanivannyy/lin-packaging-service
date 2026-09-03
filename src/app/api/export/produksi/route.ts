import ExcelJS from "exceljs";
import { prisma } from "@/lib/prisma";
import { denyIfNoModule } from "@/lib/require-session";
import { PROCESS_LABEL, WO_STAGE_LABEL } from "@/lib/labels";

export async function GET() {
  const denied = await denyIfNoModule("produksi");
  if (denied) return denied;
  const workOrders = await prisma.workOrder.findMany({
    where: { isDeleted: false },
    include: { salesOrder: { include: { customer: true, product: true } } },
    orderBy: { code: "desc" },
  });

  const workbook = new ExcelJS.Workbook();
  const sheet = workbook.addWorksheet("Papan Produksi");
  sheet.columns = [
    { header: "No WO", key: "code", width: 16 },
    { header: "Customer", key: "customer", width: 28 },
    { header: "Produk", key: "product", width: 26 },
    { header: "Qty", key: "qty", width: 10 },
    { header: "Stage", key: "stage", width: 16 },
    { header: "Proses", key: "process", width: 14 },
    { header: "Progress (%)", key: "progress", width: 12 },
    { header: "Deadline", key: "deadline", width: 14 },
  ];
  sheet.getRow(1).font = { bold: true };

  workOrders.forEach((wo) => {
    sheet.addRow({
      code: wo.code,
      customer: wo.salesOrder.customer.name,
      product: wo.salesOrder.product?.name ?? wo.salesOrder.productNote ?? "-",
      qty: wo.salesOrder.qty,
      stage: WO_STAGE_LABEL[wo.stage] ?? wo.stage,
      process: PROCESS_LABEL[wo.process] ?? wo.process,
      progress: wo.progressPercent,
      deadline: wo.deadline ? wo.deadline.toISOString().slice(0, 10) : "-",
    });
  });

  const buffer = await workbook.xlsx.writeBuffer();
  return new Response(buffer, {
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename="papan-produksi-${Date.now()}.xlsx"`,
    },
  });
}

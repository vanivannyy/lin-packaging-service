import ExcelJS from "exceljs";
import { prisma } from "@/lib/prisma";
import { denyIfNoModule } from "@/lib/require-session";

export async function GET() {
  const denied = await denyIfNoModule("sales-order");
  if (denied) return denied;
  const salesOrders = await prisma.salesOrder.findMany({
    where: { isDeleted: false },
    include: { customer: true, product: true, quotation: true },
    orderBy: { code: "desc" },
  });

  const workbook = new ExcelJS.Workbook();
  const sheet = workbook.addWorksheet("Sales Order");
  sheet.columns = [
    { header: "No SO", key: "code", width: 16 },
    { header: "Quotation", key: "quotation", width: 16 },
    { header: "Tanggal", key: "date", width: 14 },
    { header: "Customer", key: "customer", width: 28 },
    { header: "Produk", key: "product", width: 26 },
    { header: "Qty", key: "qty", width: 10 },
    { header: "Nilai", key: "total", width: 16 },
    { header: "Margin (%)", key: "margin", width: 12 },
    { header: "Status", key: "status", width: 16 },
  ];
  sheet.getRow(1).font = { bold: true };

  salesOrders.forEach((so) => {
    sheet.addRow({
      code: so.code,
      quotation: so.quotation?.code ?? "-",
      date: so.date.toISOString().slice(0, 10),
      customer: so.customer.name,
      product: so.product?.name ?? so.productNote ?? "-",
      qty: so.qty,
      total: Number(so.totalAmount),
      margin: Number(so.marginPercent),
      status: so.status,
    });
  });

  const buffer = await workbook.xlsx.writeBuffer();
  return new Response(buffer, {
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename="sales-order-${Date.now()}.xlsx"`,
    },
  });
}

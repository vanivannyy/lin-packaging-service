import ExcelJS from "exceljs";
import { prisma } from "@/lib/prisma";
import { denyIfNoModule } from "@/lib/require-session";

export async function GET() {
  const denied = await denyIfNoModule("quotation");
  if (denied) return denied;
  const quotations = await prisma.quotation.findMany({
    where: { isDeleted: false },
    include: { customer: true, product: true, sales: true },
    orderBy: { code: "desc" },
  });

  const workbook = new ExcelJS.Workbook();
  const sheet = workbook.addWorksheet("Quotation");
  sheet.columns = [
    { header: "No", key: "code", width: 16 },
    { header: "Tanggal", key: "date", width: 14 },
    { header: "Customer", key: "customer", width: 28 },
    { header: "Produk", key: "product", width: 26 },
    { header: "Qty", key: "qty", width: 10 },
    { header: "HPP", key: "hpp", width: 16 },
    { header: "Nilai", key: "total", width: 16 },
    { header: "Margin (%)", key: "margin", width: 12 },
    { header: "Sales", key: "sales", width: 18 },
    { header: "Status", key: "status", width: 12 },
  ];
  sheet.getRow(1).font = { bold: true };

  quotations.forEach((q) => {
    sheet.addRow({
      code: q.code,
      date: q.date.toISOString().slice(0, 10),
      customer: q.customer?.name ?? "-",
      product: q.product?.name ?? q.productNote ?? "-",
      qty: q.qty,
      hpp: Number(q.hppAmount),
      total: Number(q.totalAmount),
      margin: Number(q.marginPercent),
      sales: q.sales?.name ?? "-",
      status: q.status,
    });
  });

  const buffer = await workbook.xlsx.writeBuffer();
  return new Response(buffer, {
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename="quotation-${Date.now()}.xlsx"`,
    },
  });
}

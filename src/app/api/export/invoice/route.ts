import ExcelJS from "exceljs";
import { prisma } from "@/lib/prisma";
import { denyIfNoModule } from "@/lib/require-session";

export async function GET() {
  const denied = await denyIfNoModule("invoice");
  if (denied) return denied;
  const invoices = await prisma.invoice.findMany({
    where: { isDeleted: false },
    include: { customer: true },
    orderBy: { code: "desc" },
  });

  const workbook = new ExcelJS.Workbook();
  const sheet = workbook.addWorksheet("Invoice");
  sheet.columns = [
    { header: "No Invoice", key: "code", width: 16 },
    { header: "Tanggal", key: "date", width: 14 },
    { header: "Jatuh Tempo", key: "due", width: 14 },
    { header: "Customer", key: "customer", width: 28 },
    { header: "Total", key: "total", width: 16 },
    { header: "Dibayar", key: "paid", width: 16 },
    { header: "Status", key: "status", width: 12 },
  ];
  sheet.getRow(1).font = { bold: true };

  invoices.forEach((inv) => {
    sheet.addRow({
      code: inv.code,
      date: inv.issuedAt.toISOString().slice(0, 10),
      due: inv.dueDate ? inv.dueDate.toISOString().slice(0, 10) : "-",
      customer: inv.customer.name,
      total: Number(inv.totalAmount),
      paid: Number(inv.paidAmount),
      status: inv.status,
    });
  });

  const buffer = await workbook.xlsx.writeBuffer();
  return new Response(buffer, {
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename="invoice-${Date.now()}.xlsx"`,
    },
  });
}

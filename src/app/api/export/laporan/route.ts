import ExcelJS from "exceljs";
import { NextRequest } from "next/server";
import { getReportByCustomer, getReportByProduct, getReportBySales } from "@/server/laporan";
import { denyIfNoModule } from "@/lib/require-session";

export async function GET(request: NextRequest) {
  const denied = await denyIfNoModule("laporan");
  if (denied) return denied;
  const view = request.nextUrl.searchParams.get("view") ?? "customer";
  const rows =
    view === "produk" ? await getReportByProduct() : view === "sales" ? await getReportBySales() : await getReportByCustomer();

  const workbook = new ExcelJS.Workbook();
  const sheet = workbook.addWorksheet("Laporan");
  sheet.columns = [
    { header: "Nama", key: "name", width: 30 },
    { header: "Jumlah Order", key: "orderCount", width: 14 },
    { header: "Revenue", key: "revenue", width: 18 },
    { header: "Gross Profit", key: "grossProfit", width: 18 },
    { header: "Margin (%)", key: "margin", width: 12 },
  ];
  sheet.getRow(1).font = { bold: true };
  rows.forEach((r) => sheet.addRow(r));

  const buffer = await workbook.xlsx.writeBuffer();
  return new Response(buffer, {
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename="laporan-${view}-${Date.now()}.xlsx"`,
    },
  });
}

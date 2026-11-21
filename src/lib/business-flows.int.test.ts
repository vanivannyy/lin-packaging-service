import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { prisma } from "@/lib/prisma";
import { generateCode } from "@/lib/codegen";
import { ensureInvoiceForSalesOrder } from "@/lib/invoice";
import { addBomLine, consumeBomForSalesOrder, releaseBomForSalesOrder } from "@/lib/material-reservation";
import { recordInvoicePayment } from "@/lib/payment";
import { recordDeliveryOut } from "@/lib/client-stock";
import { requireMobileSession, signMobileToken } from "@/lib/mobile-auth";

const run = Date.now().toString(36);
let userId: string;
let customerId: string;
let materialId: string;

async function makeSalesOrder(qty = 100) {
  return prisma.salesOrder.create({
    data: { code: await generateCode("salesOrder"), customerId, qty, status: "MATERIAL_CHECK", productNote: `Item ${run}` },
  });
}

beforeAll(async () => {
  const user = await prisma.user.create({
    data: { code: await generateCode("user"), name: "Tester", email: `t-${run}@test.local`, passwordHash: "x", role: "OWNER" },
  });
  userId = user.id;
  const customer = await prisma.customer.create({
    data: { code: await generateCode("customer"), name: `Cust ${run}`, term: "NET_45" },
  });
  customerId = customer.id;
  const material = await prisma.material.create({
    data: { sku: `MTR-T-${run}`, name: "Kertas Test", stockQty: 1000, reservedQty: 0 },
  });
  materialId = material.id;
});

afterAll(async () => {
  await prisma.$disconnect();
});

describe("generateCode", () => {
  it("menghasilkan kode unik untuk 20 request paralel", async () => {
    const codes = await Promise.all(Array.from({ length: 20 }, () => generateCode("salesOrder")));
    expect(new Set(codes).size).toBe(20);
  });
});

describe("invoice", () => {
  it("idempoten dan jatuh tempo mengikuti term customer (NET_45)", async () => {
    const so = await makeSalesOrder();
    const [a, b] = await Promise.all([ensureInvoiceForSalesOrder(so.id), ensureInvoiceForSalesOrder(so.id)]);
    const count = await prisma.invoice.count({ where: { salesOrderId: so.id } });
    expect(count).toBe(1);
    expect(a.status).toBe("UNPAID");
    const days = Math.round((a.dueDate!.getTime() - Date.now()) / 86_400_000);
    expect(days).toBe(45);
    expect(b.id).toBe(a.id);
  });
});

describe("BOM material", () => {
  it("reserve -> consume mengurangi stok & reservasi, consume kedua tidak menggandakan", async () => {
    const before = await prisma.material.findUniqueOrThrow({ where: { id: materialId } });
    const so = await makeSalesOrder();
    await addBomLine({ salesOrderId: so.id, line: { materialId, qty: 50, source: "MANUAL" }, userId });

    const reserved = await prisma.material.findUniqueOrThrow({ where: { id: materialId } });
    expect(Number(reserved.reservedQty) - Number(before.reservedQty)).toBe(50);

    await Promise.all([consumeBomForSalesOrder(so.id, userId), consumeBomForSalesOrder(so.id, userId)]);
    const after = await prisma.material.findUniqueOrThrow({ where: { id: materialId } });
    expect(Number(before.stockQty) - Number(after.stockQty)).toBe(50);
    expect(Number(after.reservedQty)).toBe(Number(before.reservedQty));
  });

  it("release mengembalikan reservasi", async () => {
    const before = await prisma.material.findUniqueOrThrow({ where: { id: materialId } });
    const so = await makeSalesOrder();
    await addBomLine({ salesOrderId: so.id, line: { materialId, qty: 30, source: "MANUAL" }, userId });
    await releaseBomForSalesOrder(so.id, userId);
    const after = await prisma.material.findUniqueOrThrow({ where: { id: materialId } });
    expect(Number(after.reservedQty)).toBe(Number(before.reservedQty));
    expect(Number(after.stockQty)).toBe(Number(before.stockQty));
  });
});

describe("stok klien", () => {
  it("pengiriman keluar tidak membuat stok gudang negatif", async () => {
    const so = await makeSalesOrder(500); // stok gudang masih 0
    const item = await recordDeliveryOut(so.id, "DO-TEST");
    expect(Number(item.linWarehouseQty)).toBe(0);
    const moves = await prisma.clientStockMovement.findMany({ where: { itemId: item.id } });
    expect(moves.every((m) => Number(m.resultingQty) >= 0)).toBe(true);
  });
});

describe("revokasi token", () => {
  it("token ditolak setelah tokenVersion naik", async () => {
    const user = await prisma.user.findUniqueOrThrow({ where: { id: userId } });
    const token = await signMobileToken({
      userId: user.id, code: user.code, name: user.name, email: user.email, role: user.role, tv: user.tokenVersion,
    });
    const req = () => new Request("http://x/api", { headers: { Authorization: `Bearer ${token}` } });

    expect(await requireMobileSession(req())).not.toBeInstanceOf(Response);

    await prisma.user.update({ where: { id: userId }, data: { tokenVersion: { increment: 1 } } });
    const res = await requireMobileSession(req());
    expect(res).toBeInstanceOf(Response);
    expect((res as Response).status).toBe(401);
  });
});

describe("pembayaran invoice", () => {
  async function makeInvoice(total: number) {
    const so = await prisma.salesOrder.create({
      data: { code: await generateCode("salesOrder"), customerId, qty: 1, totalAmount: total, status: "DELIVERED" },
    });
    return ensureInvoiceForSalesOrder(so.id);
  }

  it("parsial lalu lunas, dan menolak overpayment serta invoice lunas", async () => {
    const inv = await makeInvoice(1000);
    const p1 = await recordInvoicePayment({ invoiceId: inv.id, amount: 400, method: "CASH" });
    expect(p1.newStatus).toBe("PARTIAL");
    await expect(recordInvoicePayment({ invoiceId: inv.id, amount: 700, method: "CASH" })).rejects.toThrow(/melebihi/);
    const p2 = await recordInvoicePayment({ invoiceId: inv.id, amount: 600, method: "TRANSFER" });
    expect(p2.newStatus).toBe("PAID");
    await expect(recordInvoicePayment({ invoiceId: inv.id, amount: 1, method: "CASH" })).rejects.toThrow(/lunas/);
  });

  it("dua pembayaran bersamaan tidak membuat total terbayar melebihi tagihan", async () => {
    const inv = await makeInvoice(1000);
    const results = await Promise.allSettled([
      recordInvoicePayment({ invoiceId: inv.id, amount: 800, method: "CASH" }),
      recordInvoicePayment({ invoiceId: inv.id, amount: 800, method: "CASH" }),
    ]);
    expect(results.filter((r) => r.status === "fulfilled").length).toBe(1);
    const after = await prisma.invoice.findUniqueOrThrow({ where: { id: inv.id } });
    expect(Number(after.paidAmount)).toBe(800);
    expect(await prisma.payment.count({ where: { invoiceId: inv.id } })).toBe(1);
  });
});

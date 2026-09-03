import { prisma } from "@/lib/prisma";
import { PageHeader } from "@/components/ui/PageHeader";
import { StatCard } from "@/components/ui/StatCard";
import { DeliveryKanbanBoard } from "./DeliveryKanbanBoard";
import { requireModule } from "@/lib/require-session";

export default async function DeliveryPage() {
  await requireModule("delivery");

  const [deliveries, ready, inDelivery, pending, delivered] = await Promise.all([
    prisma.deliveryOrder.findMany({
      where: { isDeleted: false },
      include: {
        salesOrder: { include: { customer: true, product: true, quotation: true } },
      },
      orderBy: { createdAt: "desc" },
    }),
    prisma.deliveryOrder.count({ where: { isDeleted: false, stage: "READY" } }),
    prisma.deliveryOrder.count({ where: { isDeleted: false, stage: "IN_DELIVERY" } }),
    prisma.deliveryOrder.count({ where: { isDeleted: false, stage: "PENDING" } }),
    prisma.deliveryOrder.count({ where: { isDeleted: false, stage: "DELIVERED" } }),
  ]);

  const cards = deliveries.map((d) => ({
    id: d.id,
    code: d.code,
    stage: d.stage,
    note: d.note,
    deliveredAt: d.deliveredAt ? d.deliveredAt.toISOString() : null,
    createdAt: d.createdAt.toISOString(),
    soCode: d.salesOrder.code,
    customerName: d.salesOrder.customer.name,
    productName: d.salesOrder.product?.name ?? d.salesOrder.productNote ?? "-",
    qty: d.salesOrder.qty,
    requestedDeliveryDate: d.salesOrder.requestedDeliveryDate
      ? d.salesOrder.requestedDeliveryDate.toISOString()
      : d.salesOrder.quotation?.requestedDeliveryDate?.toISOString() ?? null,
  }));

  return (
    <div>
      <PageHeader eyebrow="Distribusi" title="Papan Pengiriman (Delivery)" />

      <div className="mb-5 grid grid-cols-2 gap-3 md:grid-cols-4">
        <StatCard label="Ready" value={ready} valueColor="blue" />
        <StatCard label="In Delivery" value={inDelivery} valueColor="blue" />
        <StatCard label="Pending" value={pending} valueColor="red" />
        <StatCard label="Delivered" value={delivered} valueColor="green" />
      </div>

      <p className="mb-3 -mt-2 text-xs text-gray-400">
        Geser (drag) kartu pengiriman antar kolom. Pindah ke Pending wajib mengisi catatan alasan tertunda.
      </p>

      <DeliveryKanbanBoard deliveries={cards} />
    </div>
  );
}

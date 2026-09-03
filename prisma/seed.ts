import { PrismaClient, type UserRole, type LeadStage, type CustomerTerm, type QuotationStatus, type SalesOrderStatus, type WorkOrderStage, type WorkOrderProcess, type PurchaseRequestStatus, type InvoiceStatus, type MaterialCategory, type PriceMasterCategory } from "@prisma/client";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();

function code(prefix: string, seq: number) {
  return `${prefix}-2026-${seq.toString().padStart(5, "0")}`;
}

async function main() {
  console.log("Membersihkan data lama...");
  await prisma.payment.deleteMany();
  await prisma.invoice.deleteMany();
  await prisma.deliveryOrder.deleteMany();
  await prisma.workOrder.deleteMany();
  await prisma.salesOrder.deleteMany();
  await prisma.quotation.deleteMany();
  await prisma.purchaseRequest.deleteMany();
  await prisma.stockMovement.deleteMany();
  await prisma.auditTrail.deleteMany();
  await prisma.dailyRecapLog.deleteMany();
  await prisma.customer.deleteMany();
  await prisma.lead.deleteMany();
  await prisma.designMaster.deleteMany();
  await prisma.product.deleteMany();
  await prisma.productCategory.deleteMany();
  await prisma.material.deleteMany();
  await prisma.supplier.deleteMany();
  await prisma.priceMasterItem.deleteMany();
  await prisma.user.deleteMany();
  await prisma.companySettings.deleteMany();

  console.log("Seeding company settings...");
  await prisma.companySettings.create({
    data: {
      companyName: "PT Lin Packaging Jakarta",
      address: "Jl. Kepu Barat no.26-K, RT.1/RW.2, Kemayoran, Jakarta Pusat, DKI Jakarta, 10620",
      phone: "08111-777-855",
      email: "info@lin-packaging.com",
      website: "lin-packaging.com",
      taxId: "01.234.567.8-091.000",
      bankName: "Bank Central Asia",
      bankAccountNo: "123-456-7890",
      bankAccountName: "PT Lin Packaging Jakarta",
      dailyRecapEmail: "delivered@resend.dev",
    },
  });

  console.log("Seeding users...");
  const passwordHash = await bcrypt.hash("password123", 10);
  const userSeed: Array<{ code: string; name: string; email: string; department: string; position: string; role: UserRole }> = [
    { code: code("USR", 1), name: "Budi Santoso", email: "owner@lin-packaging.com", department: "Direksi", position: "Owner", role: "OWNER" },
    { code: code("USR", 3), name: "Andi Wijaya", email: "salesmanager@lin-packaging.com", department: "Sales", position: "Sales Manager", role: "SALES_MANAGER" },
    { code: code("USR", 4), name: "Dewi Lestari", email: "sales@lin-packaging.com", department: "Sales", position: "Sales Executive", role: "SALES" },
    { code: code("USR", 6), name: "Joko Prasetyo", email: "gudang@lin-packaging.com", department: "Gudang", position: "Warehouse Staff", role: "WAREHOUSE" },
    { code: code("USR", 7), name: "Rina Marlina", email: "purchasing@lin-packaging.com", department: "Purchasing", position: "Purchasing Officer", role: "PURCHASING" },
    { code: code("USR", 8), name: "Hendra Gunawan", email: "finance@lin-packaging.com", department: "Keuangan", position: "Finance Manager", role: "FINANCE" },
    { code: code("USR", 5), name: "Rudi Hartono", email: "planner@lin-packaging.com", department: "Produksi", position: "Production Planner", role: "PRODUCTION_PLANNER" },
    { code: code("USR", 9), name: "Siti Nurhaliza", email: "qc@lin-packaging.com", department: "Produksi", position: "QC Staff", role: "QC" },
  ];
  const users = await Promise.all(
    userSeed.map((u) => prisma.user.create({ data: { ...u, passwordHash, lastLoginAt: new Date() } }))
  );
  const owner = users.find((u) => u.role === "OWNER")!;
  const salesManager = users.find((u) => u.role === "SALES_MANAGER")!;
  const sales = users.find((u) => u.role === "SALES")!;
  const purchasing = users.find((u) => u.role === "PURCHASING")!;

  console.log("Seeding suppliers...");
  const supplierSeed = [
    "PT Kertas Mulia Abadi",
    "CV Sumber Kertas Jaya",
    "PT Foil Prima Indah",
    "PT Laminasi Cemerlang",
    "CV Emboss Kreasi",
    "CV Spot UV Mandiri",
    "CV Pond Sejahtera",
    "PT Kraft Indo Perkasa",
  ];
  const suppliers = await Promise.all(
    supplierSeed.map((name, i) => prisma.supplier.create({ data: { code: code("SUP", i + 1), name } }))
  );
  const supplierByName = (name: string) => suppliers.find((s) => s.name === name)!;

  console.log("Seeding materials...");
  const materialSeed: Array<{
    name: string;
    category: MaterialCategory;
    gsm?: number;
    size?: string;
    supplier: string;
    price: number;
    unit: string;
    stock: number;
    reserved: number;
    min: number;
  }> = [
    { name: "Art Carton 260 GSM", category: "PAPER", gsm: 260, size: "65x100 cm", supplier: "PT Kertas Mulia Abadi", price: 2900, unit: "LEMBAR", stock: 6800, reserved: 6800, min: 2000 },
    { name: "Art Paper 150 GSM", category: "PAPER", gsm: 150, size: "65x100 cm", supplier: "CV Sumber Kertas Jaya", price: 1500, unit: "LEMBAR", stock: 14900, reserved: 14900, min: 3000 },
    { name: "Duplex 350 GSM", category: "PAPER", gsm: 350, size: "79x109 cm", supplier: "CV Sumber Kertas Jaya", price: 3100, unit: "LEMBAR", stock: 1870, reserved: 1870, min: 2500 },
    { name: "Film Laminating Glossy", category: "FILM", size: "640mm x 3000m", supplier: "PT Laminasi Cemerlang", price: 890000, unit: "ROLL", stock: 6, reserved: 1, min: 4 },
    { name: "Foil Gold Roll", category: "FOIL", size: "640mm x 120m", supplier: "PT Foil Prima Indah", price: 1250000, unit: "ROLL", stock: 6, reserved: 0, min: 3 },
    { name: "Ivory 300 GSM", category: "PAPER", gsm: 300, size: "79x109 cm", supplier: "PT Kertas Mulia Abadi", price: 3800, unit: "LEMBAR", stock: 8750, reserved: 1600, min: 3000 },
    { name: "Ivory 350 GSM", category: "PAPER", gsm: 350, size: "79x109 cm", supplier: "PT Kertas Mulia Abadi", price: 4200, unit: "LEMBAR", stock: 5200, reserved: 900, min: 2000 },
    { name: "Kraft 250 GSM", category: "PAPER", gsm: 250, size: "79x109 cm", supplier: "PT Kraft Indo Perkasa", price: 2600, unit: "LEMBAR", stock: 9100, reserved: 3000, min: 3000 },
    { name: "Ivory 250 GSM", category: "PAPER", gsm: 250, size: "65x100 cm", supplier: "PT Kertas Mulia Abadi", price: 3200, unit: "LEMBAR", stock: 4600, reserved: 500, min: 2500 },
    { name: "Duplex 400 GSM", category: "PAPER", gsm: 400, size: "79x109 cm", supplier: "CV Sumber Kertas Jaya", price: 3600, unit: "LEMBAR", stock: 3100, reserved: 400, min: 2000 },
  ];
  const materials = await Promise.all(
    materialSeed.map((m, i) =>
      prisma.material.create({
        data: {
          sku: code("MTR", i + 1),
          name: m.name,
          category: m.category,
          gsm: m.gsm,
          size: m.size,
          supplierId: supplierByName(m.supplier).id,
          pricePerUnit: m.price,
          unit: m.unit,
          stockQty: m.stock,
          reservedQty: m.reserved,
          minStockQty: m.min,
        },
      })
    )
  );
  const materialByName = (name: string) => materials.find((m) => m.name === name)!;

  console.log("Seeding price master...");
  const priceMasterSeed: Array<{ category: PriceMasterCategory; name: string; vendor: string; unit: string; minQty: number; price: number }> = [
    { category: "FINISHING", name: "Emboss / Deboss", vendor: "CV Emboss Kreasi", unit: "LEMBAR", minQty: 500, price: 420 },
    { category: "FINISHING", name: "Folding Manual", vendor: "Internal", unit: "PCS", minQty: 1000, price: 60 },
    { category: "FINISHING", name: "Hot Print Foil", vendor: "PT Foil Prima Indah", unit: "LEMBAR", minQty: 500, price: 650 },
    { category: "FINISHING", name: "Laminating Doff", vendor: "Internal", unit: "LEMBAR", minQty: 500, price: 350 },
    { category: "FINISHING", name: "Laminating Glossy", vendor: "Internal", unit: "LEMBAR", minQty: 500, price: 320 },
    { category: "FINISHING", name: "Lem / Glue Box", vendor: "Internal", unit: "PCS", minQty: 1000, price: 95 },
    { category: "FINISHING", name: "Pond / Die Cutting", vendor: "Internal", unit: "LEMBAR", minQty: 1000, price: 180 },
    { category: "FINISHING", name: "Spot UV", vendor: "CV Spot UV Mandiri", unit: "LEMBAR", minQty: 500, price: 480 },
    { category: "LABOR", name: "Tenaga Finishing Manual", vendor: "Internal", unit: "PCS", minQty: 1000, price: 45 },
    { category: "OUTSOURCING", name: "Jasa Pond Luar", vendor: "CV Pond Sejahtera", unit: "LEMBAR", minQty: 1000, price: 210 },
    { category: "OVERHEAD", name: "Overhead Produksi (%)", vendor: "Internal", unit: "PERSEN", minQty: 0, price: 8 },
    { category: "PAPER", name: "Duplex 350 GSM 79x109", vendor: "CV Sumber Kertas Jaya", unit: "LEMBAR", minQty: 1000, price: 3100 },
    { category: "PAPER", name: "Ivory 300 GSM 79x109", vendor: "PT Kertas Mulia Abadi", unit: "LEMBAR", minQty: 1000, price: 3800 },
    { category: "PAPER", name: "Art Carton 260 GSM 65x100", vendor: "PT Kertas Mulia Abadi", unit: "LEMBAR", minQty: 500, price: 2900 },
  ];
  await Promise.all(priceMasterSeed.map((p) => prisma.priceMasterItem.create({ data: p })));

  console.log("Seeding kategori produk...");
  const productCategorySeed = ["BOX", "FOLDING_CARTON", "BROCHURE", "PAPER_BAG", "STICKER", "WOBBLER", "CUSTOM"];
  const productCategories = await Promise.all(
    productCategorySeed.map((name, i) =>
      prisma.productCategory.create({ data: { code: code("CAT", i + 1), name: name.replaceAll("_", " ") } })
    )
  );
  const categoryByLegacyName = (legacy: string) =>
    productCategories.find((c) => c.name === legacy.replaceAll("_", " "))!;

  console.log("Seeding products...");
  const productSeed: Array<{ name: string; category: string; material: string; spec?: string }> = [
    { name: "Custom Food Packaging Box", category: "BOX", material: "Ivory 350 GSM", spec: "Sesuai artwork customer" },
    { name: "Folding Carton Kosmetik", category: "FOLDING_CARTON", material: "Ivory 300 GSM", spec: "Sesuai artwork customer" },
    { name: "Paper Bag Kraft", category: "PAPER_BAG", material: "Kraft 250 GSM", spec: "Sesuai artwork customer" },
    { name: "Sticker Label Roll", category: "STICKER", material: "Art Paper 150 GSM", spec: "Sesuai artwork customer" },
    { name: "Brosur A4 Full Color", category: "BROCHURE", material: "Art Paper 150 GSM", spec: "Sesuai artwork customer" },
    { name: "Wobbler Promosi", category: "WOBBLER", material: "Art Carton 260 GSM", spec: "Sesuai artwork customer" },
    { name: "Box Duplex Frozen Food", category: "BOX", material: "Duplex 350 GSM", spec: "Sesuai artwork customer" },
    { name: "Box Obat Farmasi", category: "FOLDING_CARTON", material: "Ivory 300 GSM", spec: "Sesuai artwork customer" },
    { name: "Hangtag Fashion", category: "CUSTOM", material: "Art Carton 260 GSM", spec: "Sesuai artwork customer" },
    { name: "Master Box Elektronik", category: "BOX", material: "Kraft 250 GSM", spec: "Sesuai artwork customer" },
  ];
  const products = await Promise.all(
    productSeed.map((p, i) =>
      prisma.product.create({
        data: {
          code: code("PRD", i + 1),
          name: p.name,
          category: p.category,
          categoryId: categoryByLegacyName(p.category).id,
          unit: "PCS",
          defaultMaterialId: materialByName(p.material).id,
          specification: p.spec,
        },
      })
    )
  );

  console.log("Seeding master design...");
  const designSeed: Array<{ name: string; product: string; driveUrl: string; note?: string }> = [
    {
      name: "Design Custom Food Packaging Box - Final",
      product: "Custom Food Packaging Box",
      driveUrl: "https://drive.google.com/drive/folders/demo-food-packaging-box",
      note: "Revisi ke-2, sudah approve customer",
    },
    {
      name: "Design Folding Carton Kosmetik",
      product: "Folding Carton Kosmetik",
      driveUrl: "https://drive.google.com/drive/folders/demo-folding-carton-kosmetik",
    },
    {
      name: "Design Paper Bag Kraft",
      product: "Paper Bag Kraft",
      driveUrl: "https://drive.google.com/drive/folders/demo-paper-bag-kraft",
      note: "Logo customer versi terbaru",
    },
  ];
  await Promise.all(
    designSeed.map((d, i) =>
      prisma.designMaster.create({
        data: {
          code: code("DSG", i + 1),
          name: d.name,
          driveUrl: d.driveUrl,
          note: d.note,
          productId: products.find((p) => p.name === d.product)?.id,
        },
      })
    )
  );

  console.log("Seeding customers...");
  const customerSeed: Array<{ name: string; industry: string; contact: string; phone: string; term: CustomerTerm; limit: number; sales: string; npwp?: string; address?: string }> = [
    { name: "PT Demo Food Indonesia", industry: "Makanan & Minuman", contact: "Ibu Ratna", phone: "021-8876739", term: "NET_30", limit: 500_000_000, sales: "Dewi Lestari", npwp: "10.0.0.1-012.000", address: "Jl. Industri Pangan No. 12, Cakung, Jakarta Timur" },
    { name: "PT Sinar Kosmetika Nusantara", industry: "Kosmetik", contact: "Bpk. Wawan", phone: "021-8388095", term: "NET_45", limit: 350_000_000, sales: "Andi Wijaya", npwp: "10.0.1.3-013.000", address: "Jl. Kosmetik Raya No. 8, Tangerang" },
    { name: "PT Aneka Roti Jaya", industry: "Bakery", contact: "Ibu Melly", phone: "021-8571231", term: "NET_30", limit: 200_000_000, sales: "Dewi Lestari", npwp: "10.0.0.3-014.000", address: "Jl. Bakery Utama No. 5, Bekasi" },
    { name: "CV Herbal Sehat Mandiri", industry: "Farmasi", contact: "Bpk. Dedi", phone: "021-8859424", term: "CBD", limit: 100_000_000, sales: "Andi Wijaya" },
    { name: "PT Kopi Arunika Indonesia", industry: "Kopi & Beverage", contact: "Ibu Nadia", phone: "021-8308084", term: "NET_30", limit: 250_000_000, sales: "Dewi Lestari" },
    { name: "PT Cahaya Elektronik Prima", industry: "Elektronik", contact: "Bpk. Surya", phone: "021-8917317", term: "NET_60", limit: 400_000_000, sales: "Andi Wijaya" },
    { name: "PT Nusantara Snack Sejahtera", industry: "Snack", contact: "Ibu Fitri", phone: "021-8324470", term: "NET_30", limit: 300_000_000, sales: "Dewi Lestari" },
    { name: "CV Batik Larasati", industry: "Fashion", contact: "Ibu Laras", phone: "021-8520007", term: "CBD", limit: 75_000_000, sales: "Andi Wijaya" },
    { name: "PT Farmasi Amerta Husada", industry: "Farmasi", contact: "Bpk. Iqbal", phone: "021-8658497", term: "NET_45", limit: 450_000_000, sales: "Dewi Lestari" },
    { name: "PT Segar Buah Katulampa", industry: "Agribisnis", contact: "Bpk. Anton", phone: "021-8415864", term: "NET_30", limit: 150_000_000, sales: "Andi Wijaya" },
  ];
  const customers = await Promise.all(
    customerSeed.map((c, i) =>
      prisma.customer.create({
        data: {
          code: code("CUS", i + 1),
          name: c.name,
          industry: c.industry,
          contactName: c.contact,
          contactPhone: c.phone,
          npwp: c.npwp,
          address: c.address,
          term: c.term,
          creditLimit: c.limit,
          salesId: (c.sales === "Dewi Lestari" ? sales : salesManager).id,
        },
      })
    )
  );
  const customerByName = (name: string) => customers.find((c) => c.name === name)!;

  console.log("Seeding leads (CRM pipeline)...");
  const leadSeed: Array<{ company: string; product: string; value: number; stage: LeadStage; sales: string }> = [
    { company: "PT Rasa Kuliner Abadi", product: "Box Nasi Custom", value: 85_000_000, stage: "NEW", sales: "Dewi Lestari" },
    { company: "CV Kriya Nusantara", product: "Paper Bag Kraft", value: 20_000_000, stage: "NEW", sales: "Dewi Lestari" },
    { company: "PT Tirta Segar Utama", product: "Label & Sticker", value: 45_000_000, stage: "CONTACTED", sales: "Andi Wijaya" },
    { company: "PT Elektro Andalan", product: "Kardus Packaging", value: 95_000_000, stage: "CONTACTED", sales: "Dewi Lestari" },
    { company: "CV Mitra Bakery Sentosa", product: "Folding Carton", value: 60_000_000, stage: "QUALIFIED", sales: "Dewi Lestari" },
    { company: "PT Manis Legit Indonesia", product: "Wobbler & Brosur", value: 25_000_000, stage: "QUALIFIED", sales: "Andi Wijaya" },
    { company: "PT Glow Beauty Indonesia", product: "Box Kosmetik Spot UV", value: 120_000_000, stage: "MEETING", sales: "Andi Wijaya" },
    { company: "PT Vitalife Nutrisi", product: "Box Foil Emboss", value: 140_000_000, stage: "MEETING", sales: "Andi Wijaya" },
    { company: "PT Sentosa Mandiri", product: "Paper Bag", value: 55_000_000, stage: "QUOTATION", sales: "Dewi Lestari" },
  ];
  const leads = await Promise.all(
    leadSeed.map((l, i) =>
      prisma.lead.create({
        data: {
          code: code("LEAD", i + 1),
          companyName: l.company,
          productNote: l.product,
          estimatedValue: l.value,
          stage: l.stage,
          salesId: (l.sales === "Dewi Lestari" ? sales : salesManager).id,
        },
      })
    )
  );
  void leads;

  console.log("Seeding quotations, sales orders, work orders, invoices...");
  const productionProcess: WorkOrderProcess[] = ["PREPRESS", "MATERIAL", "PRINTING", "FINISHING", "POND", "PACKING", "QC", "REWORK", "COMPLETED"];
  let qtSeq = 0;
  let soSeq = 0;
  let woSeq = 0;
  let invSeq = 0;
  let prSeq = 0;
  let doSeq = 0;

  type Deal = {
    customer: string;
    product: string;
    qty: number;
    hpp: number;
    margin: number;
    qStatus: QuotationStatus;
    soStatus?: SalesOrderStatus;
    woStage?: WorkOrderStage;
    woProcess?: WorkOrderProcess;
    woProgress?: number;
    woDeadlineOffsetDays?: number; // override jarak deadline dari createdAt (bisa negatif = sudah lewat / terlambat)
    woRejectRatePercent?: number; // demo data untuk business alert "production issue"
    invoiceStatus?: InvoiceStatus;
    daysAgo: number;
  };

  const deals: Deal[] = [
    { customer: "CV Batik Larasati", product: "Custom Food Packaging Box", qty: 1000, hpp: 2_800_000, margin: 23.68, qStatus: "DRAFT", daysAgo: 1 },
    { customer: "CV Batik Larasati", product: "Custom Food Packaging Box", qty: 4000, hpp: 10_500_000, margin: 30, qStatus: "ACCEPTED", soStatus: "PRODUCTION", woStage: "IN_PRODUCTION", woProcess: "PACKING", woProgress: 88, woDeadlineOffsetDays: -6, daysAgo: 2 },
    { customer: "CV Batik Larasati", product: "Custom Food Packaging Box", qty: 4000, hpp: 10_500_000, margin: 30, qStatus: "ACCEPTED", soStatus: "READY_DELIVERY", woStage: "DONE", woProcess: "COMPLETED", woProgress: 100, invoiceStatus: "PAID", daysAgo: 30 },
    { customer: "PT Aneka Roti Jaya", product: "Box Duplex Frozen Food", qty: 6000, hpp: 15_400_000, margin: 25, qStatus: "ACCEPTED", soStatus: "DELIVERED", invoiceStatus: "OVERDUE", daysAgo: 32 },
    { customer: "PT Segar Buah Katulampa", product: "Paper Bag Kraft", qty: 3000, hpp: 9_800_000, margin: 25, qStatus: "ACCEPTED", soStatus: "DELIVERED", invoiceStatus: "OVERDUE", daysAgo: 22 },
    { customer: "PT Sinar Kosmetika Nusantara", product: "Folding Carton Kosmetik", qty: 5000, hpp: 13_200_000, margin: 28, qStatus: "ACCEPTED", soStatus: "PRODUCTION", woStage: "READY", woProcess: "PREPRESS", woProgress: 0, daysAgo: 1 },
    { customer: "PT Farmasi Amerta Husada", product: "Box Obat Farmasi", qty: 8000, hpp: 21_000_000, margin: 22, qStatus: "ACCEPTED", soStatus: "PRODUCTION", woStage: "IN_PRODUCTION", woProcess: "PRINTING", woProgress: 45, woDeadlineOffsetDays: -3, woRejectRatePercent: 5.5, daysAgo: 1 },
    { customer: "PT Nusantara Snack Sejahtera", product: "Custom Food Packaging Box", qty: 2000, hpp: 6_400_000, margin: 20, qStatus: "ACCEPTED", soStatus: "MATERIAL_CHECK", daysAgo: 1 },
    { customer: "PT Kopi Arunika Indonesia", product: "Sticker Label Roll", qty: 10000, hpp: 8_100_000, margin: 32, qStatus: "SENT", daysAgo: 3 },
    { customer: "PT Cahaya Elektronik Prima", product: "Master Box Elektronik", qty: 1500, hpp: 12_600_000, margin: 27, qStatus: "SENT", daysAgo: 4 },
    { customer: "CV Herbal Sehat Mandiri", product: "Box Obat Farmasi", qty: 4000, hpp: 9_400_000, margin: 24, qStatus: "REJECTED", daysAgo: 6 },
    { customer: "PT Demo Food Indonesia", product: "Box Duplex Frozen Food", qty: 5000, hpp: 14_100_000, margin: 26, qStatus: "ACCEPTED", soStatus: "PRODUCTION", woStage: "REWORK", woProcess: "REWORK", woProgress: 70, woRejectRatePercent: 6.0, daysAgo: 2 },
  ];

  for (const deal of deals) {
    qtSeq += 1;
    const customer = customerByName(deal.customer);
    const product = products.find((p) => p.name === deal.product)!;
    const value = Math.round(deal.hpp * (1 + deal.margin / 100));
    const createdAt = new Date(Date.now() - deal.daysAgo * 24 * 60 * 60 * 1000);

    const quotation = await prisma.quotation.create({
      data: {
        code: code("QT", qtSeq),
        date: createdAt,
        customerId: customer.id,
        productId: product.id,
        qty: deal.qty,
        hppAmount: deal.hpp,
        marginPercent: deal.margin,
        totalAmount: value,
        salesId: customer.salesId,
        status: deal.qStatus,
        createdAt,
        updatedAt: createdAt,
      },
    });

    if (deal.qStatus !== "ACCEPTED" || !deal.soStatus) continue;

    soSeq += 1;
    const salesOrder = await prisma.salesOrder.create({
      data: {
        code: code("SO", soSeq),
        quotationId: quotation.id,
        date: createdAt,
        customerId: customer.id,
        productId: product.id,
        qty: deal.qty,
        totalAmount: value,
        marginPercent: deal.margin,
        status: deal.soStatus,
        deliveredAt: deal.soStatus === "DELIVERED" ? new Date() : null,
        createdAt,
        updatedAt: createdAt,
      },
    });

    if (deal.woStage) {
      woSeq += 1;
      const deadline = new Date(createdAt.getTime() + (deal.woDeadlineOffsetDays ?? 5) * 24 * 60 * 60 * 1000);
      await prisma.workOrder.create({
        data: {
          code: code("WO", woSeq),
          salesOrderId: salesOrder.id,
          stage: deal.woStage,
          process: deal.woProcess ?? productionProcess[woSeq % productionProcess.length],
          progressPercent: deal.woProgress ?? 0,
          priority: deal.woProgress && deal.woProgress > 80 ? "URGENT" : "NORMAL",
          deadline,
          startedAt: deal.woStage !== "WAITING" ? createdAt : null,
          completedAt: deal.woStage === "DONE" ? new Date() : null,
          rejectRatePercent: deal.woRejectRatePercent ?? 0,
          createdAt,
          updatedAt: createdAt,
        },
      });
    }

    if (deal.soStatus === "READY_DELIVERY" || deal.soStatus === "DELIVERED") {
      doSeq += 1;
      const isDelivered = deal.soStatus === "DELIVERED";
      await prisma.deliveryOrder.create({
        data: {
          code: code("DO", doSeq),
          salesOrderId: salesOrder.id,
          stage: isDelivered ? "DELIVERED" : "READY",
          deliveredAt: isDelivered ? new Date() : null,
          createdAt,
          updatedAt: createdAt,
        },
      });
    }

    if (deal.invoiceStatus) {
      invSeq += 1;
      const dueDate = new Date(createdAt.getTime() + 30 * 24 * 60 * 60 * 1000);
      const paidAmount = deal.invoiceStatus === "PAID" ? value : deal.invoiceStatus === "PARTIAL" ? Math.round(value * 0.5) : 0;
      const invoice = await prisma.invoice.create({
        data: {
          code: code("INV", invSeq),
          salesOrderId: salesOrder.id,
          customerId: customer.id,
          issuedAt: createdAt,
          dueDate,
          totalAmount: value,
          paidAmount,
          status: deal.invoiceStatus,
          createdAt,
          updatedAt: createdAt,
        },
      });

      if (paidAmount > 0) {
        await prisma.payment.create({
          data: {
            invoiceId: invoice.id,
            amount: paidAmount,
            method: "TRANSFER",
            reference: `TRF-${invoice.code}`,
            paidAt: new Date(dueDate.getTime() - 2 * 24 * 60 * 60 * 1000),
          },
        });
      }
    }
  }

  console.log("Seeding purchase requests...");
  const prSeed: Array<{ material: string; qty: number; supplier: string; cost: number; status: PurchaseRequestStatus; neededInDays?: number }> = [
    { material: "Ivory 300 GSM", qty: 250, supplier: "PT Kertas Mulia Abadi", cost: 950_000, status: "RECEIVED" },
    { material: "Duplex 350 GSM", qty: 5000, supplier: "CV Sumber Kertas Jaya", cost: 15_500_000, status: "REJECTED", neededInDays: 7 },
    { material: "Foil Gold Roll", qty: 4, supplier: "PT Foil Prima Indah", cost: 5_000_000, status: "RECEIVED" },
    { material: "Kraft 250 GSM", qty: 3000, supplier: "PT Kraft Indo Perkasa", cost: 10_500_000, status: "PENDING", neededInDays: 7 },
    { material: "Duplex 400 GSM", qty: 999_999 % 6000, supplier: "CV Sumber Kertas Jaya", cost: 2_899_997_100 / 1000, status: "PENDING" },
  ];
  for (const pr of prSeed) {
    prSeq += 1;
    const material = materialByName(pr.material);
    await prisma.purchaseRequest.create({
      data: {
        code: code("PR", prSeq),
        materialId: material.id,
        qty: pr.qty,
        supplierId: supplierByName(pr.supplier).id,
        estimatedCost: pr.cost,
        neededDate: pr.neededInDays ? new Date(Date.now() + pr.neededInDays * 24 * 60 * 60 * 1000) : null,
        requestedById: purchasing.id,
        approvedById: pr.status === "RECEIVED" ? owner.id : null,
        status: pr.status,
      },
    });
  }

  console.log("Seeding audit trail & daily recap...");
  await prisma.auditTrail.createMany({
    data: [
      { userId: owner.id, module: "production", action: "START", referenceCode: code("WO", 1) },
      { userId: owner.id, module: "purchasing", action: "STATUS_CHANGE", referenceCode: code("PR", 2), oldValue: { status: "PENDING" }, newValue: { status: "REJECTED" } },
      { userId: owner.id, module: "purchasing", action: "STATUS_CHANGE", referenceCode: code("PR", 1), oldValue: { status: "PENDING" }, newValue: { status: "RECEIVED" } },
      { userId: sales.id, module: "quotations", action: "CREATE", referenceCode: code("QT", 1) },
      { userId: owner.id, module: "production", action: "QC", referenceCode: code("WO", 1) },
      { userId: undefined, module: "export", action: "EXPORT", referenceCode: code("INV", 1) },
    ],
  });
  await prisma.dailyRecapLog.createMany({
    data: Array.from({ length: 4 }).map((_, i) => ({
      recapDate: new Date(Date.now() - i * 24 * 60 * 60 * 1000),
      recipientEmail: "delivered@resend.dev",
      status: "SENT",
    })),
  });

  console.log("Seed selesai.");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });

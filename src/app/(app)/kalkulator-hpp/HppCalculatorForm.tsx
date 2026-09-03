"use client";

import { useEffect, useRef, useState } from "react";
import { useFormStatus } from "react-dom";
import { Field, Input, Select } from "@/components/ui/FormField";
import { formatDecimal, formatRupiah } from "@/lib/format";
import {
  hitungHppProduksi,
  ringkasKomposisi,
  type BiayaLainItem,
  type DigitalPrintMode,
  type HppCalculatorResult,
  type JenisLaminating,
  type Layout,
  type MetodeCetak,
  type MetodeHargaKertas,
} from "@/lib/hpp-engine";
import { createQuotationFromHppAction } from "./actions";

type QuotationOption = {
  id: string;
  code: string;
  productName: string;
  qty: number;
  marginPercent: number;
  createdAt: string;
  materialSpec: Record<string, unknown> | null;
};

type CustomerOption = { id: string; name: string; quotations: QuotationOption[] };

type PriceMasterOption = { id: string; category: string; name: string; unit: string; price: number };

interface FormState {
  panjangPlano: number;
  lebarPlano: number;
  panjangPotong: number;
  lebarPotong: number;
  marginKiri: number;
  marginKanan: number;
  marginAtas: number;
  marginBawah: number;
  gap: number;
  jumlahOrder: number;
  gsm: number;
  metodeHargaKertas: MetodeHargaKertas;
  hargaKertasRim: number;
  hargaPerKg: number;
  jenisLaminating: JenisLaminating;
  paramFoil: number;
  metodeCetak: MetodeCetak;
  jumlahWarna: number;
  hargaPerPelat: number;
  jumlahDesain: number;
  hargaTintaPerKg: number;
  coverageTinta: number;
  dayaTutupTinta: number;
  digitalMode: DigitalPrintMode;
  hargaCetakDigital: number;
}

const DEFAULT_FORM: FormState = {
  panjangPlano: 109,
  lebarPlano: 79,
  panjangPotong: 43.5,
  lebarPotong: 30.2,
  marginKiri: 0,
  marginKanan: 0,
  marginAtas: 0,
  marginBawah: 0,
  gap: 0,
  jumlahOrder: 1000,
  gsm: 210,
  metodeHargaKertas: "kg",
  hargaKertasRim: 0,
  hargaPerKg: 12700,
  jenisLaminating: "doff",
  paramFoil: 0,
  metodeCetak: "offset",
  jumlahWarna: 4,
  hargaPerPelat: 50000,
  jumlahDesain: 1,
  hargaTintaPerKg: 100000,
  coverageTinta: 30,
  dayaTutupTinta: 100,
  digitalMode: "per_lembar",
  hargaCetakDigital: 0,
};

const LAMINATING_OPTIONS: { value: JenisLaminating; label: string }[] = [
  { value: "none", label: "Tanpa Laminating" },
  { value: "glossy", label: "Glossy - 0.18 / cm²" },
  { value: "doff", label: "Doff - 0.21 / cm²" },
  { value: "softtouch", label: "Softtouch - 0.5 / cm²" },
  { value: "holo", label: "Holo - 0.5 / cm²" },
];

const FOIL_OPTIONS = [
  { value: 0, label: "Tanpa Foil" },
  { value: 1.7, label: "Foil 1.7" },
  { value: 2.5, label: "Foil 2.5" },
  { value: 3.5, label: "Foil 3.5" },
  { value: 4, label: "Foil 4" },
];

const WARNA_OPTIONS = [
  { value: 1, label: "1 Warna (BW)" },
  { value: 2, label: "2 Warna" },
  { value: 4, label: "4 Warna (CMYK / Full Color)" },
  { value: 5, label: "5 Warna (CMYK + 1 Spot)" },
  { value: 6, label: "6 Warna (CMYK + 2 Spot)" },
];

let lainCounter = 0;

export function HppCalculatorForm({
  customers,
  priceMasterItems,
}: {
  customers: CustomerOption[];
  priceMasterItems: PriceMasterOption[];
}) {
  const [form, setForm] = useState<FormState>(DEFAULT_FORM);
  const [biayaLain, setBiayaLain] = useState<(BiayaLainItem & { id: number })[]>([]);
  const [result, setResult] = useState<HppCalculatorResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  const [productName, setProductName] = useState("Box Kemasan Custom");
  const [margin, setMargin] = useState(30);
  const [customerId, setCustomerId] = useState("");
  const [tanggalKirim, setTanggalKirim] = useState("");

  const [kertasPriceId, setKertasPriceId] = useState("");
  const [laminatingPriceId, setLaminatingPriceId] = useState("");
  const [foilPriceId, setFoilPriceId] = useState("");
  const [digitalPriceId, setDigitalPriceId] = useState("");

  const kertasPriceOptions = priceMasterItems.filter((p) => p.category === "PAPER");
  const finishingPriceOptions = priceMasterItems.filter((p) => p.category === "FINISHING");
  const digitalPriceOptions = priceMasterItems.filter((p) => p.category === "OUTSOURCING" || p.category === "FINISHING");

  const kertasOverride = kertasPriceId ? priceMasterItems.find((p) => p.id === kertasPriceId)?.price ?? null : null;
  const laminatingOverride = laminatingPriceId
    ? priceMasterItems.find((p) => p.id === laminatingPriceId)?.price ?? null
    : null;
  const foilOverride = foilPriceId ? priceMasterItems.find((p) => p.id === foilPriceId)?.price ?? null : null;

  const selectedCustomer = customers.find((c) => c.id === customerId);

  function updateField<K extends keyof FormState>(key: K, value: FormState[K]) {
    setForm((prev) => ({ ...prev, [key]: value }));
  }

  function applyReorder(q: QuotationOption) {
    setProductName(q.productName);
    setMargin(q.marginPercent);
    const spec = q.materialSpec ?? {};
    setForm((prev) => ({
      ...prev,
      jumlahOrder: q.qty,
      gsm: typeof spec.gsm === "number" ? spec.gsm : prev.gsm,
      panjangPlano: typeof spec.panjangPlano === "number" ? spec.panjangPlano : prev.panjangPlano,
      lebarPlano: typeof spec.lebarPlano === "number" ? spec.lebarPlano : prev.lebarPlano,
      panjangPotong: typeof spec.panjangPotong === "number" ? spec.panjangPotong : prev.panjangPotong,
      lebarPotong: typeof spec.lebarPotong === "number" ? spec.lebarPotong : prev.lebarPotong,
      metodeHargaKertas:
        spec.metodeHargaKertas === "rim" || spec.metodeHargaKertas === "kg" ? spec.metodeHargaKertas : prev.metodeHargaKertas,
      hargaKertasRim: typeof spec.hargaKertasRim === "number" ? spec.hargaKertasRim : prev.hargaKertasRim,
      hargaPerKg: typeof spec.hargaPerKg === "number" ? spec.hargaPerKg : prev.hargaPerKg,
      jenisLaminating: typeof spec.jenisLaminating === "string" ? (spec.jenisLaminating as JenisLaminating) : prev.jenisLaminating,
      paramFoil: typeof spec.paramFoil === "number" ? spec.paramFoil : prev.paramFoil,
      metodeCetak: spec.metodeCetak === "offset" || spec.metodeCetak === "digital" ? spec.metodeCetak : prev.metodeCetak,
      jumlahWarna: typeof spec.jumlahWarna === "number" ? spec.jumlahWarna : prev.jumlahWarna,
      jumlahDesain: typeof spec.jumlahDesain === "number" ? spec.jumlahDesain : prev.jumlahDesain,
      digitalMode: spec.digitalMode === "per_lembar" || spec.digitalMode === "per_order" ? spec.digitalMode : prev.digitalMode,
      hargaCetakDigital: typeof spec.hargaCetakDigital === "number" ? spec.hargaCetakDigital : prev.hargaCetakDigital,
    }));
  }

  function tambahBiayaLain() {
    lainCounter += 1;
    setBiayaLain((prev) => [...prev, { id: lainCounter, label: "", nominal: 0 }]);
  }

  function hapusBiayaLain(id: number) {
    setBiayaLain((prev) => prev.filter((item) => item.id !== id));
  }

  function updateBiayaLain(id: number, patch: Partial<BiayaLainItem>) {
    setBiayaLain((prev) => prev.map((item) => (item.id === id ? { ...item, ...patch } : item)));
  }

  function handleCalculate() {
    const res = hitungHppProduksi({
      ...form,
      hargaKertasPlanoOverride: kertasOverride,
      hargaLaminatingPerPlanoOverride: laminatingOverride,
      hargaFoilPerPlanoOverride: foilOverride,
      biayaLain: biayaLain.map((item) => ({ label: item.label.trim() || "(tanpa label)", nominal: item.nominal })),
    });

    if ("error" in res) {
      setError(res.error);
      setResult(null);
      return;
    }

    setError(null);
    setResult(res);
  }

  // Hitung sekali saat halaman dibuka, meniru perilaku kalkulator asli.
  useEffect(() => {
    handleCalculate();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!result) return;
    drawLayout(canvasRef.current, {
      panjangPlano: form.panjangPlano,
      lebarPlano: form.lebarPlano,
      panjangEfektif: result.panjangEfektif,
      lebarEfektif: result.lebarEfektif,
      marginKiri: form.marginKiri,
      marginAtas: form.marginAtas,
      gap: form.gap,
      terbaik: result.terbaik,
    });
  }, [result, form.panjangPlano, form.lebarPlano, form.marginKiri, form.marginAtas, form.gap]);

  return (
    <div className="space-y-4">
      <SectionCard title="Customer & Reorder">
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <Field label="Customer">
            <Select value={customerId} onChange={(e) => setCustomerId(e.target.value)}>
              <option value="">- pilih customer (opsional) -</option>
              {customers.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="Tanggal Kirim Diminta">
            <input
              type="date"
              value={tanggalKirim}
              onChange={(e) => setTanggalKirim(e.target.value)}
              className="h-10 w-full rounded-md border border-gray-300 px-3 py-2 text-sm outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
            />
          </Field>
        </div>
        {selectedCustomer ? (
          selectedCustomer.quotations.length > 0 ? (
            <div className="mt-3">
              <p className="mb-2 text-xs font-semibold text-gray-500">
                Customer lama — pilih quotation sebelumnya untuk reorder (data bisa diubah lagi setelah dimuat):
              </p>
              <div className="max-h-56 space-y-1.5 overflow-y-auto">
                {selectedCustomer.quotations.map((q) => (
                  <button
                    key={q.id}
                    type="button"
                    onClick={() => applyReorder(q)}
                    className="flex w-full items-center justify-between rounded-md border border-gray-200 bg-gray-50 px-3 py-2 text-left text-xs hover:border-blue-400 hover:bg-blue-50"
                  >
                    <span>
                      <b>{q.code}</b> · {q.productName} · {formatDecimal(q.qty)} pcs
                    </span>
                    <span className="font-semibold text-blue-700">Reorder →</span>
                  </button>
                ))}
              </div>
            </div>
          ) : (
            <p className="mt-3 text-xs italic text-gray-400">Customer ini belum pernah membuat quotation.</p>
          )
        ) : null}
      </SectionCard>

      <SectionCard title="A. Dimensi & Order">
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
          <Field label="Panjang Plano (cm)">
            <NumberInput value={form.panjangPlano} step={0.01} onChange={(v) => updateField("panjangPlano", v)} />
          </Field>
          <Field label="Lebar Plano (cm)">
            <NumberInput value={form.lebarPlano} step={0.01} onChange={(v) => updateField("lebarPlano", v)} />
          </Field>
          <Field label="Panjang Ukuran Jadi (cm)">
            <NumberInput value={form.panjangPotong} step={0.01} onChange={(v) => updateField("panjangPotong", v)} />
          </Field>
          <Field label="Lebar Ukuran Jadi (cm)">
            <NumberInput value={form.lebarPotong} step={0.01} onChange={(v) => updateField("lebarPotong", v)} />
          </Field>
          <Field label="Margin Kiri">
            <NumberInput value={form.marginKiri} step={0.01} onChange={(v) => updateField("marginKiri", v)} />
          </Field>
          <Field label="Margin Kanan">
            <NumberInput value={form.marginKanan} step={0.01} onChange={(v) => updateField("marginKanan", v)} />
          </Field>
          <Field label="Margin Atas">
            <NumberInput value={form.marginAtas} step={0.01} onChange={(v) => updateField("marginAtas", v)} />
          </Field>
          <Field label="Margin Bawah">
            <NumberInput value={form.marginBawah} step={0.01} onChange={(v) => updateField("marginBawah", v)} />
          </Field>
          <Field label="Gap Antar Potongan">
            <NumberInput value={form.gap} step={0.01} onChange={(v) => updateField("gap", v)} />
          </Field>
          <Field label="Jumlah Order (pcs)">
            <NumberInput value={form.jumlahOrder} step={1} onChange={(v) => updateField("jumlahOrder", v)} />
          </Field>
          <Field label="GSM Kertas">
            <NumberInput value={form.gsm} step={1} onChange={(v) => updateField("gsm", v)} />
          </Field>
        </div>
      </SectionCard>

      <SectionCard title="B. Harga Kertas">
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
          <Field label="Metode Harga Kertas">
            <Select
              value={form.metodeHargaKertas}
              onChange={(e) => updateField("metodeHargaKertas", e.target.value as MetodeHargaKertas)}
            >
              <option value="rim">Per Rim</option>
              <option value="kg">Per Kg</option>
            </Select>
          </Field>
          {form.metodeHargaKertas === "rim" ? (
            <Field label="Harga Kertas per Rim">
              <NumberInput value={form.hargaKertasRim} step={1} onChange={(v) => updateField("hargaKertasRim", v)} />
            </Field>
          ) : (
            <Field label="Harga Kertas per Kg">
              <NumberInput value={form.hargaPerKg} step={1} onChange={(v) => updateField("hargaPerKg", v)} />
            </Field>
          )}
          <Field label="Harga dari Price Master (opsional, override)">
            <Select value={kertasPriceId} onChange={(e) => setKertasPriceId(e.target.value)}>
              <option value="">- pakai perhitungan manual -</option>
              {kertasPriceOptions.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name} — {formatRupiah(p.price)}/{p.unit}
                </option>
              ))}
            </Select>
          </Field>
        </div>
      </SectionCard>

      <SectionCard title="C. Finishing per Plano">
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
          <Field label="Jenis Laminating">
            <Select
              value={form.jenisLaminating}
              onChange={(e) => updateField("jenisLaminating", e.target.value as JenisLaminating)}
            >
              {LAMINATING_OPTIONS.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="Harga Laminating dari Price Master (opsional)">
            <Select value={laminatingPriceId} onChange={(e) => setLaminatingPriceId(e.target.value)}>
              <option value="">- pakai perhitungan manual -</option>
              {finishingPriceOptions.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name} — {formatRupiah(p.price)}/{p.unit}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="Parameter Foil">
            <Select value={form.paramFoil} onChange={(e) => updateField("paramFoil", Number(e.target.value))}>
              {FOIL_OPTIONS.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="Harga Foil dari Price Master (opsional)">
            <Select value={foilPriceId} onChange={(e) => setFoilPriceId(e.target.value)}>
              <option value="">- pakai perhitungan manual -</option>
              {finishingPriceOptions.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name} — {formatRupiah(p.price)}/{p.unit}
                </option>
              ))}
            </Select>
          </Field>
        </div>
      </SectionCard>

      <SectionCard title="D. Metode Cetak">
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
          <Field label="Metode Cetak">
            <Select value={form.metodeCetak} onChange={(e) => updateField("metodeCetak", e.target.value as MetodeCetak)}>
              <option value="offset">Offset</option>
              <option value="digital">Digital</option>
            </Select>
          </Field>
          {form.metodeCetak === "digital" ? (
            <>
              <Field label="Mode Digital">
                <Select
                  value={form.digitalMode}
                  onChange={(e) => updateField("digitalMode", e.target.value as DigitalPrintMode)}
                >
                  <option value="per_lembar">Per Lembar (Plano)</option>
                  <option value="per_order">Per Order (Flat)</option>
                </Select>
              </Field>
              <Field label={form.digitalMode === "per_lembar" ? "Harga Cetak Digital / Lembar (Rp)" : "Harga Cetak Digital / Order (Rp)"}>
                <NumberInput value={form.hargaCetakDigital} step={1} onChange={(v) => updateField("hargaCetakDigital", v)} />
              </Field>
              <Field label="Harga dari Price Master (opsional)">
                <Select
                  value={digitalPriceId}
                  onChange={(e) => {
                    const id = e.target.value;
                    setDigitalPriceId(id);
                    const item = priceMasterItems.find((p) => p.id === id);
                    if (item) updateField("hargaCetakDigital", item.price);
                  }}
                >
                  <option value="">- pilih untuk isi otomatis -</option>
                  {digitalPriceOptions.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name} — {formatRupiah(p.price)}/{p.unit}
                    </option>
                  ))}
                </Select>
              </Field>
            </>
          ) : (
            <p className="col-span-2 self-center text-xs text-gray-500 sm:col-span-2">
              Metode offset memakai perhitungan Biaya Pelat &amp; Biaya Tinta di bawah.
            </p>
          )}
        </div>
      </SectionCard>

      {form.metodeCetak === "offset" ? (
        <>
          <SectionCard title="E. Biaya Pelat (One-Time) — Offset Konvensional">
            <p className="mb-3 text-xs text-gray-500">
              Rumus: <b>jumlah pelat = jumlah warna × jumlah desain</b>. 1 warna = 1 pelat di mesin offset konvensional.
            </p>
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
              <Field label="Jumlah Warna">
                <Select value={form.jumlahWarna} onChange={(e) => updateField("jumlahWarna", Number(e.target.value))}>
                  {WARNA_OPTIONS.map((opt) => (
                    <option key={opt.value} value={opt.value}>
                      {opt.label}
                    </option>
                  ))}
                </Select>
              </Field>
              <Field label="Harga per Pelat (Rp)">
                <NumberInput value={form.hargaPerPelat} step={1} onChange={(v) => updateField("hargaPerPelat", v)} />
              </Field>
              <Field label="Jumlah Desain / Versi">
                <NumberInput value={form.jumlahDesain} step={1} min={1} onChange={(v) => updateField("jumlahDesain", v)} />
              </Field>
            </div>
          </SectionCard>

          <SectionCard title="F. Biaya Tinta (One-Time) — Offset Konvensional">
            <p className="mb-3 text-xs text-gray-500">
              Rumus: <b>konsumsi tinta (kg) = (luas total cetak m² × coverage%) ÷ daya tutup tinta</b>. Default coverage 30%,
              daya tutup 100 m²/kg.
            </p>
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
              <Field label="Harga Tinta per Kg (Rp)">
                <NumberInput value={form.hargaTintaPerKg} step={1} onChange={(v) => updateField("hargaTintaPerKg", v)} />
              </Field>
              <Field label="Coverage Tinta (%)">
                <NumberInput value={form.coverageTinta} step={1} min={0} max={100} onChange={(v) => updateField("coverageTinta", v)} />
              </Field>
              <Field label="Daya Tutup Tinta (m²/kg)">
                <NumberInput value={form.dayaTutupTinta} step={1} min={1} onChange={(v) => updateField("dayaTutupTinta", v)} />
              </Field>
            </div>
          </SectionCard>
        </>
      ) : null}

      <SectionCard title="G. Biaya Lain-Lain (One-Time)">
        <p className="mb-3 text-xs text-gray-500">
          Tambahkan biaya tambahan apapun (setup mesin, desain, packing, dll.) yang dibebankan sekali ke total produksi.
        </p>
        <div className="space-y-2">
          {biayaLain.length === 0 ? (
            <p className="text-sm italic text-gray-400">Belum ada biaya lain-lain. Klik tombol di bawah untuk menambah.</p>
          ) : (
            biayaLain.map((item) => (
              <div key={item.id} className="grid grid-cols-[1fr_160px_auto] gap-2">
                <input
                  value={item.label}
                  onChange={(e) => updateBiayaLain(item.id, { label: e.target.value })}
                  placeholder="Label biaya (mis. setup mesin)"
                  className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm outline-none focus:border-blue-500"
                />
                <input
                  type="number"
                  value={item.nominal}
                  onChange={(e) => updateBiayaLain(item.id, { nominal: Number(e.target.value) || 0 })}
                  placeholder="Nominal (Rp)"
                  className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm outline-none focus:border-blue-500"
                />
                <button
                  type="button"
                  onClick={() => hapusBiayaLain(item.id)}
                  className="rounded-md bg-red-600 px-3 py-2 text-xs font-semibold text-white hover:bg-red-700"
                >
                  Hapus
                </button>
              </div>
            ))
          )}
        </div>
        <button
          type="button"
          onClick={tambahBiayaLain}
          className="mt-3 rounded-md border border-blue-200 bg-blue-50 px-3 py-1.5 text-xs font-semibold text-blue-700 hover:bg-blue-100"
        >
          + Tambah Biaya Lain
        </button>
      </SectionCard>

      <button
        type="button"
        onClick={handleCalculate}
        className="w-full rounded-md bg-navy-900 px-4 py-3 text-sm font-semibold text-white hover:bg-navy-800 sm:w-auto"
      >
        Hitung Harga Produksi
      </button>

      {error ? (
        <div className="rounded-md border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div>
      ) : null}

      {result ? (
        <>
          <h2 className="pt-2 text-lg font-bold text-gray-900">Ringkasan Akhir</h2>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <StatBox variant="final" className="sm:col-span-2" label="TOTAL BIAYA PRODUKSI" value={formatRupiah(result.totalBiayaProduksi)} big />
            <StatBox variant="final" className="sm:col-span-2" label="HARGA MODAL PER POTONG" value={formatRupiah(result.hargaPerPotong)} big />
            <StatBox variant="highlight" label="Jumlah Order" value={`${formatDecimal(form.jumlahOrder)} pcs`} />
            <StatBox variant="blue" label="Subtotal Plano-Based" value={formatRupiah(result.subtotalPlanoBased)} />
            <StatBox variant="purple" label="Total Biaya One-Time" value={formatRupiah(result.totalOneTime)} />
          </div>

          <h2 className="pt-2 text-lg font-bold text-gray-900">Detail Layout & Plano</h2>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <StatBox label="Potongan per Plano" value={formatDecimal(result.terbaik.totalPotong)} />
            <StatBox label="Komposisi" value={ringkasKomposisi(result.terbaik)} />
            <StatBox label="Jenis Layout" value={result.terbaik.type === "mixed" ? "Campuran" : "Seragam"} />
            <StatBox label="Nama Layout" value={result.terbaik.name} />
            <StatBox label="Ukuran Plano Utuh" value={`${formatDecimal(form.panjangPlano)} × ${formatDecimal(form.lebarPlano)}`} />
            <StatBox label="Ukuran Efektif Setelah Margin" value={`${formatDecimal(result.panjangEfektif)} × ${formatDecimal(result.lebarEfektif)}`} />
            <StatBox variant="warning" label="Waste Total / Plano Utuh" value={`${formatDecimal(result.terbaik.persenSisaTotal)}%`} />
            <StatBox label="Waste Area Efektif" value={`${formatDecimal(result.terbaik.persenSisaEfektif)}%`} />
            <StatBox label="Plano Dibutuhkan Order" value={formatDecimal(result.planoDibutuhkan)} />
            <StatBox variant="warning" label="Waste Plano 5%" value={formatDecimal(result.wastePlano)} />
            <StatBox variant="highlight" label="Plano Produksi + Waste" value={formatDecimal(result.planoProduksi)} />
            <StatBox label="Kapasitas Tanpa Waste" value={formatDecimal(result.totalKapasitasTanpaWaste)} />
            <StatBox label="Total Kapasitas Produksi + Waste" value={formatDecimal(result.totalKapasitas)} />
            <StatBox label="Sisa Produksi" value={formatDecimal(result.sisaProduksi)} />
          </div>

          <h2 className="pt-2 text-lg font-bold text-gray-900">Rincian Biaya per Plano</h2>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <StatBox variant="blue" label="Metode Harga Kertas" value={result.hargaKertas.metodeHargaKertas === "rim" ? "Per Rim" : "Per Kg"} />
            <StatBox label="Berat Plano" value={`${formatDecimal(result.hargaKertas.beratPlanoGram)} gr`} />
            <StatBox variant="highlight" label="Harga Kertas / Plano" value={formatRupiah(result.hargaKertas.hargaKertasPlano)} />
            <StatBox variant="blue" label="Harga Pond / Plano" value={formatRupiah(result.hargaPond.hargaPondPerPlano)} />
            <StatBox label="Jenis Laminating" value={result.hargaLaminating.namaLaminating} />
            <StatBox variant="blue" label="Harga Laminating / Plano" value={formatRupiah(result.hargaLaminating.hargaLaminatingPerPlano)} />
            <StatBox variant="purple" label="Parameter Foil" value={formatDecimal(result.hargaFoil.paramFoil)} />
            <StatBox variant="purple" label="Harga Foil / Plano" value={formatRupiah(result.hargaFoil.hargaFoilPerPlano)} />
            <StatBox variant="highlight" label="TOTAL BIAYA / PLANO" value={formatRupiah(result.biayaPerPlano)} />
            <StatBox label="× Plano Produksi" value={formatDecimal(result.planoProduksi)} />
            <StatBox variant="highlight" label="= Subtotal Plano-Based" value={formatRupiah(result.subtotalPlanoBased)} />
          </div>

          <h2 className="pt-2 text-lg font-bold text-gray-900">Rincian Biaya One-Time</h2>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <StatBox variant="blue" label="Metode Cetak" value={result.metodeCetak === "offset" ? "Offset" : "Digital"} />
            {result.metodeCetak === "offset" ? (
              <>
                <StatBox label="Jumlah Warna × Desain" value={`${formatDecimal(result.pelat.jumlahWarna)} × ${formatDecimal(result.pelat.jumlahDesain)}`} />
                <StatBox label="Jumlah Pelat Total" value={`${formatDecimal(result.pelat.jumlahPelat)} pelat`} />
                <StatBox label="Harga / Pelat" value={formatRupiah(result.pelat.hargaPerPelat)} />
                <StatBox variant="blue" label="Total Biaya Pelat" value={formatRupiah(result.pelat.totalBiayaPelat)} />
                <StatBox label="Luas Total Cetak" value={`${formatDecimal(result.tinta.luasTotalCetakM2)} m²`} />
                <StatBox label="Coverage / Daya Tutup" value={`${formatDecimal(result.tinta.coverageTinta)}% / ${formatDecimal(result.tinta.dayaTutupTinta)} m²/kg`} />
                <StatBox label="Konsumsi Tinta / Warna" value={`${formatDecimal(result.tinta.konsumsiTintaPerWarnaKg)} kg`} />
                <StatBox label="Total Konsumsi Tinta" value={`${formatDecimal(result.tinta.konsumsiTintaKg)} kg`} />
                <StatBox variant="blue" label="Total Biaya Tinta" value={formatRupiah(result.tinta.totalBiayaTinta)} />
              </>
            ) : (
              <>
                <StatBox
                  label="Mode Digital"
                  value={result.cetakDigital.digitalMode === "per_lembar" ? "Per Lembar" : "Per Order"}
                />
                <StatBox label="Harga Cetak Digital" value={formatRupiah(result.cetakDigital.hargaCetakDigital)} />
                <StatBox variant="blue" label="Total Biaya Cetak Digital" value={formatRupiah(result.cetakDigital.totalBiayaCetakDigital)} />
              </>
            )}
            {biayaLain
              .filter((item) => item.nominal !== 0 || item.label)
              .map((item) => (
                <StatBox key={item.id} label={item.label.trim() || "(tanpa label)"} value={formatRupiah(item.nominal)} />
              ))}
            <StatBox variant="highlight" label="TOTAL BIAYA ONE-TIME" value={formatRupiah(result.totalOneTime)} />
          </div>

          <h2 className="pt-2 text-lg font-bold text-gray-900">Visual Layout Potong</h2>
          <div className="overflow-x-auto rounded-lg border border-gray-200 bg-white p-3">
            <canvas ref={canvasRef} width={1050} height={700} className="block h-auto w-full max-w-[1050px] rounded-md border border-gray-300 bg-white" />
          </div>

          <h2 className="pt-2 text-lg font-bold text-gray-900">Detail Blok Potongan</h2>
          <div className="overflow-x-auto rounded-lg border border-gray-200 bg-white">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-gray-50 text-left text-xs uppercase tracking-wide text-gray-500">
                  <th className="border border-gray-200 px-3 py-2">Blok</th>
                  <th className="border border-gray-200 px-3 py-2">Orientasi</th>
                  <th className="border border-gray-200 px-3 py-2">Ukuran Dipakai</th>
                  <th className="border border-gray-200 px-3 py-2">Kolom</th>
                  <th className="border border-gray-200 px-3 py-2">Baris</th>
                  <th className="border border-gray-200 px-3 py-2">Total</th>
                  <th className="border border-gray-200 px-3 py-2">Posisi X</th>
                  <th className="border border-gray-200 px-3 py-2">Posisi Y</th>
                </tr>
              </thead>
              <tbody>
                {result.terbaik.blocks
                  .filter((block) => block.count > 0)
                  .map((block, idx) => (
                    <tr key={idx}>
                      <td className="border border-gray-200 px-3 py-2">{block.label}</td>
                      <td className="border border-gray-200 px-3 py-2">
                        <span className="rounded-full bg-sky-100 px-2 py-0.5 text-xs font-semibold text-sky-800">
                          {block.orientation}
                        </span>
                      </td>
                      <td className="border border-gray-200 px-3 py-2">
                        {formatDecimal(block.w)} × {formatDecimal(block.h)}
                      </td>
                      <td className="border border-gray-200 px-3 py-2">{block.cols}</td>
                      <td className="border border-gray-200 px-3 py-2">{block.rows}</td>
                      <td className="border border-gray-200 px-3 py-2">{block.count}</td>
                      <td className="border border-gray-200 px-3 py-2">{formatDecimal(block.x)}</td>
                      <td className="border border-gray-200 px-3 py-2">{formatDecimal(block.y)}</td>
                    </tr>
                  ))}
              </tbody>
            </table>
          </div>

          <div className="rounded-lg border border-amber-200 bg-amber-50 p-4 text-sm leading-relaxed text-amber-800">
            <b>Logika Perhitungan:</b>
            <br />
            1. <b>Biaya per Plano</b> = harga kertas + harga pond + harga laminating + harga foil.
            <br />
            2. <b>Subtotal Plano-Based</b> = biaya per plano × plano produksi (sudah termasuk waste 5%).
            <br />
            3. <b>Offset</b>: Biaya Pelat = jumlah warna × jumlah desain × harga per pelat; Biaya Tinta = ((luas plano m² ×
            plano produksi × jumlah warna) × coverage%) ÷ daya tutup tinta × harga tinta/kg.
            <br />
            4. <b>Digital</b>: Biaya Cetak = harga per lembar × plano produksi (mode per lembar), atau flat per order (mode
            per order).
            <br />
            5. <b>Total Biaya One-Time</b> = biaya cetak (pelat+tinta atau digital) + (semua biaya lain-lain).
            <br />
            6. <b>Total Biaya Produksi</b> = pembulatan ke atas dari (Subtotal Plano-Based + Total Biaya One-Time).
            <br />
            7. <b>Harga Modal per Potong</b> = pembulatan ke atas dari (Total Biaya Produksi ÷ Jumlah Order).
            <br />
            8. Harga kertas / laminating / foil bisa di-override langsung dari <b>Price Master</b> bila dipilih.
          </div>

          <SectionCard title="Buat Quotation dari Hasil Ini">
            <form action={createQuotationFromHppAction} className="grid grid-cols-1 gap-3 sm:grid-cols-3">
              <input type="hidden" name="qty" value={form.jumlahOrder} />
              <input type="hidden" name="hppAmount" value={result.totalBiayaProduksi} />
              <input type="hidden" name="requestedDeliveryDate" value={tanggalKirim} />
              {customerId ? <input type="hidden" name="customerId" value={customerId} /> : null}
              <input
                type="hidden"
                name="materialSpec"
                value={JSON.stringify({
                  gsm: form.gsm,
                  panjangPlano: form.panjangPlano,
                  lebarPlano: form.lebarPlano,
                  panjangPotong: form.panjangPotong,
                  lebarPotong: form.lebarPotong,
                  metodeHargaKertas: form.metodeHargaKertas,
                  hargaKertasRim: form.hargaKertasRim,
                  hargaPerKg: form.hargaPerKg,
                  jenisLaminating: form.jenisLaminating,
                  namaLaminating: result.hargaLaminating.namaLaminating,
                  paramFoil: form.paramFoil,
                  metodeCetak: form.metodeCetak,
                  jumlahWarna: form.jumlahWarna,
                  jumlahDesain: form.jumlahDesain,
                  digitalMode: form.digitalMode,
                  hargaCetakDigital: form.hargaCetakDigital,
                })}
              />
              <Field label="Nama Produk">
                <Input
                  name="productNote"
                  value={productName}
                  onChange={(e) => setProductName(e.target.value)}
                  placeholder="Box Kemasan Custom"
                  required
                />
              </Field>
              <Field label="Margin (%)">
                <NumberInput
                  name="marginPercent"
                  value={margin}
                  min={0}
                  max={500}
                  step={0.5}
                  onChange={setMargin}
                />
              </Field>
              <div className="flex flex-col justify-end">
                <CreateQuotationButton
                  amount={Math.round(result.totalBiayaProduksi * (1 + margin / 100))}
                />
              </div>
            </form>
          </SectionCard>
        </>
      ) : null}
    </div>
  );
}

function SectionCard({ title, children, }: { title: string; children: React.ReactNode }) {
  return (
    <div className="rounded-lg border border-gray-200 bg-white p-4">
      <p className="mb-3 border-b border-gray-100 pb-2 text-sm font-semibold text-gray-700">{title}</p>
      {children}
    </div>
  );
}

function CreateQuotationButton({ amount }: { amount: number }) {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      className="h-10 w-full rounded-md bg-blue-600 px-4 text-sm font-semibold text-white hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-40"
    >
      {pending ? "Menyimpan..." : `Buat Quotation · ${formatRupiah(amount)}`}
    </button>
  );
}

function NumberInput({
  value,
  onChange,
  step,
  min,
  max,
  name,
}: {
  value: number;
  onChange: (value: number) => void;
  step?: number;
  min?: number;
  max?: number;
  name?: string;
}) {
  return (
    <input
      type="number"
      name={name}
      value={value}
      step={step}
      min={min}
      max={max}
      onChange={(e) => {
        const raw = e.target.value;
        if (raw === "") {
          onChange(0);
          return;
        }
        const n = Number(raw);
        if (!Number.isFinite(n)) return;
        onChange(n);
        // type=number: React skip re-render kalau valueAsNumber sama, jadi "090" tetap tampil.
        if (/^-?0+\d/.test(raw)) e.target.value = String(n);
      }}
      className="h-10 w-full rounded-md border border-gray-300 px-3 py-2 text-sm outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
    />
  );
}

const VARIANT_CLASS: Record<string, string> = {
  default: "bg-gray-50 border-gray-200 text-gray-900",
  highlight: "bg-emerald-50 border-emerald-300 text-gray-900",
  warning: "bg-amber-50 border-amber-300 text-gray-900",
  blue: "bg-blue-50 border-blue-300 text-gray-900",
  purple: "bg-purple-50 border-purple-300 text-gray-900",
  red: "bg-red-50 border-red-300 text-gray-900",
  final: "bg-navy-900 border-navy-900 text-white",
};

function StatBox({
  label,
  value,
  variant = "default",
  big,
  className,
}: {
  label: string;
  value: string;
  variant?: keyof typeof VARIANT_CLASS;
  big?: boolean;
  className?: string;
}) {
  return (
    <div className={`rounded-xl border p-4 ${VARIANT_CLASS[variant]} ${className ?? ""}`}>
      <small className={`mb-2 block text-xs font-bold ${variant === "final" ? "text-gray-300" : "text-gray-500"}`}>
        {label}
      </small>
      <strong className={`block ${big ? "text-2xl" : "text-lg"} leading-tight`}>{value}</strong>
    </div>
  );
}

function drawLayout(
  canvas: HTMLCanvasElement | null,
  data: {
    panjangPlano: number;
    lebarPlano: number;
    panjangEfektif: number;
    lebarEfektif: number;
    marginKiri: number;
    marginAtas: number;
    gap: number;
    terbaik: Layout;
  }
) {
  if (!canvas) return;
  const ctx = canvas.getContext("2d");
  if (!ctx) return;

  ctx.clearRect(0, 0, canvas.width, canvas.height);

  const padding = 55;
  const scaleX = (canvas.width - padding * 2) / data.panjangPlano;
  const scaleY = (canvas.height - padding * 2) / data.lebarPlano;
  const scale = Math.min(scaleX, scaleY);

  const planoX = padding;
  const planoY = padding;
  const planoW = data.panjangPlano * scale;
  const planoH = data.lebarPlano * scale;

  const efektifX = planoX + data.marginKiri * scale;
  const efektifY = planoY + data.marginAtas * scale;
  const efektifW = data.panjangEfektif * scale;
  const efektifH = data.lebarEfektif * scale;

  ctx.fillStyle = "#f3f4f6";
  ctx.fillRect(planoX, planoY, planoW, planoH);

  ctx.strokeStyle = "#111827";
  ctx.lineWidth = 2;
  ctx.strokeRect(planoX, planoY, planoW, planoH);

  ctx.fillStyle = "#ffffff";
  ctx.fillRect(efektifX, efektifY, efektifW, efektifH);

  ctx.strokeStyle = "#2563eb";
  ctx.lineWidth = 2;
  ctx.strokeRect(efektifX, efektifY, efektifW, efektifH);

  data.terbaik.blocks.forEach((block) => {
    if (block.count <= 0) return;

    const blockBaseX = efektifX + block.x * scale;
    const blockBaseY = efektifY + block.y * scale;

    const itemW = block.w * scale;
    const itemH = block.h * scale;
    const gap = data.gap * scale;

    for (let row = 0; row < block.rows; row++) {
      for (let col = 0; col < block.cols; col++) {
        const x = blockBaseX + col * (itemW + gap);
        const y = blockBaseY + row * (itemH + gap);

        if (block.orientation === "Horizontal") {
          ctx.fillStyle = "#dbeafe";
          ctx.strokeStyle = "#1d4ed8";
        } else {
          ctx.fillStyle = "#dcfce7";
          ctx.strokeStyle = "#15803d";
        }

        ctx.fillRect(x, y, itemW, itemH);
        ctx.lineWidth = 1;
        ctx.strokeRect(x, y, itemW, itemH);

        ctx.fillStyle = "#111827";
        ctx.font = "11px Arial";
        ctx.fillText(block.orientation === "Horizontal" ? "H" : "V", x + 5, y + 14);
      }
    }

    ctx.fillStyle = "#374151";
    ctx.font = "12px Arial";
    ctx.fillText(`${block.label} - ${block.orientation}`, blockBaseX, blockBaseY - 5);
  });

  ctx.fillStyle = "#111827";
  ctx.font = "14px Arial";
  ctx.fillText("Plano Utuh", planoX, planoY - 16);

  ctx.fillStyle = "#2563eb";
  ctx.font = "13px Arial";
  ctx.fillText("Area Efektif Setelah Margin", efektifX, efektifY - 8);

  ctx.fillStyle = "#111827";
  ctx.font = "13px Arial";
  ctx.fillText(
    `Total ${data.terbaik.totalPotong} potong | ${ringkasKomposisi(data.terbaik)} | Waste Total ${data.terbaik.persenSisaTotal.toFixed(2)}%`,
    planoX,
    planoY + planoH + 28
  );
}

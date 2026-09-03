// ============================================================
// KALKULATOR HARGA PRODUKSI KEMASAN - ENGINE
// Port dari kalkulator HPP (plano cutting optimization) milik user.
// Semua fungsi murni (tanpa DOM) agar bisa dipakai di React & di-unit test.
// ============================================================

export type MetodeHargaKertas = "rim" | "kg";
export type JenisLaminating = "none" | "glossy" | "doff" | "softtouch" | "holo";
export type MetodeCetak = "offset" | "digital";
export type DigitalPrintMode = "per_lembar" | "per_order";

export function countFit(totalRuang: number, ukuranItem: number, gap: number): number {
  if (totalRuang <= 0 || ukuranItem <= 0) return 0;
  return Math.floor((totalRuang + gap) / (ukuranItem + gap));
}

export function usedSize(jumlah: number, ukuranItem: number, gap: number): number {
  if (jumlah <= 0) return 0;
  return jumlah * ukuranItem + (jumlah - 1) * gap;
}

export function hitungBeratGramCustom(panjang: number, lebar: number, gsm: number): number {
  return (panjang * lebar * gsm) / 20000;
}

// ---------------- Harga Kertas ----------------

export interface HargaKertasParams {
  metodeHargaKertas: MetodeHargaKertas;
  hargaKertasRim: number;
  hargaPerKg: number;
  panjangPlano: number;
  lebarPlano: number;
  gsm: number;
}

export interface HargaKertasResult extends HargaKertasParams {
  beratPlanoGram: number;
  hargaKertasPlano: number;
  dariPriceMaster: boolean;
}

// hargaKertasPlanoOverride: dipakai saat harga dipilih langsung dari Price Master (Rp/plano),
// menggantikan hasil formula rim/kg agar harga "mengikuti" master.
export function hitungHargaKertas(
  params: HargaKertasParams,
  hargaKertasPlanoOverride?: number | null
): HargaKertasResult {
  const { metodeHargaKertas, hargaKertasRim, hargaPerKg, panjangPlano, lebarPlano, gsm } = params;
  const beratPlanoGram = hitungBeratGramCustom(panjangPlano, lebarPlano, gsm);

  if (hargaKertasPlanoOverride != null) {
    return { ...params, beratPlanoGram, hargaKertasPlano: hargaKertasPlanoOverride, dariPriceMaster: true };
  }

  let hargaKertasPlano = 0;
  if (metodeHargaKertas === "rim") {
    hargaKertasPlano = hargaKertasRim / 500;
  } else {
    const panjangMeter = panjangPlano / 100;
    const lebarMeter = lebarPlano / 100;
    const beratPlanoKg = panjangMeter * lebarMeter * (gsm / 1000);
    hargaKertasPlano = beratPlanoKg * hargaPerKg;
  }

  return { ...params, beratPlanoGram, hargaKertasPlano, dariPriceMaster: false };
}

// ---------------- Harga Pond ----------------

export function tentukanHargaDariGSM(gsm: number): number {
  if (gsm >= 30 && gsm <= 190) return 100;
  if (gsm >= 191 && gsm <= 300) return 200;
  if (gsm >= 301 && gsm <= 400) return 300;
  if (gsm > 400) return 300;
  return 0;
}

export function tentukanHargaDariUkuranPlano(panjangPlano: number, lebarPlano: number): number {
  const ukuranKategori = Math.min(panjangPlano, lebarPlano);
  if (ukuranKategori <= 65) return 100;
  if (ukuranKategori <= 79) return 200;
  if (ukuranKategori <= 90) return 300;
  return 300;
}

export interface HargaPondParams {
  panjangPlano: number;
  lebarPlano: number;
  gsm: number;
  jumlahPlanoDibutuhkan: number;
}

export interface HargaPondResult {
  gsm: number;
  ukuranKategoriPlano: number;
  luasPlano: number;
  hargaDariGSM: number;
  hargaDariUkuran: number;
  hargaPondFinal: number;
  hargaPondPerPlano: number;
  totalHargaPond: number;
}

export function hitungHargaPond(params: HargaPondParams): HargaPondResult {
  const { panjangPlano, lebarPlano, gsm, jumlahPlanoDibutuhkan } = params;

  const hargaDariGSM = tentukanHargaDariGSM(gsm);
  const hargaDariUkuran = tentukanHargaDariUkuranPlano(panjangPlano, lebarPlano);
  const hargaPondFinal = Math.max(hargaDariGSM, hargaDariUkuran);

  const ukuranKategoriPlano = Math.min(panjangPlano, lebarPlano);
  const luasPlano = panjangPlano * lebarPlano;

  const hargaPondPerPlano = hargaPondFinal;
  const totalHargaPond = hargaPondPerPlano * jumlahPlanoDibutuhkan;

  return { gsm, ukuranKategoriPlano, luasPlano, hargaDariGSM, hargaDariUkuran, hargaPondFinal, hargaPondPerPlano, totalHargaPond };
}

// ---------------- Harga Laminating ----------------

const HARGA_LAMINATING_PER_CM: Record<JenisLaminating, number> = {
  none: 0,
  glossy: 0.18,
  doff: 0.21,
  softtouch: 0.5,
  holo: 0.5,
};

const NAMA_LAMINATING: Record<JenisLaminating, string> = {
  none: "Tanpa Laminating",
  glossy: "Glossy",
  doff: "Doff",
  softtouch: "Softtouch",
  holo: "Holo",
};

export function getHargaLaminatingPerCm(jenis: JenisLaminating): number {
  return HARGA_LAMINATING_PER_CM[jenis] ?? 0;
}

export function namaLaminating(jenis: JenisLaminating): string {
  return NAMA_LAMINATING[jenis] ?? "Tanpa Laminating";
}

export interface HargaLaminatingParams {
  panjangPlano: number;
  lebarPlano: number;
  jenisLaminating: JenisLaminating;
  jumlahPlanoDibutuhkan: number;
}

export interface HargaLaminatingResult {
  jenisLaminating: JenisLaminating;
  namaLaminating: string;
  luasPlano: number;
  hargaPerCm: number;
  hargaLaminatingPerPlano: number;
  totalHargaLaminating: number;
  dariPriceMaster: boolean;
}

// hargaLaminatingPerPlanoOverride: harga flat per lembar/plano dari Price Master (kategori Finishing),
// menggantikan formula per cm² bawaan.
export function hitungHargaLaminating(
  params: HargaLaminatingParams,
  hargaLaminatingPerPlanoOverride?: number | null
): HargaLaminatingResult {
  const { panjangPlano, lebarPlano, jenisLaminating, jumlahPlanoDibutuhkan } = params;
  const luasPlano = panjangPlano * lebarPlano;

  if (hargaLaminatingPerPlanoOverride != null) {
    return {
      jenisLaminating,
      namaLaminating: namaLaminating(jenisLaminating),
      luasPlano,
      hargaPerCm: luasPlano > 0 ? hargaLaminatingPerPlanoOverride / luasPlano : 0,
      hargaLaminatingPerPlano: hargaLaminatingPerPlanoOverride,
      totalHargaLaminating: hargaLaminatingPerPlanoOverride * jumlahPlanoDibutuhkan,
      dariPriceMaster: true,
    };
  }

  const hargaPerCm = getHargaLaminatingPerCm(jenisLaminating);
  const hargaLaminatingPerPlano = luasPlano * hargaPerCm;
  const totalHargaLaminating = hargaLaminatingPerPlano * jumlahPlanoDibutuhkan;

  return {
    jenisLaminating,
    namaLaminating: namaLaminating(jenisLaminating),
    luasPlano,
    hargaPerCm,
    hargaLaminatingPerPlano,
    totalHargaLaminating,
    dariPriceMaster: false,
  };
}

// ---------------- Harga Foil ----------------

export interface HargaFoilParams {
  panjangPlano: number;
  lebarPlano: number;
  paramFoil: number;
  jumlahPlanoDibutuhkan: number;
}

export interface HargaFoilResult {
  panjangPlano: number;
  lebarPlano: number;
  panjangHitungFoil: number;
  lebarHitungFoil: number;
  paramFoil: number;
  hargaFoilPerPlano: number;
  totalHargaFoil: number;
  dariPriceMaster: boolean;
}

// hargaFoilPerPlanoOverride: harga flat per lembar/plano dari Price Master, menggantikan formula.
export function hitungHargaFoil(params: HargaFoilParams, hargaFoilPerPlanoOverride?: number | null): HargaFoilResult {
  const { panjangPlano, lebarPlano, paramFoil, jumlahPlanoDibutuhkan } = params;
  const panjangHitungFoil = panjangPlano + 2;
  const lebarHitungFoil = lebarPlano + 2;

  if (hargaFoilPerPlanoOverride != null) {
    return {
      panjangPlano,
      lebarPlano,
      panjangHitungFoil,
      lebarHitungFoil,
      paramFoil,
      hargaFoilPerPlano: hargaFoilPerPlanoOverride,
      totalHargaFoil: hargaFoilPerPlanoOverride * jumlahPlanoDibutuhkan,
      dariPriceMaster: true,
    };
  }

  let hargaFoilPerPlano = 0;
  let totalHargaFoil = 0;
  if (paramFoil > 0) {
    hargaFoilPerPlano = panjangHitungFoil * lebarHitungFoil * paramFoil;
    totalHargaFoil = hargaFoilPerPlano * jumlahPlanoDibutuhkan;
  }

  return {
    panjangPlano,
    lebarPlano,
    panjangHitungFoil,
    lebarHitungFoil,
    paramFoil,
    hargaFoilPerPlano,
    totalHargaFoil,
    dariPriceMaster: false,
  };
}

// ---------------- Biaya Pelat & Tinta (one-time) ----------------

export interface BiayaPelatParams {
  jumlahWarna: number;
  jumlahDesain: number;
  hargaPerPelat: number;
}

export interface BiayaPelatResult extends BiayaPelatParams {
  jumlahPelat: number;
  totalBiayaPelat: number;
}

export function hitungBiayaPelat(params: BiayaPelatParams): BiayaPelatResult {
  const { jumlahWarna, jumlahDesain, hargaPerPelat } = params;
  const jumlahPelat = jumlahWarna * jumlahDesain;
  const totalBiayaPelat = jumlahPelat * hargaPerPelat;
  return { ...params, jumlahPelat, totalBiayaPelat };
}

export interface BiayaTintaParams {
  panjangPlano: number;
  lebarPlano: number;
  planoProduksi: number;
  jumlahWarna: number;
  coverageTinta: number;
  dayaTutupTinta: number;
  hargaTintaPerKg: number;
}

export interface BiayaTintaResult {
  luasPlanoM2: number;
  luasTotalCetakM2: number;
  jumlahWarna: number;
  coverageTinta: number;
  dayaTutupTinta: number;
  hargaTintaPerKg: number;
  konsumsiTintaPerWarnaKg: number;
  konsumsiTintaKg: number;
  totalBiayaTinta: number;
}

export function hitungBiayaTinta(params: BiayaTintaParams): BiayaTintaResult {
  const { panjangPlano, lebarPlano, planoProduksi, jumlahWarna, coverageTinta, dayaTutupTinta, hargaTintaPerKg } = params;

  const luasPlanoM2 = (panjangPlano * lebarPlano) / 10000;
  const luasTotalCetakM2 = luasPlanoM2 * planoProduksi * jumlahWarna;

  const konsumsiTintaKg = dayaTutupTinta > 0 ? (luasTotalCetakM2 * coverageTinta) / 100 / dayaTutupTinta : 0;
  const konsumsiTintaPerWarnaKg = jumlahWarna > 0 ? konsumsiTintaKg / jumlahWarna : 0;
  const totalBiayaTinta = konsumsiTintaKg * hargaTintaPerKg;

  return {
    luasPlanoM2,
    luasTotalCetakM2,
    jumlahWarna,
    coverageTinta,
    dayaTutupTinta,
    hargaTintaPerKg,
    konsumsiTintaPerWarnaKg,
    konsumsiTintaKg,
    totalBiayaTinta,
  };
}

// ---------------- Biaya Cetak Digital (alternatif dari Pelat + Tinta Offset) ----------------

export interface BiayaCetakDigitalParams {
  digitalMode: DigitalPrintMode;
  hargaCetakDigital: number; // per lembar (dikali plano produksi) atau flat per order
  planoProduksi: number;
  jumlahOrder: number;
}

export interface BiayaCetakDigitalResult extends BiayaCetakDigitalParams {
  totalBiayaCetakDigital: number;
}

export function hitungBiayaCetakDigital(params: BiayaCetakDigitalParams): BiayaCetakDigitalResult {
  const { digitalMode, hargaCetakDigital, planoProduksi } = params;
  const totalBiayaCetakDigital = digitalMode === "per_lembar" ? hargaCetakDigital * planoProduksi : hargaCetakDigital;
  return { ...params, totalBiayaCetakDigital };
}

// ---------------- Layout / Optimasi Potong Plano ----------------

export type Orientasi = "Horizontal" | "Vertikal";

export interface LayoutBlock {
  label: string;
  orientation: string;
  x: number;
  y: number;
  w: number;
  h: number;
  cols: number;
  rows: number;
  count: number;
  regionW: number;
  regionH: number;
}

export interface Layout {
  name: string;
  type: "uniform" | "mixed";
  planoWidth: number;
  planoHeight: number;
  areaWidth: number;
  areaHeight: number;
  originalItemW: number;
  originalItemH: number;
  blocks: LayoutBlock[];
  totalPotong: number;
  areaPlanoUtuh: number;
  areaEfektif: number;
  areaSatuPotong: number;
  areaTerpakai: number;
  areaSisaEfektif: number;
  areaSisaTotal: number;
  persenTerpakaiEfektif: number;
  persenSisaEfektif: number;
  persenTerpakaiTotal: number;
  persenSisaTotal: number;
  areaSisa: number;
  persenSisa: number;
  persenTerpakai: number;
}

type LayoutDraft = Omit<
  Layout,
  | "totalPotong"
  | "areaPlanoUtuh"
  | "areaEfektif"
  | "areaSatuPotong"
  | "areaTerpakai"
  | "areaSisaEfektif"
  | "areaSisaTotal"
  | "persenTerpakaiEfektif"
  | "persenSisaEfektif"
  | "persenTerpakaiTotal"
  | "persenSisaTotal"
  | "areaSisa"
  | "persenSisa"
  | "persenTerpakai"
>;

function tambahLayout(layouts: Layout[], layout: LayoutDraft): void {
  const totalPotong = layout.blocks.reduce((sum, block) => sum + block.count, 0);
  if (totalPotong <= 0) return;

  const areaPlanoUtuh = layout.planoWidth * layout.planoHeight;
  const areaEfektif = layout.areaWidth * layout.areaHeight;
  const areaSatuPotong = layout.originalItemW * layout.originalItemH;
  const areaTerpakai = totalPotong * areaSatuPotong;

  const areaSisaEfektif = areaEfektif - areaTerpakai;
  const areaSisaTotal = areaPlanoUtuh - areaTerpakai;

  const persenTerpakaiEfektif = areaEfektif > 0 ? (areaTerpakai / areaEfektif) * 100 : 0;
  const persenSisaEfektif = areaEfektif > 0 ? (areaSisaEfektif / areaEfektif) * 100 : 100;

  const persenTerpakaiTotal = areaPlanoUtuh > 0 ? (areaTerpakai / areaPlanoUtuh) * 100 : 0;
  const persenSisaTotal = areaPlanoUtuh > 0 ? (areaSisaTotal / areaPlanoUtuh) * 100 : 100;

  layouts.push({
    ...layout,
    totalPotong,
    areaPlanoUtuh,
    areaEfektif,
    areaSatuPotong,
    areaTerpakai,
    areaSisaEfektif,
    areaSisaTotal,
    persenTerpakaiEfektif,
    persenSisaEfektif,
    persenTerpakaiTotal,
    persenSisaTotal,
    areaSisa: areaSisaTotal,
    persenSisa: persenSisaTotal,
    persenTerpakai: persenTerpakaiTotal,
  });
}

function buatUniformLayout(
  W: number,
  H: number,
  itemW: number,
  itemH: number,
  gap: number,
  originalItemW: number,
  originalItemH: number,
  orientasi: Orientasi,
  planoWidth: number,
  planoHeight: number
): LayoutDraft {
  const kolom = countFit(W, itemW, gap);
  const baris = countFit(H, itemH, gap);
  const count = kolom * baris;

  return {
    name: "Uniform " + orientasi,
    type: "uniform",
    planoWidth,
    planoHeight,
    areaWidth: W,
    areaHeight: H,
    originalItemW,
    originalItemH,
    blocks: [
      {
        label: orientasi,
        orientation: orientasi,
        x: 0,
        y: 0,
        w: itemW,
        h: itemH,
        cols: kolom,
        rows: baris,
        count,
        regionW: usedSize(kolom, itemW, gap),
        regionH: usedSize(baris, itemH, gap),
      },
    ],
  };
}

function buatMixedLayouts(
  W: number,
  H: number,
  itemW: number,
  itemH: number,
  gap: number,
  planoWidth: number,
  planoHeight: number
): Layout[] {
  const layouts: Layout[] = [];

  const orientations: { label: Orientasi; w: number; h: number }[] = [
    { label: "Horizontal", w: itemW, h: itemH },
    { label: "Vertikal", w: itemH, h: itemW },
  ];

  const originalItemW = itemW;
  const originalItemH = itemH;

  orientations.forEach((main) => {
    const secondary = main.label === "Horizontal" ? orientations[1] : orientations[0];

    const maxMainCols = countFit(W, main.w, gap);
    const maxMainRows = countFit(H, main.h, gap);

    for (let mainCols = 0; mainCols <= maxMainCols; mainCols++) {
      for (let mainRows = 0; mainRows <= maxMainRows; mainRows++) {
        const mainCount = mainCols * mainRows;
        if (mainCount <= 0) continue;

        const mainUsedW = usedSize(mainCols, main.w, gap);
        const mainUsedH = usedSize(mainRows, main.h, gap);

        // Variant A: sisa kanan setinggi area utama, sisa bawah selebar seluruh plano.
        const blocksA: LayoutBlock[] = [
          {
            label: "Area utama",
            orientation: main.label,
            x: 0,
            y: 0,
            w: main.w,
            h: main.h,
            cols: mainCols,
            rows: mainRows,
            count: mainCount,
            regionW: mainUsedW,
            regionH: mainUsedH,
          },
        ];

        const rightX = mainUsedW + gap;
        const rightW = W - rightX;
        const rightH = mainUsedH;

        if (rightW > 0 && rightH > 0) {
          const rightCols = countFit(rightW, secondary.w, gap);
          const rightRows = countFit(rightH, secondary.h, gap);
          const rightCount = rightCols * rightRows;
          if (rightCount > 0) {
            blocksA.push({
              label: "Sisa kanan",
              orientation: secondary.label,
              x: rightX,
              y: 0,
              w: secondary.w,
              h: secondary.h,
              cols: rightCols,
              rows: rightRows,
              count: rightCount,
              regionW: usedSize(rightCols, secondary.w, gap),
              regionH: usedSize(rightRows, secondary.h, gap),
            });
          }
        }

        const bottomY = mainUsedH + gap;
        const bottomW = W;
        const bottomH = H - bottomY;

        if (bottomW > 0 && bottomH > 0) {
          const bottomCols = countFit(bottomW, secondary.w, gap);
          const bottomRows = countFit(bottomH, secondary.h, gap);
          const bottomCount = bottomCols * bottomRows;
          if (bottomCount > 0) {
            blocksA.push({
              label: "Sisa bawah",
              orientation: secondary.label,
              x: 0,
              y: bottomY,
              w: secondary.w,
              h: secondary.h,
              cols: bottomCols,
              rows: bottomRows,
              count: bottomCount,
              regionW: usedSize(bottomCols, secondary.w, gap),
              regionH: usedSize(bottomRows, secondary.h, gap),
            });
          }
        }

        tambahLayout(layouts, {
          name: `Mixed A: utama ${main.label}, sisa ${secondary.label}`,
          type: "mixed",
          planoWidth,
          planoHeight,
          areaWidth: W,
          areaHeight: H,
          originalItemW,
          originalItemH,
          blocks: blocksA,
        });

        // Variant B: sisa kanan setinggi seluruh plano, sisa bawah hanya selebar area utama.
        const blocksB: LayoutBlock[] = [
          {
            label: "Area utama",
            orientation: main.label,
            x: 0,
            y: 0,
            w: main.w,
            h: main.h,
            cols: mainCols,
            rows: mainRows,
            count: mainCount,
            regionW: mainUsedW,
            regionH: mainUsedH,
          },
        ];

        const rightXAlt = mainUsedW + gap;
        const rightWAlt = W - rightXAlt;
        const rightHAlt = H;

        if (rightWAlt > 0 && rightHAlt > 0) {
          const rightColsAlt = countFit(rightWAlt, secondary.w, gap);
          const rightRowsAlt = countFit(rightHAlt, secondary.h, gap);
          const rightCountAlt = rightColsAlt * rightRowsAlt;
          if (rightCountAlt > 0) {
            blocksB.push({
              label: "Sisa kanan penuh",
              orientation: secondary.label,
              x: rightXAlt,
              y: 0,
              w: secondary.w,
              h: secondary.h,
              cols: rightColsAlt,
              rows: rightRowsAlt,
              count: rightCountAlt,
              regionW: usedSize(rightColsAlt, secondary.w, gap),
              regionH: usedSize(rightRowsAlt, secondary.h, gap),
            });
          }
        }

        const bottomXAlt = 0;
        const bottomYAlt = mainUsedH + gap;
        const bottomWAlt = mainUsedW;
        const bottomHAlt = H - bottomYAlt;

        if (bottomWAlt > 0 && bottomHAlt > 0) {
          const bottomColsAlt = countFit(bottomWAlt, secondary.w, gap);
          const bottomRowsAlt = countFit(bottomHAlt, secondary.h, gap);
          const bottomCountAlt = bottomColsAlt * bottomRowsAlt;
          if (bottomCountAlt > 0) {
            blocksB.push({
              label: "Sisa bawah utama",
              orientation: secondary.label,
              x: bottomXAlt,
              y: bottomYAlt,
              w: secondary.w,
              h: secondary.h,
              cols: bottomColsAlt,
              rows: bottomRowsAlt,
              count: bottomCountAlt,
              regionW: usedSize(bottomColsAlt, secondary.w, gap),
              regionH: usedSize(bottomRowsAlt, secondary.h, gap),
            });
          }
        }

        tambahLayout(layouts, {
          name: `Mixed B: utama ${main.label}, sisa ${secondary.label}`,
          type: "mixed",
          planoWidth,
          planoHeight,
          areaWidth: W,
          areaHeight: H,
          originalItemW,
          originalItemH,
          blocks: blocksB,
        });
      }
    }
  });

  return layouts;
}

export function cariLayoutTerbaik(
  W: number,
  H: number,
  itemW: number,
  itemH: number,
  gap: number,
  planoWidth: number,
  planoHeight: number
): Layout | null {
  const layouts: Layout[] = [];

  tambahLayout(layouts, buatUniformLayout(W, H, itemW, itemH, gap, itemW, itemH, "Horizontal", planoWidth, planoHeight));
  tambahLayout(layouts, buatUniformLayout(W, H, itemH, itemW, gap, itemW, itemH, "Vertikal", planoWidth, planoHeight));

  buatMixedLayouts(W, H, itemW, itemH, gap, planoWidth, planoHeight).forEach((layout) => layouts.push(layout));

  layouts.sort((a, b) => {
    if (b.totalPotong !== a.totalPotong) return b.totalPotong - a.totalPotong;
    if (a.persenSisaTotal !== b.persenSisaTotal) return a.persenSisaTotal - b.persenSisaTotal;
    return a.blocks.length - b.blocks.length;
  });

  return layouts[0] ?? null;
}

export function ringkasKomposisi(layout: Layout): string {
  let horizontal = 0;
  let vertikal = 0;
  layout.blocks.forEach((block) => {
    if (block.orientation === "Horizontal") horizontal += block.count;
    if (block.orientation === "Vertikal") vertikal += block.count;
  });
  return `${horizontal} horizontal + ${vertikal} vertikal`;
}

// ---------------- Orkestrasi Penuh ----------------

export interface BiayaLainItem {
  label: string;
  nominal: number;
}

export interface HppCalculatorInput {
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
  hargaKertasPlanoOverride?: number | null;
  jenisLaminating: JenisLaminating;
  hargaLaminatingPerPlanoOverride?: number | null;
  paramFoil: number;
  hargaFoilPerPlanoOverride?: number | null;
  metodeCetak: MetodeCetak;
  jumlahWarna: number;
  hargaPerPelat: number;
  jumlahDesain: number;
  hargaTintaPerKg: number;
  coverageTinta: number;
  dayaTutupTinta: number;
  digitalMode: DigitalPrintMode;
  hargaCetakDigital: number;
  biayaLain: BiayaLainItem[];
}

export interface HppCalculatorResult {
  panjangEfektif: number;
  lebarEfektif: number;
  terbaik: Layout;
  planoDibutuhkan: number;
  wastePlano: number;
  planoProduksi: number;
  totalKapasitasTanpaWaste: number;
  totalKapasitas: number;
  sisaProduksi: number;
  hargaKertas: HargaKertasResult;
  hargaPond: HargaPondResult;
  hargaLaminating: HargaLaminatingResult;
  hargaFoil: HargaFoilResult;
  biayaPerPlano: number;
  subtotalPlanoBased: number;
  metodeCetak: MetodeCetak;
  pelat: BiayaPelatResult;
  tinta: BiayaTintaResult;
  cetakDigital: BiayaCetakDigitalResult;
  biayaLainTotal: number;
  totalOneTime: number;
  totalBiayaProduksi: number;
  hargaPerPotong: number;
}

export function hitungHppProduksi(input: HppCalculatorInput): HppCalculatorResult | { error: string } {
  const {
    panjangPlano,
    lebarPlano,
    panjangPotong,
    lebarPotong,
    marginKiri,
    marginKanan,
    marginAtas,
    marginBawah,
    gap,
    jumlahOrder,
    gsm,
    metodeHargaKertas,
    hargaKertasRim,
    hargaPerKg,
    hargaKertasPlanoOverride,
    jenisLaminating,
    hargaLaminatingPerPlanoOverride,
    paramFoil,
    hargaFoilPerPlanoOverride,
    metodeCetak,
    jumlahWarna,
    hargaPerPelat,
    jumlahDesain,
    hargaTintaPerKg,
    coverageTinta,
    dayaTutupTinta,
    digitalMode,
    hargaCetakDigital,
    biayaLain,
  } = input;

  if (panjangPlano <= 0 || lebarPlano <= 0 || panjangPotong <= 0 || lebarPotong <= 0) {
    return { error: "Ukuran plano dan ukuran potong harus lebih dari 0." };
  }
  if (gap < 0) return { error: "Gap tidak boleh negatif." };
  if (marginKiri < 0 || marginKanan < 0 || marginAtas < 0 || marginBawah < 0) {
    return { error: "Margin tidak boleh negatif." };
  }
  if (gsm <= 0) return { error: "GSM harus lebih dari 0." };
  if (jumlahOrder <= 0) return { error: "Jumlah order harus lebih dari 0." };
  if (metodeHargaKertas === "rim" && hargaKertasRim < 0) return { error: "Harga kertas per rim tidak boleh negatif." };
  if (metodeHargaKertas === "kg" && hargaPerKg < 0) return { error: "Harga kertas per kg tidak boleh negatif." };
  if (metodeCetak === "offset") {
    if (hargaPerPelat < 0 || hargaTintaPerKg < 0) return { error: "Harga pelat dan tinta tidak boleh negatif." };
    if (coverageTinta < 0 || coverageTinta > 100) return { error: "Coverage tinta harus antara 0% dan 100%." };
    if (dayaTutupTinta <= 0) return { error: "Daya tutup tinta harus lebih dari 0." };
    if (jumlahWarna <= 0 || jumlahDesain <= 0) return { error: "Jumlah warna dan jumlah desain harus lebih dari 0." };
  } else if (hargaCetakDigital < 0) {
    return { error: "Harga cetak digital tidak boleh negatif." };
  }

  const panjangEfektif = panjangPlano - marginKiri - marginKanan;
  const lebarEfektif = lebarPlano - marginAtas - marginBawah;
  if (panjangEfektif <= 0 || lebarEfektif <= 0) {
    return { error: "Margin terlalu besar sehingga area efektif tidak valid." };
  }

  const terbaik = cariLayoutTerbaik(panjangEfektif, lebarEfektif, panjangPotong, lebarPotong, gap, panjangPlano, lebarPlano);
  if (!terbaik || terbaik.totalPotong <= 0) {
    return { error: "Ukuran potong tidak muat di dalam plano dengan margin tersebut." };
  }

  const planoDibutuhkan = Math.ceil(jumlahOrder / terbaik.totalPotong);
  const wastePlano = Math.ceil(planoDibutuhkan * 0.05);
  const planoProduksi = planoDibutuhkan + wastePlano;

  const totalKapasitasTanpaWaste = planoDibutuhkan * terbaik.totalPotong;
  const totalKapasitas = planoProduksi * terbaik.totalPotong;
  const sisaProduksi = totalKapasitas - jumlahOrder;

  const hargaKertas = hitungHargaKertas(
    { metodeHargaKertas, hargaKertasRim, hargaPerKg, panjangPlano, lebarPlano, gsm },
    hargaKertasPlanoOverride
  );
  const hargaPond = hitungHargaPond({ panjangPlano, lebarPlano, gsm, jumlahPlanoDibutuhkan: planoProduksi });
  const hargaLaminating = hitungHargaLaminating(
    { panjangPlano, lebarPlano, jenisLaminating, jumlahPlanoDibutuhkan: planoProduksi },
    hargaLaminatingPerPlanoOverride
  );
  const hargaFoil = hitungHargaFoil(
    { panjangPlano, lebarPlano, paramFoil, jumlahPlanoDibutuhkan: planoProduksi },
    hargaFoilPerPlanoOverride
  );

  const biayaPerPlano =
    hargaKertas.hargaKertasPlano + hargaPond.hargaPondPerPlano + hargaLaminating.hargaLaminatingPerPlano + hargaFoil.hargaFoilPerPlano;
  const subtotalPlanoBased = biayaPerPlano * planoProduksi;

  const pelat = hitungBiayaPelat({
    jumlahWarna: metodeCetak === "offset" ? jumlahWarna : 0,
    jumlahDesain: metodeCetak === "offset" ? jumlahDesain : 0,
    hargaPerPelat,
  });
  const tinta = hitungBiayaTinta({
    panjangPlano,
    lebarPlano,
    planoProduksi,
    jumlahWarna: metodeCetak === "offset" ? jumlahWarna : 0,
    coverageTinta,
    dayaTutupTinta: dayaTutupTinta || 1,
    hargaTintaPerKg,
  });
  const cetakDigital = hitungBiayaCetakDigital({
    digitalMode,
    hargaCetakDigital: metodeCetak === "digital" ? hargaCetakDigital : 0,
    planoProduksi,
    jumlahOrder,
  });

  const biayaLainTotal = biayaLain.reduce((sum, item) => sum + item.nominal, 0);
  const biayaCetak = metodeCetak === "offset" ? pelat.totalBiayaPelat + tinta.totalBiayaTinta : cetakDigital.totalBiayaCetakDigital;
  const totalOneTime = biayaCetak + biayaLainTotal;
  const totalBiayaProduksi = Math.ceil(subtotalPlanoBased + totalOneTime);
  const hargaPerPotong = jumlahOrder > 0 ? Math.ceil(totalBiayaProduksi / jumlahOrder) : 0;

  return {
    panjangEfektif,
    lebarEfektif,
    terbaik,
    planoDibutuhkan,
    wastePlano,
    planoProduksi,
    totalKapasitasTanpaWaste,
    totalKapasitas,
    sisaProduksi,
    hargaKertas,
    hargaPond,
    hargaLaminating,
    hargaFoil,
    biayaPerPlano,
    subtotalPlanoBased,
    metodeCetak,
    pelat,
    tinta,
    cetakDigital,
    biayaLainTotal,
    totalOneTime,
    totalBiayaProduksi,
    hargaPerPotong,
  };
}

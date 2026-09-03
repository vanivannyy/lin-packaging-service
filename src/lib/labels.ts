export const TERM_LABEL: Record<string, string> = {
  CBD: "CBD",
  NET_15: "NET 15",
  NET_30: "NET 30",
  NET_45: "NET 45",
  NET_60: "NET 60",
};

export const PROCESS_LABEL: Record<string, string> = {
  PREPRESS: "Prepress",
  MATERIAL: "Material",
  PRINTING: "Printing",
  LAMINATING: "Laminating",
  FINISHING: "Finishing",
  POND: "Pond",
  PACKING: "Packing",
  QC: "QC",
  REWORK: "Rework",
  COMPLETED: "Completed",
};

// Urutan tetap langkah "Proses Produksi" yang ditampilkan di modal detail Work Order.
export const WO_DETAIL_STEPS: { process: string; label: string }[] = [
  { process: "PREPRESS", label: "Prepress" },
  { process: "MATERIAL", label: "Material" },
  { process: "PRINTING", label: "Printing" },
  { process: "LAMINATING", label: "Laminating" },
  { process: "FINISHING", label: "Finishing" },
  { process: "QC", label: "QC" },
  { process: "PACKING", label: "Packing" },
];

export const WO_STEP_STATUS_LABEL: Record<string, string> = {
  WAITING: "Waiting",
  IN_PROGRESS: "In Progress",
  DONE: "Done",
};

export const WO_STAGE_LABEL: Record<string, string> = {
  WAITING: "Waiting",
  READY: "Ready",
  IN_PRODUCTION: "In Production",
  QC: "QC",
  PACKING: "Packing",
  REWORK: "Rework",
  DONE: "Completed",
};

export const DELIVERY_STAGE_LABEL: Record<string, string> = {
  READY: "Ready",
  IN_DELIVERY: "In Delivery",
  PENDING: "Pending",
  DELIVERED: "Delivered",
};

export const MATERIAL_CATEGORY_LABEL: Record<string, string> = {
  PAPER: "Paper",
  FILM: "Film",
  FOIL: "Foil",
  INK: "Ink",
  OTHER: "Other",
};

export const PRICE_CATEGORY_LABEL: Record<string, string> = {
  PAPER: "Paper",
  FINISHING: "Finishing",
  LABOR: "Labor",
  OUTSOURCING: "Outsourcing",
  OVERHEAD: "Overhead",
};

export const PAYMENT_METHOD_LABEL: Record<string, string> = {
  CASH: "Cash",
  TRANSFER: "Transfer",
  QRIS: "QRIS",
  CARD: "Card",
};

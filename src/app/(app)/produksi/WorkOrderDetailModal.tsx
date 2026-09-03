"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { ClipboardList, Upload, X } from "lucide-react";
import { formatDateTime, formatNumber, formatPercent } from "@/lib/format";
import { PROCESS_LABEL, WO_DETAIL_STEPS, WO_STAGE_LABEL, WO_STEP_STATUS_LABEL } from "@/lib/labels";
import {
  requestPrepressRevisionAction,
  startWorkOrderStepAction,
  submitProductionLogAction,
  submitQcCheckAction,
  uploadPrepressDesignAction,
} from "./actions";
import type { WorkOrderCardData } from "./KanbanBoard";

const STAGE_BADGE_CLASS: Record<string, string> = {
  WAITING: "border-gray-200 bg-gray-50 text-gray-500",
  READY: "border-blue-200 bg-blue-50 text-blue-700",
  IN_PRODUCTION: "border-indigo-200 bg-indigo-50 text-indigo-700",
  QC: "border-amber-200 bg-amber-50 text-amber-700",
  PACKING: "border-purple-200 bg-purple-50 text-purple-700",
  REWORK: "border-red-200 bg-red-50 text-red-600",
  DONE: "border-emerald-200 bg-emerald-50 text-emerald-700",
};

const STEP_STATUS_CLASS: Record<string, string> = {
  WAITING: "bg-gray-100 text-gray-500",
  IN_PROGRESS: "bg-blue-100 text-blue-700",
  DONE: "bg-emerald-100 text-emerald-700",
};

const QC_CHECK_LABEL: Record<string, string> = { PRINTING: "QC Printing", FINISHING: "QC Finishing" };

const fieldClass =
  "w-full rounded-md border border-gray-300 px-3 py-2 text-sm outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500";
const inputClass = `h-10 ${fieldClass}`;

function formatFoil(paramFoil: number): string {
  return paramFoil > 0 ? `Foil ${paramFoil}` : "Tanpa Foil";
}

function InfoItem({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-[10px] font-semibold uppercase tracking-wide text-gray-400">{label}</p>
      <p className="mt-0.5 text-sm font-medium text-gray-900">{value}</p>
    </div>
  );
}

function MaterialSpecSection({ workOrder }: { workOrder: WorkOrderCardData }) {
  const spec = workOrder.materialSpec as
    | {
        gsm?: number;
        panjangPlano?: number;
        lebarPlano?: number;
        panjangPotong?: number;
        lebarPotong?: number;
        metodeHargaKertas?: "rim" | "kg";
        hargaKertasRim?: number;
        hargaPerKg?: number;
        namaLaminating?: string;
        paramFoil?: number;
        jumlahWarna?: number;
        jumlahDesain?: number;
      }
    | null;

  return (
    <div className="rounded-lg border border-gray-200 bg-white p-4">
      <p className="mb-3 text-xs font-semibold uppercase tracking-wide text-gray-500">Detail Bahan &amp; Finishing</p>
      {!spec ? (
        <p className="text-sm text-gray-400">
          {workOrder.defaultMaterialName
            ? `Material default: ${workOrder.defaultMaterialName}. Belum ada detail dari Kalkulator HPP.`
            : "Belum ada detail bahan/finishing tersimpan (Sales Order ini tidak dibuat dari Kalkulator HPP)."}
        </p>
      ) : (
        <div className="grid grid-cols-2 gap-x-6 gap-y-3 sm:grid-cols-3">
          <InfoItem label="GSM Kertas" value={spec.gsm ? `${spec.gsm} gsm` : "-"} />
          <InfoItem
            label="Ukuran Plano"
            value={spec.panjangPlano && spec.lebarPlano ? `${spec.panjangPlano} × ${spec.lebarPlano} cm` : "-"}
          />
          <InfoItem
            label="Ukuran Jadi"
            value={spec.panjangPotong && spec.lebarPotong ? `${spec.panjangPotong} × ${spec.lebarPotong} cm` : "-"}
          />
          <InfoItem
            label="Harga Kertas"
            value={
              spec.metodeHargaKertas === "rim"
                ? `Rp ${formatNumber(spec.hargaKertasRim ?? 0)} / rim`
                : `Rp ${formatNumber(spec.hargaPerKg ?? 0)} / kg`
            }
          />
          <InfoItem label="Laminating" value={spec.namaLaminating ?? "-"} />
          <InfoItem label="Foil" value={formatFoil(spec.paramFoil ?? 0)} />
          <InfoItem label="Jumlah Warna" value={spec.jumlahWarna ? `${spec.jumlahWarna} warna` : "-"} />
          <InfoItem label="Jumlah Desain" value={spec.jumlahDesain ? `${spec.jumlahDesain} desain` : "-"} />
        </div>
      )}
    </div>
  );
}

function StatBox({ label, value, valueColor }: { label: string; value: string; valueColor?: string }) {
  return (
    <div className="rounded-lg border border-gray-200 p-3 text-center">
      <p className="text-[10px] font-semibold uppercase tracking-wide text-gray-400">{label}</p>
      <p className={`mt-1 text-xl font-bold ${valueColor ?? "text-gray-900"}`}>{value}</p>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="mb-1 block text-[11px] font-medium uppercase tracking-wide text-gray-500">{label}</label>
      {children}
    </div>
  );
}

function QcCheckButton({ workOrderId, checkType }: { workOrderId: string; checkType: "PRINTING" | "FINISHING" }) {
  const [open, setOpen] = useState(false);
  return (
    <div>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex items-center gap-1.5 rounded-md border border-blue-200 bg-blue-50 px-3 py-1.5 text-xs font-semibold text-blue-700 hover:bg-blue-100"
      >
        <ClipboardList size={13} /> {QC_CHECK_LABEL[checkType]}
      </button>
      {open ? (
        <div className="mt-2 flex items-center gap-2 rounded-md border border-gray-200 p-2">
          <form action={submitQcCheckAction} onSubmit={() => setOpen(false)}>
            <input type="hidden" name="workOrderId" value={workOrderId} />
            <input type="hidden" name="checkType" value={checkType} />
            <input type="hidden" name="passed" value="true" />
            <button className="rounded-md border border-emerald-200 px-2 py-1 text-[11px] font-semibold text-emerald-700 hover:bg-emerald-50">
              Lulus
            </button>
          </form>
          <form action={submitQcCheckAction} onSubmit={() => setOpen(false)}>
            <input type="hidden" name="workOrderId" value={workOrderId} />
            <input type="hidden" name="checkType" value={checkType} />
            <input type="hidden" name="passed" value="false" />
            <button className="rounded-md border border-red-200 px-2 py-1 text-[11px] font-semibold text-red-600 hover:bg-red-50">
              Reject
            </button>
          </form>
        </div>
      ) : null}
    </div>
  );
}

function PrepressUploadBox({ workOrder, isDone }: { workOrder: WorkOrderCardData; isDone: boolean }) {
  const [pending, startTransition] = useTransition();
  const [showRevision, setShowRevision] = useState(false);
  const formRef = useRef<HTMLFormElement>(null);

  function handleUpload(formData: FormData) {
    startTransition(async () => {
      await uploadPrepressDesignAction(formData);
      formRef.current?.reset();
    });
  }

  return (
    <div className="mt-2 space-y-2 rounded-md border border-dashed border-gray-300 bg-gray-50 p-2.5">
      {workOrder.prepressDesignUrl ? (
        <div className="flex items-center gap-2">
          <a
            href={workOrder.prepressDesignUrl}
            target="_blank"
            rel="noreferrer"
            className="overflow-hidden rounded-md border border-gray-200 bg-white"
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={workOrder.prepressDesignUrl} alt="Screenshot design" className="h-14 w-14 object-cover" />
          </a>
          <div className="min-w-0 flex-1 text-[11px] text-gray-500">
            <p className="truncate font-medium text-emerald-700">Screenshot design tersimpan</p>
            {workOrder.prepressDesignUploadedAt ? <p>{formatDateTime(workOrder.prepressDesignUploadedAt)}</p> : null}
          </div>
        </div>
      ) : (
        <p className="text-[11px] font-medium text-red-500">Wajib upload screenshot design sebelum menandai selesai.</p>
      )}

      <form ref={formRef} action={handleUpload} className="flex items-center gap-2">
        <input type="hidden" name="workOrderId" value={workOrder.id} />
        <input
          type="file"
          name="file"
          accept="image/*"
          required
          className="block w-full text-[11px] text-gray-500 file:mr-2 file:rounded-md file:border-0 file:bg-blue-50 file:px-2 file:py-1 file:text-[11px] file:font-semibold file:text-blue-700 hover:file:bg-blue-100"
        />
        <button
          type="submit"
          disabled={pending}
          className="flex shrink-0 items-center gap-1 rounded-md border border-blue-200 bg-blue-50 px-2 py-1 text-[11px] font-semibold text-blue-700 hover:bg-blue-100 disabled:opacity-50"
        >
          <Upload size={12} /> {pending ? "..." : "Upload"}
        </button>
      </form>

      {isDone ? (
        showRevision ? (
          <form
            action={requestPrepressRevisionAction}
            onSubmit={() => setShowRevision(false)}
            className="flex items-center gap-2"
          >
            <input type="hidden" name="workOrderId" value={workOrder.id} />
            <input
              name="note"
              placeholder="Catatan revisi (opsional)"
              className="w-full rounded-md border border-amber-300 px-2 py-1 text-[11px] outline-none focus:border-amber-500"
            />
            <button className="shrink-0 rounded-md border border-amber-300 bg-amber-100 px-2 py-1 text-[11px] font-semibold text-amber-800 hover:bg-amber-200">
              Kirim
            </button>
          </form>
        ) : (
          <button
            type="button"
            onClick={() => setShowRevision(true)}
            className="rounded-md border border-amber-200 bg-amber-50 px-2 py-1 text-[11px] font-semibold text-amber-700 hover:bg-amber-100"
          >
            Minta Revisi
          </button>
        )
      ) : null}
    </div>
  );
}

export function WorkOrderDetailModal({ workOrder, onClose }: { workOrder: WorkOrderCardData; onClose: () => void }) {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const frame = requestAnimationFrame(() => setVisible(true));
    return () => cancelAnimationFrame(frame);
  }, []);

  function handleClose() {
    setVisible(false);
    setTimeout(onClose, 200);
  }

  const isWaiting = workOrder.stage === "WAITING";
  const totalQty = workOrder.goodQtyTotal + workOrder.rejectQtyTotal;
  const rejectPercent = totalQty > 0 ? (workOrder.rejectQtyTotal / totalQty) * 100 : 0;
  const stepByProcess = new Map(workOrder.stepProgress.map((s) => [s.process, s]));

  const timeline = [
    ...workOrder.productionLogs.map((log) => ({ kind: "log" as const, at: log.createdAt, log })),
    ...workOrder.qcChecks.map((qcCheck) => ({ kind: "qc" as const, at: qcCheck.createdAt, qcCheck })),
  ].sort((a, b) => new Date(b.at).getTime() - new Date(a.at).getTime());

  return (
    <div className="fixed inset-0 z-50 flex justify-end">
      <div
        className={`absolute inset-0 bg-black/40 transition-opacity duration-200 ${
          visible ? "opacity-100" : "opacity-0"
        }`}
        onClick={handleClose}
      />
      <div
        className={`relative flex h-full w-full max-w-md flex-col bg-white shadow-xl transition-transform duration-200 ease-out sm:max-w-lg ${
          visible ? "translate-x-0" : "translate-x-full"
        }`}
      >
        <div className="flex shrink-0 items-center justify-between gap-3 border-b border-gray-100 px-5 py-3.5">
          <div className="min-w-0">
            <p className="text-xs font-semibold text-blue-600">{workOrder.code}</p>
            <h2 className="truncate text-base font-bold text-gray-900">{workOrder.customerName}</h2>
            <p className="text-xs text-gray-500">
              {workOrder.productName} · {formatNumber(workOrder.qty)} pcs ·{" "}
              <span className="font-medium text-blue-600">{workOrder.soCode}</span>
            </p>
          </div>
          <div className="flex shrink-0 items-center gap-2">
            {workOrder.stage === "QC" && workOrder.qcPassed === true ? (
              <span className="rounded-md border border-emerald-200 bg-emerald-50 px-2 py-1 text-[10px] font-bold uppercase tracking-wide text-emerald-700">
                Lolos
              </span>
            ) : null}
            <span
              className={`rounded-md border px-2 py-1 text-[10px] font-bold uppercase tracking-wide ${
                STAGE_BADGE_CLASS[workOrder.stage] ?? "border-gray-200 bg-gray-50 text-gray-500"
              }`}
            >
              {WO_STAGE_LABEL[workOrder.stage] ?? workOrder.stage}
            </span>
            <button type="button" onClick={handleClose} className="text-gray-400 hover:text-gray-600">
              <X size={18} />
            </button>
          </div>
        </div>

        <div className="flex-1 space-y-4 overflow-y-auto px-5 py-4">
          <MaterialSpecSection workOrder={workOrder} />

          {!isWaiting ? (
            <>
              <div className="grid grid-cols-3 gap-3">
                <StatBox label="Good Qty" value={formatNumber(workOrder.goodQtyTotal)} />
                <StatBox label="Reject Qty" value={formatNumber(workOrder.rejectQtyTotal)} valueColor="text-red-600" />
                <StatBox label="Reject %" value={formatPercent(rejectPercent)} />
              </div>

              <form action={submitProductionLogAction} key={workOrder.productionLogs.length} className="space-y-3">
                <input type="hidden" name="workOrderId" value={workOrder.id} />
                <div className="grid grid-cols-3 gap-3">
                  <Field label="Qty Good">
                    <input name="goodQty" type="number" min={0} defaultValue={0} className={inputClass} />
                  </Field>
                  <Field label="Qty Reject">
                    <input name="rejectQty" type="number" min={0} defaultValue={0} className={inputClass} />
                  </Field>
                  <Field label="Downtime (menit)">
                    <input name="downtimeMinutes" type="number" min={0} defaultValue={0} className={inputClass} />
                  </Field>
                </div>
                <Field label="Catatan / laporan masalah">
                  <textarea name="note" rows={2} className={`${fieldClass} resize-none`} placeholder="Opsional" />
                </Field>
                <button
                  type="submit"
                  className="w-full rounded-md bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700 sm:w-auto"
                >
                  Simpan Log
                </button>
              </form>

              <div>
                <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-gray-500">Proses Produksi</p>
                <div className="space-y-2">
                  {WO_DETAIL_STEPS.map((step, idx) => {
                    const progress = stepByProcess.get(step.process);
                    const status = progress?.status ?? "WAITING";
                    const isPrepress = step.process === "PREPRESS";
                    const blockDone = isPrepress && !workOrder.prepressDesignUrl;
                    return (
                      <div key={step.process} className="rounded-lg border border-gray-200 px-3 py-2.5">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-3">
                            <span className="text-xs font-semibold text-gray-400">{idx + 1}</span>
                            <div>
                              <p className="text-sm font-semibold uppercase text-gray-900">{step.label}</p>
                              <div className="mt-1 flex items-center gap-2">
                                <span
                                  className={`rounded px-1.5 py-0.5 text-[10px] font-bold uppercase ${STEP_STATUS_CLASS[status]}`}
                                >
                                  {WO_STEP_STATUS_LABEL[status]}
                                </span>
                                <span className="text-[11px] text-gray-400">
                                  G {progress?.goodQty ?? 0} / R {progress?.rejectQty ?? 0}
                                </span>
                              </div>
                            </div>
                          </div>
                          {status === "DONE" ? (
                            <span className="text-xs font-semibold text-emerald-600">✓ Selesai</span>
                          ) : (
                            <form action={startWorkOrderStepAction}>
                              <input type="hidden" name="workOrderId" value={workOrder.id} />
                              <input type="hidden" name="process" value={step.process} />
                              <button
                                disabled={blockDone && status === "IN_PROGRESS"}
                                title={blockDone && status === "IN_PROGRESS" ? "Upload screenshot design dulu" : undefined}
                                className="rounded-md border border-gray-200 px-2.5 py-1 text-[11px] font-semibold text-gray-600 hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-40"
                              >
                                {status === "IN_PROGRESS" ? "Selesai" : "▷ Mulai"}
                              </button>
                            </form>
                          )}
                        </div>
                        {isPrepress ? <PrepressUploadBox workOrder={workOrder} isDone={status === "DONE"} /> : null}
                      </div>
                    );
                  })}
                </div>
              </div>

              <div>
                <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-gray-500">Checklist QC</p>
                <div className="flex flex-wrap gap-2">
                  {(["PRINTING", "FINISHING"] as const).map((checkType) => (
                    <QcCheckButton key={checkType} workOrderId={workOrder.id} checkType={checkType} />
                  ))}
                </div>
                <div className="mt-2 space-y-1.5">
                  {workOrder.qcChecks.length === 0 ? (
                    <p className="text-sm text-gray-400">Belum ada inspeksi QC.</p>
                  ) : (
                    workOrder.qcChecks.map((qcCheck) => (
                      <div key={qcCheck.id} className="flex items-center justify-between text-xs">
                        <span className="font-medium text-gray-700">
                          {QC_CHECK_LABEL[qcCheck.checkType] ?? qcCheck.checkType}
                          {qcCheck.note ? ` — ${qcCheck.note}` : ""}
                        </span>
                        <span className={qcCheck.passed ? "font-semibold text-emerald-600" : "font-semibold text-red-600"}>
                          {qcCheck.passed ? "Lulus" : "Reject"}
                        </span>
                      </div>
                    ))
                  )}
                </div>
              </div>

              <div>
                <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-gray-500">Log Produksi</p>
                <div className="rounded-lg border border-gray-200 p-3">
                  {timeline.length === 0 ? (
                    <p className="py-6 text-center text-sm text-gray-400">Belum ada log produksi</p>
                  ) : (
                    <ol className="space-y-2.5">
                      {timeline.map((entry) =>
                        entry.kind === "log" ? (
                          <li key={`log-${entry.log.id}`} className="border-l-2 border-blue-200 pl-3 text-xs">
                            <p className="text-gray-400">
                              {formatDateTime(entry.at)} · {entry.log.userName}
                            </p>
                            <p className="font-medium text-gray-800">
                              {entry.log.process ? `${PROCESS_LABEL[entry.log.process] ?? entry.log.process} · ` : ""}
                              G {entry.log.goodQty} / R {entry.log.rejectQty}
                              {entry.log.downtimeMinutes ? ` · Downtime ${entry.log.downtimeMinutes} menit` : ""}
                            </p>
                            {entry.log.note ? <p className="text-gray-500">{entry.log.note}</p> : null}
                          </li>
                        ) : (
                          <li key={`qc-${entry.qcCheck.id}`} className="border-l-2 border-amber-200 pl-3 text-xs">
                            <p className="text-gray-400">
                              {formatDateTime(entry.at)} · {entry.qcCheck.userName}
                            </p>
                            <p className="font-medium text-gray-800">
                              {QC_CHECK_LABEL[entry.qcCheck.checkType] ?? entry.qcCheck.checkType} —{" "}
                              <span className={entry.qcCheck.passed ? "text-emerald-600" : "text-red-600"}>
                                {entry.qcCheck.passed ? "Lulus" : "Reject"}
                              </span>
                            </p>
                            {entry.qcCheck.note ? <p className="text-gray-500">{entry.qcCheck.note}</p> : null}
                          </li>
                        )
                      )}
                    </ol>
                  )}
                </div>
              </div>
            </>
          ) : null}
        </div>

        <div className="shrink-0 border-t border-gray-100 px-5 py-3.5">
          <button
            type="button"
            onClick={handleClose}
            className="w-full rounded-md border border-gray-200 px-4 py-2.5 text-sm font-semibold text-gray-600 hover:bg-gray-50"
          >
            Tutup
          </button>
        </div>
      </div>
    </div>
  );
}

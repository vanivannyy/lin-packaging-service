"use client";

import { useEffect, useState, useTransition } from "react";
import type { WorkOrderStage } from "@prisma/client";
import { formatDate } from "@/lib/format";
import { PROCESS_LABEL } from "@/lib/labels";
import { advanceWorkOrderAction, completePackingAction, moveToPackingAction, moveWorkOrderStageAction, qcResultAction } from "./actions";
import { WorkOrderDetailModal } from "./WorkOrderDetailModal";

export interface WorkOrderStepProgressData {
  process: string;
  status: string;
  goodQty: number;
  rejectQty: number;
}

export interface WorkOrderProductionLogData {
  id: string;
  process: string | null;
  goodQty: number;
  rejectQty: number;
  downtimeMinutes: number;
  note: string | null;
  userName: string;
  createdAt: string;
}

export interface WorkOrderQcCheckData {
  id: string;
  checkType: string;
  passed: boolean | null;
  note: string | null;
  userName: string;
  createdAt: string;
}

export interface WorkOrderCardData {
  id: string;
  code: string;
  priority: string;
  stage: WorkOrderStage;
  process: string;
  progressPercent: number;
  deadline: string | null;
  customerName: string;
  productName: string;
  qty: number;
  soCode: string;
  goodQtyTotal: number;
  rejectQtyTotal: number;
  qcPassed: boolean | null;
  prepressDesignUrl: string | null;
  prepressDesignUploadedAt: string | null;
  isInRevision: boolean;
  revisionCount: number;
  revisionNote: string | null;
  materialSpec: Record<string, unknown> | null;
  defaultMaterialName: string | null;
  stepProgress: WorkOrderStepProgressData[];
  productionLogs: WorkOrderProductionLogData[];
  qcChecks: WorkOrderQcCheckData[];
}

const COLUMNS: { stage: WorkOrderStage; label: string }[] = [
  { stage: "WAITING", label: "Waiting" },
  { stage: "READY", label: "Ready" },
  { stage: "IN_PRODUCTION", label: "In Production" },
  { stage: "QC", label: "QC" },
  { stage: "PACKING", label: "Packing" },
  { stage: "REWORK", label: "Rework" },
  { stage: "DONE", label: "Completed" },
];

// PACKING tidak boleh jadi target drag-and-drop - harus lewat tombol "Ke Packing".
const NON_DRAGGABLE_TARGET: WorkOrderStage[] = ["PACKING"];

function isPrepressReady(wo: WorkOrderCardData) {
  if (!wo.prepressDesignUrl || wo.isInRevision) return false;
  const prepress = wo.stepProgress.find((s) => s.process === "PREPRESS");
  return prepress?.status === "DONE";
}

// Merah = rework, Kuning = revisi prepress, Hijau = complete. Selain itu warna default.
function cardTone(wo: WorkOrderCardData): { border: string; bg: string; ring: string } {
  if (wo.stage === "REWORK") return { border: "border-red-300", bg: "bg-red-50/60", ring: "ring-red-200" };
  if (wo.isInRevision) return { border: "border-amber-300", bg: "bg-amber-50/60", ring: "ring-amber-200" };
  if (wo.stage === "DONE") return { border: "border-emerald-300", bg: "bg-emerald-50/60", ring: "ring-emerald-200" };
  return { border: "border-gray-200", bg: "bg-white", ring: "ring-gray-200" };
}

export function ProduksiKanbanBoard({ workOrders }: { workOrders: WorkOrderCardData[] }) {
  const [items, setItems] = useState(workOrders);
  const [draggingId, setDraggingId] = useState<string | null>(null);
  const [dragOverStage, setDragOverStage] = useState<WorkOrderStage | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [, startTransition] = useTransition();

  useEffect(() => {
    setItems(workOrders);
  }, [workOrders]);

  const selected = selectedId ? (items.find((w) => w.id === selectedId) ?? null) : null;

  const byStage = (stage: WorkOrderStage) => items.filter((wo) => wo.stage === stage);

  function handleDrop(toStage: WorkOrderStage) {
    setDragOverStage(null);
    const workOrderId = draggingId;
    setDraggingId(null);
    if (!workOrderId || NON_DRAGGABLE_TARGET.includes(toStage)) return;

    const wo = items.find((w) => w.id === workOrderId);
    if (!wo || wo.stage === toStage) return;

    const prevItems = items;
    setItems((prev) => prev.map((w) => (w.id === workOrderId ? { ...w, stage: toStage } : w)));

    startTransition(() => {
      moveWorkOrderStageAction(workOrderId, toStage).catch(() => {
        setItems(prevItems);
      });
    });
  }

  return (
    <div className="scrollbar-thin flex gap-3 overflow-x-auto pb-2">
      {COLUMNS.map((col) => {
        const colItems = byStage(col.stage);
        const isDragOver = dragOverStage === col.stage;
        const isDropDisabled = NON_DRAGGABLE_TARGET.includes(col.stage);

        return (
          <div
            key={col.stage}
            className="w-72 shrink-0"
            onDragOver={(e) => {
              if (isDropDisabled) return;
              e.preventDefault();
              if (dragOverStage !== col.stage) setDragOverStage(col.stage);
            }}
            onDragLeave={() => {
              setDragOverStage((prev) => (prev === col.stage ? null : prev));
            }}
            onDrop={(e) => {
              e.preventDefault();
              handleDrop(col.stage);
            }}
          >
            <div className="mb-2 flex items-center justify-between px-1">
              <p
                className={`text-xs font-semibold uppercase tracking-wide ${
                  col.stage === "REWORK"
                    ? "text-red-600"
                    : col.stage === "DONE"
                      ? "text-emerald-600"
                      : col.stage === "PACKING"
                        ? "text-purple-600"
                        : "text-gray-500"
                }`}
              >
                {col.label}
              </p>
              <span className="rounded-full bg-gray-200 px-2 py-0.5 text-[11px] font-semibold text-gray-600">
                {colItems.length}
              </span>
            </div>

            <div
              className={`min-h-[60px] space-y-2 rounded-lg transition ${
                isDragOver ? "bg-blue-50 ring-2 ring-blue-300 ring-inset" : ""
              }`}
            >
              {colItems.length === 0 ? (
                <div className="rounded-lg border border-dashed border-gray-200 p-4 text-center text-xs text-gray-400">
                  {isDragOver ? "Lepas di sini" : "Kosong"}
                </div>
              ) : (
                colItems.map((wo) => {
                  const isLate = col.stage !== "DONE" && wo.deadline ? new Date(wo.deadline) < new Date() : false;
                  const tone = cardTone(wo);
                  const prepressReady = isPrepressReady(wo);
                  return (
                    <div
                      key={wo.id}
                      draggable
                      onDragStart={(e) => {
                        setDraggingId(wo.id);
                        e.dataTransfer.effectAllowed = "move";
                        e.dataTransfer.setData("text/plain", wo.id);
                      }}
                      onDragEnd={() => {
                        setDraggingId(null);
                        setDragOverStage(null);
                      }}
                      onClick={() => setSelectedId(wo.id)}
                      className={`cursor-pointer rounded-lg border p-3 shadow-sm transition hover:shadow-md active:cursor-grabbing ${tone.border} ${tone.bg} ${
                        draggingId === wo.id ? "opacity-40" : ""
                      }`}
                    >
                      <div className="mb-1 flex items-center justify-between">
                        <p className="text-[11px] font-semibold text-blue-600">{wo.code}</p>
                        <span
                          className={`rounded-md border px-1.5 py-0.5 text-[10px] font-semibold ${
                            wo.priority === "URGENT"
                              ? "border-red-200 bg-red-50 text-red-600"
                              : "border-gray-200 bg-gray-50 text-gray-500"
                          }`}
                        >
                          {wo.priority}
                        </span>
                      </div>
                      <p className="text-sm font-semibold text-gray-900">{wo.customerName}</p>
                      <p className="text-xs text-gray-500">
                        {wo.productName} · {wo.qty.toLocaleString("id-ID")} pcs
                      </p>

                      <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-gray-100">
                        <div className="h-full rounded-full bg-blue-500" style={{ width: `${wo.progressPercent}%` }} />
                      </div>
                      <div className="mt-1 flex items-center justify-between text-[11px] text-gray-400">
                        <span>Proses: {PROCESS_LABEL[wo.process as keyof typeof PROCESS_LABEL]}</span>
                        <span>{wo.progressPercent}%</span>
                      </div>

                      <p className={`mt-1 text-[11px] ${isLate ? "font-semibold text-red-600" : "text-gray-400"}`}>
                        Deadline: {wo.deadline ? formatDate(wo.deadline, false) : "-"}
                      </p>

                      {wo.isInRevision ? (
                        <p className="mt-1 text-[11px] font-semibold text-amber-600">
                          Revisi prepress #{wo.revisionCount}
                          {wo.revisionNote ? ` — ${wo.revisionNote}` : ""}
                        </p>
                      ) : null}

                      <div className="mt-2.5 flex flex-wrap items-center gap-1.5" onClick={(e) => e.stopPropagation()}>
                        {col.stage === "WAITING" ? (
                          <form action={advanceWorkOrderAction}>
                            <input type="hidden" name="workOrderId" value={wo.id} />
                            <button className="rounded-md border border-gray-200 px-2 py-1 text-[11px] font-semibold text-gray-600 hover:bg-gray-50">
                              Material Siap
                            </button>
                          </form>
                        ) : col.stage === "READY" ? (
                          <form action={advanceWorkOrderAction}>
                            <input type="hidden" name="workOrderId" value={wo.id} />
                            <button
                              disabled={!prepressReady}
                              title={!prepressReady ? "Selesaikan Prepress (upload design) dahulu" : undefined}
                              className="rounded-md border border-gray-200 px-2 py-1 text-[11px] font-semibold text-gray-600 hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-40"
                            >
                              Mulai Produksi
                            </button>
                          </form>
                        ) : col.stage === "IN_PRODUCTION" ? (
                          <form action={advanceWorkOrderAction}>
                            <input type="hidden" name="workOrderId" value={wo.id} />
                            <button className="rounded-md border border-gray-200 px-2 py-1 text-[11px] font-semibold text-gray-600 hover:bg-gray-50">
                              Proses Selanjutnya
                            </button>
                          </form>
                        ) : col.stage === "QC" ? (
                          wo.qcPassed === true ? (
                            <>
                              <span className="rounded-md border border-emerald-200 bg-emerald-50 px-2 py-1 text-[11px] font-semibold text-emerald-700">
                                Lolos QC
                              </span>
                              <form action={moveToPackingAction}>
                                <input type="hidden" name="workOrderId" value={wo.id} />
                                <button className="rounded-md border border-purple-200 bg-purple-50 px-2 py-1 text-[11px] font-semibold text-purple-700 hover:bg-purple-100">
                                  Ke Packing
                                </button>
                              </form>
                            </>
                          ) : (
                            <>
                              <form action={qcResultAction}>
                                <input type="hidden" name="workOrderId" value={wo.id} />
                                <input type="hidden" name="passed" value="true" />
                                <button className="rounded-md border border-emerald-200 px-2 py-1 text-[11px] font-semibold text-emerald-700 hover:bg-emerald-50">
                                  Lulus QC
                                </button>
                              </form>
                              <form action={qcResultAction} className="flex items-center gap-1">
                                <input type="hidden" name="workOrderId" value={wo.id} />
                                <input type="hidden" name="passed" value="false" />
                                <input
                                  type="number"
                                  name="rejectRatePercent"
                                  defaultValue={5}
                                  min={0}
                                  max={100}
                                  step={0.1}
                                  title="Reject rate (%)"
                                  className="w-12 rounded-md border border-gray-200 px-1 py-1 text-[11px] outline-none focus:border-red-400"
                                />
                                <button className="rounded-md border border-red-200 px-2 py-1 text-[11px] font-semibold text-red-600 hover:bg-red-50">
                                  Reject
                                </button>
                              </form>
                            </>
                          )
                        ) : col.stage === "PACKING" ? (
                          <form action={completePackingAction}>
                            <input type="hidden" name="workOrderId" value={wo.id} />
                            <button className="rounded-md border border-purple-200 bg-purple-50 px-2 py-1 text-[11px] font-semibold text-purple-700 hover:bg-purple-100">
                              Packing Selesai
                            </button>
                          </form>
                        ) : col.stage === "DONE" ? (
                          <span className="rounded-md border border-emerald-200 bg-emerald-50 px-2 py-1 text-[11px] font-semibold text-emerald-700">
                            Selesai
                          </span>
                        ) : col.stage === "REWORK" ? (
                          <form action={advanceWorkOrderAction}>
                            <input type="hidden" name="workOrderId" value={wo.id} />
                            <button className="rounded-md border border-gray-200 px-2 py-1 text-[11px] font-semibold text-gray-600 hover:bg-gray-50">
                              Kirim ke QC
                            </button>
                          </form>
                        ) : null}
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>
        );
      })}

      {selected ? <WorkOrderDetailModal workOrder={selected} onClose={() => setSelectedId(null)} /> : null}
    </div>
  );
}

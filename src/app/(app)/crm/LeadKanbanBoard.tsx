"use client";

import { useEffect, useState, useTransition } from "react";
import { ArrowRight, UserPlus, XCircle } from "lucide-react";
import type { LeadStage } from "@prisma/client";
import { formatDate, formatRupiahCompact } from "@/lib/format";
import { nextStage } from "@/lib/lead-stage";
import { advanceLeadStageAction, convertLeadToCustomerAction, markLeadLostAction, moveLeadStageAction } from "./actions";

export interface LeadCardData {
  id: string;
  code: string;
  companyName: string;
  productNote: string | null;
  estimatedValue: number;
  stage: LeadStage;
  salesName: string | null;
  createdAt: string;
  hasCustomer: boolean;
}

const COLUMNS: { stage: LeadStage; label: string }[] = [
  { stage: "NEW", label: "New" },
  { stage: "CONTACTED", label: "Contacted" },
  { stage: "QUALIFIED", label: "Qualified" },
  { stage: "MEETING", label: "Meeting" },
  { stage: "QUOTATION", label: "Quotation" },
  { stage: "NEGOTIATION", label: "Negotiation" },
  { stage: "WON", label: "Won" },
  { stage: "LOST", label: "Lost" },
];

// WON hanya bisa didapat lewat aksi "Convert to Customer", tidak boleh jadi target drag & drop.
const NON_DRAGGABLE_TARGET: LeadStage[] = ["WON"];

export function LeadKanbanBoard({ leads }: { leads: LeadCardData[] }) {
  const [items, setItems] = useState(leads);
  const [draggingId, setDraggingId] = useState<string | null>(null);
  const [dragOverStage, setDragOverStage] = useState<LeadStage | null>(null);
  const [, startTransition] = useTransition();

  useEffect(() => {
    setItems(leads);
  }, [leads]);

  const byStage = (stage: LeadStage) => items.filter((l) => l.stage === stage);

  function handleDrop(toStage: LeadStage) {
    setDragOverStage(null);
    const leadId = draggingId;
    setDraggingId(null);
    if (!leadId || NON_DRAGGABLE_TARGET.includes(toStage)) return;

    const lead = items.find((l) => l.id === leadId);
    if (!lead || lead.stage === toStage) return;

    const prevItems = items;
    setItems((prev) => prev.map((l) => (l.id === leadId ? { ...l, stage: toStage } : l)));

    startTransition(() => {
      moveLeadStageAction(leadId, toStage).catch(() => {
        setItems(prevItems);
      });
    });
  }

  return (
    <div className="scrollbar-thin flex gap-3 overflow-x-auto pb-2">
      {COLUMNS.map((col) => {
        const colItems = byStage(col.stage);
        const totalValue = colItems.reduce((acc, l) => acc + l.estimatedValue, 0);
        const next = nextStage(col.stage);
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
                  col.stage === "LOST" ? "text-red-600" : col.stage === "WON" ? "text-emerald-600" : "text-gray-500"
                }`}
              >
                {col.label}
              </p>
              <span className="rounded-full bg-gray-200 px-2 py-0.5 text-[11px] font-semibold text-gray-600">
                {colItems.length}
              </span>
            </div>
            <p className="mb-2 px-1 text-xs font-semibold text-gray-400">{formatRupiahCompact(totalValue)}</p>

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
                colItems.map((lead) => (
                  <div
                    key={lead.id}
                    draggable={col.stage !== "WON"}
                    onDragStart={(e) => {
                      if (col.stage === "WON") return;
                      setDraggingId(lead.id);
                      e.dataTransfer.effectAllowed = "move";
                      e.dataTransfer.setData("text/plain", lead.id);
                    }}
                    onDragEnd={() => {
                      setDraggingId(null);
                      setDragOverStage(null);
                    }}
                    className={`rounded-lg border p-3 shadow-sm transition ${
                      col.stage === "WON"
                        ? "border-emerald-200 bg-emerald-50/50"
                        : col.stage === "LOST"
                          ? "cursor-grab border-red-200 bg-red-50/50 active:cursor-grabbing"
                          : "cursor-grab border-gray-200 bg-white active:cursor-grabbing"
                    } ${draggingId === lead.id ? "opacity-40" : ""}`}
                  >
                    <p className="text-[11px] font-semibold text-blue-600">{lead.code}</p>
                    <p className="text-sm font-semibold text-gray-900">{lead.companyName}</p>
                    {lead.productNote ? <p className="text-xs text-gray-500">{lead.productNote}</p> : null}
                    <p className="mt-1 text-sm font-bold text-gray-900">{formatRupiahCompact(lead.estimatedValue)}</p>
                    <p className="mt-0.5 text-[11px] text-gray-400">
                      {lead.salesName ?? "-"} · {formatDate(lead.createdAt, false)}
                    </p>

                    <div className="mt-2.5 flex flex-wrap items-center gap-1.5">
                      {col.stage === "WON" ? (
                        <span className="rounded-md border border-emerald-200 bg-emerald-50 px-2 py-1 text-[11px] font-semibold text-emerald-700">
                          Won
                        </span>
                      ) : col.stage === "LOST" ? (
                        <span className="rounded-md border border-red-200 bg-red-50 px-2 py-1 text-[11px] font-semibold text-red-600">
                          Lost
                        </span>
                      ) : (
                        <>
                          {next ? (
                            <form action={advanceLeadStageAction}>
                              <input type="hidden" name="leadId" value={lead.id} />
                              <input type="hidden" name="toStage" value={next} />
                              <button className="flex items-center gap-1 rounded-md border border-gray-200 px-2 py-1 text-[11px] font-semibold text-gray-600 hover:bg-gray-50">
                                {next} <ArrowRight size={11} />
                              </button>
                            </form>
                          ) : null}
                          {lead.hasCustomer ? (
                            <span className="rounded-md border border-emerald-200 bg-emerald-50 px-2 py-1 text-[11px] font-semibold text-emerald-700">
                              Customer
                            </span>
                          ) : (
                            <form action={convertLeadToCustomerAction}>
                              <input type="hidden" name="leadId" value={lead.id} />
                              <button className="flex items-center gap-1 rounded-md border border-blue-200 px-2 py-1 text-[11px] font-semibold text-blue-600 hover:bg-blue-50">
                                <UserPlus size={11} /> Customer
                              </button>
                            </form>
                          )}
                          <form action={markLeadLostAction}>
                            <input type="hidden" name="leadId" value={lead.id} />
                            <button className="flex items-center gap-1 rounded-md border border-red-200 px-2 py-1 text-[11px] font-semibold text-red-600 hover:bg-red-50">
                              <XCircle size={11} /> Lost
                            </button>
                          </form>
                        </>
                      )}
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}

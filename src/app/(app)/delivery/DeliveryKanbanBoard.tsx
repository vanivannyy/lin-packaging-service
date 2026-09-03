"use client";

import { useEffect, useState, useTransition } from "react";
import type { DeliveryStage } from "@prisma/client";
import { formatDate } from "@/lib/format";
import { moveDeliveryStageAction, updateDeliveryNoteAction } from "./actions";

export interface DeliveryCardData {
  id: string;
  code: string;
  stage: DeliveryStage;
  note: string | null;
  deliveredAt: string | null;
  createdAt: string;
  soCode: string;
  customerName: string;
  productName: string;
  qty: number;
  requestedDeliveryDate: string | null;
}

const COLUMNS: { stage: DeliveryStage; label: string }[] = [
  { stage: "READY", label: "Ready" },
  { stage: "IN_DELIVERY", label: "In Delivery" },
  { stage: "PENDING", label: "Pending" },
  { stage: "DELIVERED", label: "Delivered" },
];

const COLUMN_HEADER_CLASS: Record<DeliveryStage, string> = {
  READY: "bg-sky-50 text-sky-700 border-sky-200",
  IN_DELIVERY: "bg-blue-50 text-blue-700 border-blue-200",
  PENDING: "bg-amber-50 text-amber-700 border-amber-200",
  DELIVERED: "bg-emerald-50 text-emerald-700 border-emerald-200",
};

function cardTone(stage: DeliveryStage) {
  if (stage === "PENDING") return { border: "border-amber-300", bg: "bg-amber-50/60" };
  if (stage === "DELIVERED") return { border: "border-emerald-300", bg: "bg-emerald-50/60" };
  return { border: "border-gray-200", bg: "bg-white" };
}

export function DeliveryKanbanBoard({ deliveries }: { deliveries: DeliveryCardData[] }) {
  const [items, setItems] = useState(deliveries);
  const [draggingId, setDraggingId] = useState<string | null>(null);
  const [dragOverStage, setDragOverStage] = useState<DeliveryStage | null>(null);
  const [pendingNoteFor, setPendingNoteFor] = useState<{ id: string; toStage: DeliveryStage } | null>(null);
  const [noteDraft, setNoteDraft] = useState("");
  const [, startTransition] = useTransition();

  useEffect(() => {
    setItems(deliveries);
  }, [deliveries]);

  const byStage = (stage: DeliveryStage) => items.filter((d) => d.stage === stage);

  function applyMove(deliveryId: string, toStage: DeliveryStage, note?: string) {
    const prevItems = items;
    setItems((prev) => prev.map((d) => (d.id === deliveryId ? { ...d, stage: toStage, note: note ?? d.note } : d)));
    startTransition(() => {
      moveDeliveryStageAction(deliveryId, toStage, note).catch(() => {
        setItems(prevItems);
      });
    });
  }

  function handleDrop(toStage: DeliveryStage) {
    setDragOverStage(null);
    const deliveryId = draggingId;
    setDraggingId(null);
    if (!deliveryId) return;

    const delivery = items.find((d) => d.id === deliveryId);
    if (!delivery || delivery.stage === toStage || delivery.stage === "DELIVERED") return;

    if (toStage === "PENDING" && !delivery.note?.trim()) {
      setPendingNoteFor({ id: deliveryId, toStage });
      setNoteDraft("");
      return;
    }

    applyMove(deliveryId, toStage);
  }

  return (
    <div className="scrollbar-thin flex gap-3 overflow-x-auto pb-2">
      {COLUMNS.map((col) => {
        const colItems = byStage(col.stage);
        const isDragOver = dragOverStage === col.stage;

        return (
          <div
            key={col.stage}
            className="w-72 shrink-0"
            onDragOver={(e) => {
              e.preventDefault();
              if (dragOverStage !== col.stage) setDragOverStage(col.stage);
            }}
            onDragLeave={() => setDragOverStage((prev) => (prev === col.stage ? null : prev))}
            onDrop={(e) => {
              e.preventDefault();
              handleDrop(col.stage);
            }}
          >
            <div className="mb-2 flex items-center justify-between px-1">
              <p className={`rounded-md border px-2.5 py-1 text-xs font-bold uppercase tracking-wide ${COLUMN_HEADER_CLASS[col.stage]}`}>
                {col.label}
              </p>
              <span className="text-xs font-semibold text-gray-400">{colItems.length}</span>
            </div>
            <div
              className={`min-h-[120px] space-y-2 rounded-lg border-2 border-dashed p-2 transition ${
                isDragOver ? "border-blue-400 bg-blue-50/50" : "border-transparent"
              }`}
            >
              {colItems.map((d) => {
                const tone = cardTone(d.stage);
                const locked = d.stage === "DELIVERED";
                return (
                  <div
                    key={d.id}
                    draggable={!locked}
                    onDragStart={(e) => {
                      if (locked) {
                        e.preventDefault();
                        return;
                      }
                      setDraggingId(d.id);
                    }}
                    onDragEnd={() => setDraggingId(null)}
                    title={locked ? "Sudah terkirim — kartu tidak bisa dipindahkan" : undefined}
                    className={`space-y-1.5 rounded-lg border p-3 text-xs shadow-sm ${tone.border} ${tone.bg} ${
                      locked ? "cursor-default" : "cursor-grab active:cursor-grabbing"
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <span className="font-bold text-gray-900">{d.code}</span>
                      <span className="text-[10px] text-gray-400">{d.soCode}</span>
                    </div>
                    <p className="font-medium text-gray-700">{d.customerName}</p>
                    <p className="text-gray-500">
                      {d.productName} · {d.qty.toLocaleString("id-ID")} pcs
                    </p>
                    {d.requestedDeliveryDate ? (
                      <p className="text-gray-400">Kirim diminta: {formatDate(d.requestedDeliveryDate)}</p>
                    ) : null}
                    {d.stage === "DELIVERED" && d.deliveredAt ? (
                      <p className="font-semibold text-emerald-700">Terkirim: {formatDate(d.deliveredAt)}</p>
                    ) : null}
                    {d.stage === "PENDING" ? (
                      <div className="mt-1 rounded-md border border-amber-200 bg-amber-50 p-2">
                        <p className="mb-1 text-[10px] font-bold uppercase text-amber-700">Catatan Pending</p>
                        <PendingNoteEditor deliveryId={d.id} note={d.note} />
                      </div>
                    ) : null}
                  </div>
                );
              })}
              {colItems.length === 0 ? <p className="py-6 text-center text-[11px] italic text-gray-300">Kosong</p> : null}
            </div>
          </div>
        );
      })}

      {pendingNoteFor ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="w-full max-w-sm rounded-lg bg-white p-4 shadow-xl">
            <h3 className="mb-2 text-sm font-bold text-gray-900">Catatan Pending</h3>
            <p className="mb-3 text-xs text-gray-500">
              Wajib isi alasan pengiriman tertunda sebelum memindahkan kartu ke kolom Pending.
            </p>
            <textarea
              autoFocus
              value={noteDraft}
              onChange={(e) => setNoteDraft(e.target.value)}
              rows={3}
              placeholder="Mis. kendaraan belum tersedia, menunggu konfirmasi customer, dll."
              className="mb-3 w-full rounded-md border border-gray-300 px-3 py-2 text-sm outline-none focus:border-blue-500"
            />
            <div className="flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setPendingNoteFor(null)}
                className="rounded-md border border-gray-200 px-3 py-1.5 text-xs font-semibold text-gray-600 hover:bg-gray-50"
              >
                Batal
              </button>
              <button
                type="button"
                disabled={!noteDraft.trim()}
                onClick={() => {
                  applyMove(pendingNoteFor.id, pendingNoteFor.toStage, noteDraft.trim());
                  setPendingNoteFor(null);
                }}
                className="rounded-md bg-navy-900 px-3 py-1.5 text-xs font-semibold text-white hover:bg-navy-800 disabled:cursor-not-allowed disabled:opacity-40"
              >
                Simpan & Pindahkan
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}

function PendingNoteEditor({ deliveryId, note }: { deliveryId: string; note: string | null }) {
  const [editing, setEditing] = useState(false);
  const [value, setValue] = useState(note ?? "");
  const [, startTransition] = useTransition();

  if (!editing) {
    return (
      <div className="flex items-start justify-between gap-2">
        <p className="flex-1 text-[11px] text-amber-800">{note || "(belum ada catatan)"}</p>
        <button
          type="button"
          onClick={() => {
            setValue(note ?? "");
            setEditing(true);
          }}
          className="shrink-0 text-[10px] font-semibold text-amber-700 underline"
        >
          Edit
        </button>
      </div>
    );
  }

  return (
    <form
      action={(formData) => {
        startTransition(() => {
          updateDeliveryNoteAction(formData);
        });
        setEditing(false);
      }}
      className="space-y-1.5"
      onClick={(e) => e.stopPropagation()}
    >
      <input type="hidden" name="deliveryId" value={deliveryId} />
      <textarea
        name="note"
        value={value}
        onChange={(e) => setValue(e.target.value)}
        rows={2}
        className="w-full rounded-md border border-amber-300 px-2 py-1 text-[11px] outline-none focus:border-amber-500"
      />
      <div className="flex justify-end gap-1.5">
        <button
          type="button"
          onClick={() => setEditing(false)}
          className="rounded border border-gray-200 px-2 py-0.5 text-[10px] font-semibold text-gray-600 hover:bg-gray-50"
        >
          Batal
        </button>
        <button type="submit" className="rounded bg-amber-600 px-2 py-0.5 text-[10px] font-semibold text-white hover:bg-amber-700">
          Simpan
        </button>
      </div>
    </form>
  );
}

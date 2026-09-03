import type { LeadStage } from "@prisma/client";

const STAGE_ORDER: LeadStage[] = ["NEW", "CONTACTED", "QUALIFIED", "MEETING", "QUOTATION", "NEGOTIATION", "WON"];

export function nextStage(stage: LeadStage): LeadStage | null {
  const idx = STAGE_ORDER.indexOf(stage);
  if (idx === -1 || idx === STAGE_ORDER.length - 1) return null;
  return STAGE_ORDER[idx + 1];
}

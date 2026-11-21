import type { CustomerTerm } from "@prisma/client";

const TERM_DAYS: Record<CustomerTerm, number> = {
  CBD: 0,
  NET_15: 15,
  NET_30: 30,
  NET_45: 45,
  NET_60: 60,
};

export function termToDays(term: CustomerTerm): number {
  return TERM_DAYS[term];
}

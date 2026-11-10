import type { Plan } from "@prisma/client";
export type { Plan };

/**
 * Seat limits per plan. The product's positioning is that only staff seats are
 * limited — never bookings or revenue — so this is the one place we enforce a
 * quota.
 */
export const STAFF_SEATS: Record<Plan, number> = {
  FREE: 1,
  STARTER: 1,
  GROWTH: 5,
  SCALE: Number.POSITIVE_INFINITY,
};

export const PLAN_LABEL: Record<Plan, string> = {
  FREE: "Evaluation",
  STARTER: "Starter",
  GROWTH: "Growth",
  SCALE: "Scale",
};

export function staffSeatLimit(plan: Plan): number {
  return STAFF_SEATS[plan];
}

export function staffSeatLabel(plan: Plan): string {
  const limit = STAFF_SEATS[plan];
  return Number.isFinite(limit) ? `${limit}` : "Unlimited";
}

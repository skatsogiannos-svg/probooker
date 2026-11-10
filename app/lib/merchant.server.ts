import prisma from "../db.server";
import type { Merchant } from "@prisma/client";

/**
 * Ensure a Merchant row exists for the shop and return it.
 * Called at the start of every authenticated admin loader/action.
 */
export async function getOrCreateMerchant(shopDomain: string): Promise<Merchant> {
  return prisma.merchant.upsert({
    where: { shopDomain },
    update: {},
    create: { shopDomain },
  });
}

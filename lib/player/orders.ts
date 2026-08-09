export const ORDERS_NOT_READY_MESSAGE =
  "Orders are not ready to be placed yet, if you want more pulls speak to one of the Founders";

export function areOrdersOpen(): boolean {
  return process.env.ANCIENT_PULLS_ORDERS_OPEN?.trim().toLowerCase() === "true";
}

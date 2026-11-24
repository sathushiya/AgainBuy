import type { CourierService } from "../types";

// Couriers a seller can choose for "Delivery Available" listings. AgainBuy
// doesn't integrate with them: sellers book the delivery on the courier's own
// website and enter the tracking number, which buyers use on that website.
export const COURIERS: readonly { id: CourierService; name: string; website: string }[] = [
  { id: "PickMe", name: "PickMe", website: "https://pickme.lk" },
  { id: "Domex", name: "Domex", website: "https://www.domex.lk" },
];

export function courierWebsite(courier: CourierService | null | undefined) {
  return COURIERS.find((item) => item.id === courier)?.website;
}

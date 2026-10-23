import { Facility } from "../types";

export const facilities: Facility[] = [
  { id: "fac_1", name: "Colombo Community Hub", location: "Colombo 07", resourceCount: 28, activeBookings: 7, status: "Operational" },
  { id: "fac_2", name: "North Campus Store", location: "Kelaniya", resourceCount: 19, activeBookings: 4, status: "Limited" },
  { id: "fac_3", name: "Galle Circular Centre", location: "Galle Fort", resourceCount: 34, activeBookings: 9, status: "Operational" },
];

export const platformUsers = [
  { id: "pu_1", name: "Maya Perera", email: "customer@againbuy.demo", role: "customer" as const, status: "Active", joined: "Mar 2024" },
  { id: "pu_2", name: "Arun Jayawardena", email: "admin@againbuy.demo", role: "admin" as const, status: "Active", joined: "Sep 2022" },
  { id: "pu_3", name: "Sanjana Rodrigo", email: "sanjana@example.com", role: "customer" as const, status: "Review", joined: "Jun 2025" },
  { id: "pu_4", name: "Ruwan Jayasekara", email: "ruwan@example.com", role: "customer" as const, status: "Inactive", joined: "Apr 2024" },
];

export const moderationQueue = [
  { id: "MOD-41", title: "iPhone 14 Pro", reason: "Possible counterfeit", seller: "New account", status: "Pending" },
  { id: "MOD-38", title: "Designer Handbag", reason: "Misleading condition", seller: "D. Kumari", status: "Evidence requested" },
  { id: "MOD-35", title: "Prescription Item", reason: "Prohibited category", seller: "Removed user", status: "Urgent" },
];

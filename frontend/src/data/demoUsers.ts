import { DemoUser } from "../types";

export const demoUsers: readonly DemoUser[] = [
  {
    id: "customer_1",
    name: "Maya Perera",
    email: "customer@againbuy.demo",
    password: "Customer123!",
    role: "customer",
    avatar: "https://images.unsplash.com/photo-1494790108377-be9c29b29330?auto=format&fit=crop&w=240&q=80",
    location: "Colombo 05",
    memberSince: "March 2024",
    description: "Buy and sell pre-loved products with one account.",
  },
  {
    id: "demo_buyer",
    name: "Demo Buyer",
    email: "demo@againbuy.demo",
    password: "Demo1234!",
    role: "customer",
    avatar: "https://images.unsplash.com/photo-1438761681033-6461ffad8d80?auto=format&fit=crop&w=240&q=80",
    location: "Nugegoda",
    memberSince: "January 2025",
    description: "A second customer: buy Maya's listings or message her as another person.",
  },
  {
    id: "admin_1",
    name: "Arun Jayawardena",
    email: "admin@againbuy.demo",
    password: "Admin123!",
    role: "admin",
    avatar: "https://images.unsplash.com/photo-1560250097-0b93528c311a?auto=format&fit=crop&w=240&q=80",
    location: "AgainBuy Platform",
    memberSince: "September 2022",
    description: "Oversee users, facilities, moderation, and settings.",
  },
] as const;

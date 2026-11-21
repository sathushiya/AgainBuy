import { Conversation, Product, Transaction, User } from "../types";

export const currentUser: User = {
  id: "user_1",
  name: "Maya Perera",
  email: "maya@againbuy.demo",
  role: "customer",
  avatar: "https://images.unsplash.com/photo-1494790108377-be9c29b29330?auto=format&fit=crop&w=240&q=80",
  location: "Colombo 05",
  memberSince: "March 2024",
};

const sellerAvatar = "https://images.unsplash.com/photo-1500648767791-00dcc994a43e?auto=format&fit=crop&w=160&q=80";

export const products: Product[] = [
  { id: "p1", title: "iPhone 13 · 128GB", category: "Phones", price: 138000, originalPrice: 229000, image: "https://images.unsplash.com/photo-1559041891-4da9154178aa?auto=format&fit=crop&w=900&q=85", condition: "Excellent", usage: "1 year 8 months", purchaseYear: 2023, location: "Colombo 03", seller: "Nimal S.", sellerAvatar, sellerRating: 4.9, brand: "Apple", model: "iPhone 13", description: "Carefully used personal phone with strong battery health. Always kept in a case with a screen protector.", defects: "Small mark near the charging port. No screen damage.", accessories: "Original box, cable, two cases", listedAt: "12 min ago", status: "Active" },
  { id: "p2", title: "MacBook Air M1", category: "Laptops", price: 185000, originalPrice: 285000, image: "https://images.unsplash.com/photo-1426024084828-5da21e13f5dc?auto=format&fit=crop&w=900&q=85", condition: "Good", usage: "2 years", purchaseYear: 2022, location: "Nugegoda", seller: "Sanjana R.", sellerAvatar, sellerRating: 4.8, brand: "Apple", model: "MacBook Air M1", description: "Reliable laptop used for university work. Battery and keyboard are in good working order.", defects: "Light scratches on the underside.", accessories: "Original charger", listedAt: "1 hour ago", status: "Active" },
  { id: "p3", title: "Solid Teak Lounge Chair", category: "Furniture", price: 32000, originalPrice: 52000, image: "https://images.unsplash.com/photo-1782177387512-5c23069812e0?auto=format&fit=crop&w=900&q=85", condition: "Like new", usage: "8 months", purchaseYear: 2024, location: "Kotte", seller: "Amaya Home", sellerAvatar, sellerRating: 4.7, brand: "Local craft", model: "Lounge 02", description: "Handmade teak chair in excellent condition. Selling due to relocation.", defects: "None visible.", accessories: "Seat cushion included", listedAt: "Today", status: "Active" },
  { id: "p4", title: "Fujifilm Compact Camera", category: "Electronics", price: 46500, originalPrice: 78000, image: "https://images.unsplash.com/photo-1564819337720-5d2f6803161c?auto=format&fit=crop&w=900&q=85", condition: "Good", usage: "3 years", purchaseYear: 2021, location: "Dehiwala", seller: "Kasun D.", sellerAvatar, sellerRating: 4.6, brand: "Fujifilm", model: "XQ2", description: "Compact everyday camera with a bright lens and good image quality.", defects: "Minor wear around mode dial.", accessories: "Battery, charger, wrist strap", listedAt: "Yesterday", status: "Reserved" },
  { id: "p5", title: "Sony Wireless Headphones", category: "Electronics", price: 28500, originalPrice: 49000, image: "https://images.unsplash.com/photo-1714317437446-3ccdaf33eeea?auto=format&fit=crop&w=900&q=85", condition: "Excellent", usage: "10 months", purchaseYear: 2024, location: "Rajagiriya", seller: "Thilini P.", sellerAvatar, sellerRating: 5, brand: "Sony", model: "WH-1000XM4", description: "Comfortable noise-cancelling headphones, lightly used.", defects: "No known defects.", accessories: "Carry case and charging cable", listedAt: "2 days ago", status: "Active" },
  { id: "p6", title: "Architecture Book Set", category: "Books", price: 7200, originalPrice: 18000, image: "https://images.unsplash.com/photo-1495446815901-a7297e633e8d?auto=format&fit=crop&w=900&q=85", condition: "Good", usage: "4 years", purchaseYear: 2020, location: "Moratuwa", seller: "Ishara W.", sellerAvatar, sellerRating: 4.8, brand: "Mixed publishers", model: "6-book set", description: "Six useful architecture references, ideal for students.", defects: "Some pencil notes and shelf wear.", accessories: "Complete set of six", listedAt: "3 days ago", status: "Active" },
  { id: "p7", title: "Nike Running Shoes", category: "Clothing", price: 12500, originalPrice: 26000, image: "https://images.unsplash.com/photo-1542291026-7eec264c27ff?auto=format&fit=crop&w=900&q=85", condition: "Good", usage: "6 months", purchaseYear: 2024, location: "Battaramulla", seller: "Ravin K.", sellerAvatar, sellerRating: 4.5, brand: "Nike", model: "Pegasus 40", description: "Comfortable daily trainers, UK size 9.", defects: "Normal sole wear.", accessories: "Original box", listedAt: "4 days ago", status: "Active" },
  { id: "p8", title: "Rice Cooker · 1.8L", category: "Appliances", price: 9800, originalPrice: 18500, image: "https://images.unsplash.com/photo-1585515320310-259814833e62?auto=format&fit=crop&w=900&q=85", condition: "Excellent", usage: "1 year", purchaseYear: 2023, location: "Mount Lavinia", seller: "Dinuki A.", sellerAvatar, sellerRating: 4.9, brand: "Panasonic", model: "SR-W18", description: "Clean and fully working family-size rice cooker.", defects: "Small cosmetic mark on lid.", accessories: "Measuring cup and spoon", listedAt: "1 week ago", status: "Active" },
];

export const categories = ["All", "Phones", "Laptops", "Furniture", "Electronics", "Books", "Clothing", "Sports", "Appliances"];

export const conversations: Conversation[] = [
  { id: "c1", productId: "p1", person: "Nimal S.", avatar: sellerAvatar, lastMessage: "Yes, you can inspect it this evening.", time: "9:42 AM", unread: 2 },
  { id: "c2", productId: "p3", person: "Amaya Home", avatar: sellerAvatar, lastMessage: "Delivery within Colombo is possible.", time: "Yesterday", unread: 0 },
  { id: "c3", productId: "p5", person: "Thilini P.", avatar: sellerAvatar, lastMessage: "The battery lasts around 25 hours.", time: "Mon", unread: 0 },
];

export const transactions: Transaction[] = [
  { id: "TX-2041", productId: "p4", type: "purchase", party: "Kasun D.", amount: 46500, date: "12 June 2025", status: "Meetup scheduled" },
  { id: "TX-1984", productId: "p6", type: "purchase", party: "Ishara W.", amount: 7200, date: "28 May 2025", status: "Completed" },
  { id: "TX-2012", productId: "p2", type: "sale", party: "Harini F.", amount: 174000, date: "5 June 2025", status: "Completed" },
  { id: "TX-1892", productId: "p7", type: "sale", party: "Kavindu M.", amount: 11000, date: "18 April 2025", status: "Completed" },
];

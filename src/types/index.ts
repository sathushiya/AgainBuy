export type ProductCondition = "Like new" | "Excellent" | "Good" | "Fair";
export type ListingStatus = "Active" | "Reserved" | "Sold" | "Inactive";
export type UserRole = "customer" | "admin";

export interface AppUser {
  id: string;
  name: string;
  email: string;
  role: UserRole;
  avatar: string;
  location: string;
  memberSince: string;
}

export interface Product {
  id: string;
  title: string;
  category: string;
  price: number;
  originalPrice?: number;
  image: string;
  images?: string[];
  condition: ProductCondition;
  usage: string;
  purchaseYear: number;
  location: string;
  seller: string;
  sellerAvatar: string;
  sellerRating: number;
  brand: string;
  model: string;
  description: string;
  defects: string;
  accessories: string;
  listedAt: string;
  status: ListingStatus;
}

export type User = AppUser;

export interface DemoUser extends AppUser {
  password: string;
  description: string;
}

export interface Facility {
  id: string;
  name: string;
  location: string;
  resourceCount: number;
  activeBookings: number;
  status: "Operational" | "Limited" | "Maintenance";
}


export interface Conversation {
  id: string;
  productId: string;
  person: string;
  avatar: string;
  lastMessage: string;
  time: string;
  unread: number;
}

export interface Transaction {
  id: string;
  productId: string;
  type: "purchase" | "sale";
  party: string;
  amount: number;
  date: string;
  status: "Completed" | "Meetup scheduled" | "Cancelled";
}

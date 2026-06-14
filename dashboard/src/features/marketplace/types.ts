export type Role = "ADMIN" | "BANK_SAMPAH" | "INDUSTRI" | "WARGA" | "UMKM";
export type AccountStatus = "PENDING_VERIFICATION" | "ACTIVE" | "SUSPENDED" | "REJECTED";
export type ListingType = "MATERIAL" | "PRODUCT";
export type ListingStatus = "ACTIVE" | "SOLD_OUT" | "EXPIRED" | "DRAFT";
export type DemandStatus = "OPEN" | "PARTIALLY_FULFILLED" | "FULFILLED" | "CANCELLED";
export type OrderStatus =
  | "DRAFT" | "PENDING_APPROVAL" | "APPROVED" | "AWAITING_PAYMENT"
  | "PAID" | "READY_FOR_PICKUP" | "READY_FOR_DELIVERY"
  | "IN_TRANSIT" | "DELIVERED" | "COMPLETED" | "CANCELLED";
export type FulfillmentOption = "PICKUP" | "DELIVERY" | "BOTH";
export type LogisticsOption = "PICKUP" | "DELIVERY";

export interface User {
  id: string;
  email: string;
  role: Role;
  status: AccountStatus;
  name: string;
  address?: string;
  lat?: number;
  lng?: number;
  contact?: string;
  verificationDoc?: string;
  sellerRating?: number;
  createdAt: string;
}

export interface AuthResponse {
  token: string;
  user: User;
}

export interface MaterialCategory {
  id: string;
  name: string;
  description?: string;
  unit: string;
  minPrice: number;
  maxPrice: number;
  gradeOptions: string[];
  isProduct: boolean;
}

export interface ListingSeller {
  id: string;
  name: string;
  sellerRating: number;
  contact: string;
  lat?: number;
  lng?: number;
  address?: string;
}

export interface Listing {
  id: string;
  sellerId: string;
  seller: ListingSeller;
  type: ListingType;
  categoryId: string;
  category: MaterialCategory;
  title: string;
  description?: string;
  quantity: number;
  pricePerKg: number;
  moq: number;
  fulfillmentOptions: FulfillmentOption;
  lat: number;
  lng: number;
  status: ListingStatus;
  grade?: string;
  createdAt: string;
  updatedAt: string;
}

export interface Demand {
  id: string;
  buyerId: string;
  buyer: { id: string; name: string; contact: string; lat?: number; lng?: number };
  categoryId: string;
  category: MaterialCategory;
  quantityNeeded: number;
  maxPrice: number;
  preferredDistance: number;
  lat?: number;
  lng?: number;
  status: DemandStatus;
  matchSuggestions?: MatchSuggestion[];
}

export interface MatchCandidate {
  listingId: string;
  sellerId: string;
  sellerName: string;
  sellerRating: number;
  title: string;
  categoryName: string;
  availableQuantity: number;
  pricePerKg: number;
  distanceKm: number;
  moq: number;
  fulfillmentOptions: string;
  sellerContact: string;
}

export interface MatchGroup {
  candidates: MatchCandidate[];
  totalQuantity: number;
  totalCost: number;
  avgDistance: number;
  score: number;
}

export interface MatchSuggestion {
  id: string;
  demandId: string;
  candidateData: MatchCandidate[];
  totalQuantity: number;
  totalCost: number;
  distanceKm: number;
  score: number;
  status: string;
}

export interface MatchResult {
  demand: Demand;
  matches: MatchGroup[];
  instantOrderEligible: boolean;
}

export interface OrderItem {
  id: string;
  orderId: string;
  listingId: string;
  listing: Listing;
  sellerId: string;
  quantity: number;
  pricePerKg: number;
  subtotal: number;
  status: OrderStatus;
}

export interface Order {
  id: string;
  buyerId: string;
  buyer: { id: string; name: string; contact: string; address?: string };
  demandId?: string;
  demand?: Demand;
  items: OrderItem[];
  status: OrderStatus;
  logisticsOption?: LogisticsOption;
  totalQuantity: number;
  totalAmount: number;
  notes?: string;
  paymentProof?: string;
  createdAt: string;
  updatedAt: string;
}

export interface SellerOrderItem {
  id: string;
  order: Order;
  listing: Listing;
  quantity: number;
  pricePerKg: number;
  subtotal: number;
  status: OrderStatus;
}

export interface PaginatedResponse<T> {
  listings?: T[];
  demands?: T[];
  orders?: T[];
  orderItems?: T[];
  total: number;
  page: number;
  limit: number;
}

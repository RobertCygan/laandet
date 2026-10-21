export type ListingType = "rental" | "wanted";
export type PriceUnit = "hour" | "day" | "weekend" | "week";
export interface Location {
  municipality: string;
  localArea: string;
  postalCode: string;
  coordinatesApprox: [number, number];
}
export interface Category {
  id: string;
  name: string;
  icon: string;
}
export interface Availability {
  unavailable: string[];
  note: string;
}
export interface DeliveryOption {
  available: boolean;
  price?: number;
  description: string;
}
export interface User {
  id: string;
  displayName: string;
  location: Location;
  isDemo: boolean;
  joinedYear: number;
}
export interface Listing {
  id: string;
  isDemo: true;
  listingType: "rental";
  title: string;
  description: string;
  category: string;
  location: string;
  municipality: string;
  postalCode: string;
  coordinatesApprox: [number, number];
  priceHour?: number;
  priceDay?: number;
  priceWeekend?: number;
  priceWeek?: number;
  deliveryAvailable: boolean;
  deliveryPrice?: number;
  image: string;
  imageIndex: number;
  createdAt: string;
  availability: Availability;
  ownerDemoId: string;
  included: string[];
  rules: string[];
}
export interface WantedListing {
  id: string;
  isDemo: true;
  listingType: "wanted";
  title: string;
  description: string;
  category: string;
  location: string;
  municipality: string;
  coordinatesApprox: [number, number];
  budget: string;
  budgetMax?: number;
  period: string;
  ownerDemoId: string;
  createdAt: string;
}
export interface RentalRequest {
  id: string;
  listingId: string;
  renterId: string;
  start: string;
  end: string;
  delivery: boolean;
  status: "draft" | "pending" | "accepted" | "declined";
}
export interface Conversation {
  id: string;
  participantIds: string[];
  listingId: string;
}
export interface Message {
  id: string;
  conversationId: string;
  senderId: string;
  body: string;
  createdAt: string;
}
export interface Favorite {
  listingId: string;
  userId: string;
}
export interface Review {
  id: string;
  requestId: string;
  authorId: string;
  score: number;
  body: string;
}
export interface Payment {
  id: string;
  requestId: string;
  amountNok: number;
  status: "planned" | "pending" | "paid" | "refunded";
}
export interface ResearchResponse {
  id: string;
  createdAt: string;
  use: string;
  purpose: string;
  categories: string[];
  own: string;
  priorities: string[];
  distance: string;
  delivery: string;
  missing: string;
  contact?: string;
}
export type ResearchEventName =
  | "page_view"
  | "search_performed"
  | "category_opened"
  | "listing_opened"
  | "wanted_listing_opened"
  | "rent_cta_clicked"
  | "have_this_clicked"
  | "delivery_interest_clicked"
  | "create_listing_started"
  | "create_listing_completed_demo"
  | "survey_started"
  | "survey_completed"
  | "launch_interest";
export interface ResearchEvent {
  id: string;
  name: ResearchEventName;
  createdAt: string;
  data: Record<string, string | number | boolean>;
}

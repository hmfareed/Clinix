import { z } from "zod";

export type FacilityType = "hospital" | "clinic" | "emergency_department" | "pharmacy" | "specialist";

export interface NormalizedFacility {
  id: string;
  name: string;
  facilityType: FacilityType;
  formattedAddress: string;
  latitude: number;
  longitude: number;
  distanceMeters?: number; // Approximate straight-line distance from search point
  phoneNumber?: string | null;
  websiteUrl?: string | null;
  mapsUrl: string;
  openingHours?: string | null;
  openNow?: boolean | null;
  provider: string; // e.g. "google_places_new" | "ghana_health_service" | "verified_directory"
  lastVerifiedAt?: string;
  services?: string[];
  phoneVerified?: boolean;
  accessibility?: {
    wheelchairAccessible?: boolean | null;
    parking?: boolean | null;
  };
  appointmentBooking?: {
    available: boolean;
    url?: string | null;
    note?: string;
  };
}

export const nearbySearchRequestSchema = z.object({
  latitude: z.number().min(-90).max(90),
  longitude: z.number().min(-180).max(180),
  radiusMeters: z.number().min(500).max(25000).default(5000),
  facilityTypes: z
    .union([
      z.enum(["hospital", "clinic", "emergency_department", "pharmacy", "specialist", "all"]),
      z.array(z.enum(["hospital", "clinic", "emergency_department", "pharmacy", "specialist", "all"])),
    ])
    .optional()
    .default("all"),
  query: z.string().max(100).optional(),
  limit: z.number().min(1).max(50).default(20).optional(),
  pageToken: z.string().optional(),
});

export type NearbySearchRequest = {
  latitude: number;
  longitude: number;
  radiusMeters?: number;
  facilityTypes?: FacilityType | "all" | Array<FacilityType | "all">;
  query?: string;
  limit?: number;
  pageToken?: string;
};

export interface NearbySearchResponse {
  success: boolean;
  facilities: NormalizedFacility[];
  totalCount: number;
  provider: string;
  radiusMeters: number;
  center: {
    latitude: number;
    longitude: number;
  };
  searchTimeMs: number;
  nextPageToken?: string;
}

export const geocodeRequestSchema = z.object({
  query: z.string().min(2).max(120),
});

export type GeocodeRequest = z.infer<typeof geocodeRequestSchema>;

export interface GeocodeResponse {
  success: boolean;
  latitude: number;
  longitude: number;
  displayName: string;
  provider: string;
}

export interface IHealthcarePlacesProvider {
  readonly name: string;
  searchNearby(request: NearbySearchRequest): Promise<NormalizedFacility[]>;
}

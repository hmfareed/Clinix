export type FacilityType =
  | "hospital"
  | "clinic"
  | "pharmacy"
  | "emergency_department";

export interface Facility {
  providerId: string;
  name: string;
  type: FacilityType;
  location: { lat: number; lng: number };
  address?: string;
  phone?: string;
  phoneVerified: boolean;
  hours?: {
    known: boolean;
    text?: string;
  };
  services?: string[];
  source: string;
  lastVerifiedAt?: string; // ISO date string
  distanceKm?: number;
}

export interface SearchFacilitiesParams {
  lat?: number;
  lng?: number;
  query?: string; // Manual location search e.g. "Accra", "Kumasi", "Tema"
  type?: FacilityType;
  radiusKm?: number;
  limit?: number;
}

export interface IMapsProvider {
  readonly name: string;
  searchFacilities(params: SearchFacilitiesParams): Promise<Facility[]>;
  getFacilityDetails(providerId: string): Promise<Facility | null>;
}

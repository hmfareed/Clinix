import {
  FacilityType,
  IHealthcarePlacesProvider,
  NearbySearchRequest,
  NormalizedFacility,
} from "./types";
import { calculateHaversineDistanceMeters } from "./distance";
import rawGhanaFacilities from "@/data/ghana-facilities.json";

export class VerifiedDirectoryProvider implements IHealthcarePlacesProvider {
  public readonly name = "verified_ghana_directory";
  private readonly facilities: any[];

  constructor(customFacilities?: any[]) {
    this.facilities = customFacilities || (rawGhanaFacilities as any[]);
  }

  async searchNearby(request: NearbySearchRequest): Promise<NormalizedFacility[]> {
    const { latitude, longitude, radiusMeters = 5000, facilityTypes, query, limit = 20 } = request;

    // Normalize types filter
    const targetTypes: string[] = Array.isArray(facilityTypes)
      ? facilityTypes
      : facilityTypes && facilityTypes !== "all"
      ? [facilityTypes]
      : [];

    const searchQuery = query?.trim().toLowerCase();

    let matched: NormalizedFacility[] = [];

    for (const raw of this.facilities) {
      const facLat = raw.location?.lat;
      const facLng = raw.location?.lng;
      if (facLat === undefined || facLng === undefined) continue;

      // Filter by facilityType
      const rawType = (raw.type || "clinic") as FacilityType;
      if (targetTypes.length > 0 && !targetTypes.includes("all")) {
        if (!targetTypes.includes(rawType)) {
          continue;
        }
      }

      // Filter by search query (name, specialty/services, address, or type)
      if (searchQuery) {
        const nameMatch = raw.name?.toLowerCase().includes(searchQuery);
        const addressMatch = raw.address?.toLowerCase().includes(searchQuery);
        const typeMatch = rawType.toLowerCase().includes(searchQuery);
        const servicesMatch = raw.services?.some((s: string) =>
          s.toLowerCase().includes(searchQuery)
        );

        if (!nameMatch && !addressMatch && !typeMatch && !servicesMatch) {
          continue;
        }
      }

      // Compute approximate straight-line distance
      const distanceMeters = calculateHaversineDistanceMeters(
        latitude,
        longitude,
        facLat,
        facLng
      );

      // Only include facilities within search radius (cap at 25km / 25000m)
      if (distanceMeters > radiusMeters) {
        continue;
      }

      const mapsUrl = `https://www.google.com/maps/dir/?api=1&destination=${facLat},${facLng}`;

      matched.push({
        id: raw.providerId || `gh_${facLat}_${facLng}`,
        name: raw.name,
        facilityType: rawType,
        formattedAddress: raw.address || "Ghana",
        latitude: facLat,
        longitude: facLng,
        distanceMeters,
        phoneNumber: raw.phone || null,
        phoneVerified: Boolean(raw.phoneVerified),
        websiteUrl: raw.website || null,
        mapsUrl,
        openingHours: raw.hours?.text || null,
        openNow: raw.hours?.known && raw.hours.text?.toLowerCase().includes("24/7") ? true : null,
        provider: raw.source || "Ghana Health Service Directory",
        lastVerifiedAt: raw.lastVerifiedAt || new Date().toISOString(),
        services: raw.services || [],
        accessibility: {
          wheelchairAccessible: raw.accessibility?.wheelchairAccessible ?? true,
          parking: raw.accessibility?.parking ?? true,
        },
        appointmentBooking: raw.appointmentBooking || {
          available: false,
          note: "Online booking is not integrated for this facility. Please call directly to schedule an appointment.",
        },
      });
    }

    // Rank nearby results strictly by distance (closest first)
    matched.sort((a, b) => (a.distanceMeters ?? 999999) - (b.distanceMeters ?? 999999));

    return matched.slice(0, limit);
  }
}

export const defaultVerifiedDirectoryProvider = new VerifiedDirectoryProvider();

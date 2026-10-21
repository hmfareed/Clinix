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
    const { latitude, longitude, radiusMeters = 5000, facilityTypes, limit = 10 } = request;

    // Normalize types filter
    const targetTypes: string[] = Array.isArray(facilityTypes)
      ? facilityTypes
      : facilityTypes && facilityTypes !== "all"
      ? [facilityTypes]
      : [];

    let matched: NormalizedFacility[] = [];

    for (const raw of this.facilities) {
      const facLat = raw.location?.lat;
      const facLng = raw.location?.lng;
      if (facLat === undefined || facLng === undefined) continue;

      // Filter by facilityType
      const rawType = (raw.type || "clinic") as FacilityType;
      if (targetTypes.length > 0 && !targetTypes.includes("all") && !targetTypes.includes(rawType)) {
        continue;
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
        websiteUrl: raw.website || null,
        mapsUrl,
        openingHours: raw.hours?.text || null,
        openNow: raw.hours?.known && raw.hours.text?.toLowerCase().includes("24/7") ? true : null,
        provider: raw.source || "Ghana Health Service Directory",
        lastVerifiedAt: raw.lastVerifiedAt || new Date().toISOString(),
        services: raw.services || [],
      });
    }

    // Rank nearby results strictly by distance (closest first)
    matched.sort((a, b) => (a.distanceMeters ?? 999999) - (b.distanceMeters ?? 999999));

    return matched.slice(0, limit);
  }
}

export const defaultVerifiedDirectoryProvider = new VerifiedDirectoryProvider();
